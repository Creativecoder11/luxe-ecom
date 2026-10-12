import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { recordAudit } from "@/modules/audit/service";
import { assertCan, type StaffActor } from "@/modules/identity/actor";
import { ATTRIBUTE_TYPES, type AttributeType, type AttributeValidationRules } from "./attributes";

const CODE_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

const optionSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Enter an option label").max(80),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #A0522D")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: "Enter a number" });
      return z.NEVER;
    }
    return n;
  });

export const attributeInputSchema = z
  .object({
    code: z.string().trim().toLowerCase().regex(CODE_PATTERN, "Use 2–40 lowercase letters, digits or underscores, starting with a letter"),
    label: z.string().trim().min(1, "Enter a label").max(60),
    type: z.enum(ATTRIBUTE_TYPES),
    unit: z.string().trim().max(20).optional().default(""),
    helpText: z.string().trim().max(200).optional().default(""),
    isVariantAxis: z.boolean().default(false),
    isFilterable: z.boolean().default(false),
    isSearchable: z.boolean().default(false),
    min: optionalNumber,
    max: optionalNumber,
    integer: z.boolean().default(false),
    maxLength: optionalNumber,
    options: z.array(optionSchema).max(200).default([]),
  })
  .superRefine((v, ctx) => {
    const choice = v.type === "SELECT" || v.type === "MULTI_SELECT";
    if (choice && v.options.length === 0) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least one option" });
    if (v.isVariantAxis && v.type !== "SELECT") {
      ctx.addIssue({ code: "custom", path: ["isVariantAxis"], message: "Only single-choice (SELECT) attributes can be variant axes" });
    }
    if (v.isFilterable && !choice && v.type !== "BOOLEAN") {
      ctx.addIssue({ code: "custom", path: ["isFilterable"], message: "Only choice and yes/no attributes can be storefront filters" });
    }
    if (v.min !== undefined && v.max !== undefined && v.min > v.max) {
      ctx.addIssue({ code: "custom", path: ["max"], message: "Maximum must be at least the minimum" });
    }
    const labels = v.options.map((o) => o.label.toLowerCase());
    if (new Set(labels).size !== labels.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Option labels must be unique" });
  });

export type AttributeInput = z.input<typeof attributeInputSchema>;

function validationRules(input: z.output<typeof attributeInputSchema>): AttributeValidationRules | null {
  const rules: AttributeValidationRules = {};
  if (input.type === "NUMBER") {
    if (input.min !== undefined) rules.min = input.min;
    if (input.max !== undefined) rules.max = input.max;
    if (input.integer) rules.integer = true;
  }
  if (input.type === "TEXT" && input.maxLength !== undefined) rules.maxLength = Math.max(1, Math.floor(input.maxLength));
  return Object.keys(rules).length ? rules : null;
}

function optionValue(label: string, index: number): string {
  return slugify(label, 60) || `option-${index + 1}`;
}

export async function listAttributes(actor: StaffActor, options: { includeArchived?: boolean } = {}) {
  assertCan(actor, "catalog.view");
  return db.attributeDefinition.findMany({
    where: { businessId: actor.businessId, ...(options.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ label: "asc" }],
    include: {
      options: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
      _count: { select: { categories: true, productValues: true, variantValues: true } },
    },
  });
}

export async function getAttribute(actor: StaffActor, id: string) {
  assertCan(actor, "catalog.view");
  const attribute = await db.attributeDefinition.findFirst({
    where: { id, businessId: actor.businessId },
    include: {
      options: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } },
      _count: { select: { productValues: true, variantValues: true } },
    },
  });
  if (!attribute) throw new NotFoundError("Attribute");
  return attribute;
}

export async function createAttribute(actor: StaffActor, raw: unknown) {
  assertCan(actor, "catalog.create");
  const input = attributeInputSchema.parse(raw);
  const clash = await db.attributeDefinition.findUnique({ where: { businessId_code: { businessId: actor.businessId, code: input.code } } });
  if (clash) throw new ValidationError("This code is already used.", { code: "This code is already used" });

  return db.$transaction(async (tx) => {
    const attribute = await tx.attributeDefinition.create({
      data: {
        businessId: actor.businessId,
        code: input.code,
        label: input.label,
        type: input.type,
        unit: input.unit || null,
        helpText: input.helpText || null,
        isVariantAxis: input.isVariantAxis,
        isFilterable: input.isFilterable,
        isSearchable: input.isSearchable,
        validation: (validationRules(input) ?? undefined) as Prisma.InputJsonValue | undefined,
        options: {
          create: input.options.map((o, i) => ({ label: o.label, value: optionValue(o.label, i), colorHex: o.colorHex ?? null, sortOrder: i })),
        },
      },
    });
    await recordAudit(tx, actor, {
      action: "attribute.created",
      entityType: "AttributeDefinition",
      entityId: attribute.id,
      after: { code: input.code, type: input.type, options: input.options.map((o) => o.label) },
    });
    return attribute;
  });
}

/**
 * Updates labels, flags, rules and options. Code and type are immutable once any product uses
 * the attribute; options in use cannot be removed (they are archived instead).
 */
export async function updateAttribute(actor: StaffActor, id: string, raw: unknown) {
  assertCan(actor, "catalog.update");
  const existing = await getAttribute(actor, id);
  const input = attributeInputSchema.parse(raw);
  const inUse = existing._count.productValues + existing._count.variantValues > 0;
  if (inUse && (input.code !== existing.code || input.type !== existing.type)) {
    throw new ValidationError("Code and type cannot change once products use this attribute.", {
      type: "Locked: products use this attribute",
    });
  }
  if (input.code !== existing.code) {
    const clash = await db.attributeDefinition.findUnique({ where: { businessId_code: { businessId: actor.businessId, code: input.code } } });
    if (clash) throw new ValidationError("This code is already used.", { code: "This code is already used" });
  }

  await db.$transaction(async (tx) => {
    await tx.attributeDefinition.update({
      where: { id },
      data: {
        code: input.code,
        label: input.label,
        type: input.type as AttributeType,
        unit: input.unit || null,
        helpText: input.helpText || null,
        isVariantAxis: input.isVariantAxis,
        isFilterable: input.isFilterable,
        isSearchable: input.isSearchable,
        validation: (validationRules(input) ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    const keptIds = new Set(input.options.map((o) => o.id).filter(Boolean));
    const removed = existing.options.filter((o) => !keptIds.has(o.id));
    for (const option of removed) {
      const used =
        (await tx.productAttributeValue.count({ where: { optionId: option.id } })) +
        (await tx.variantOptionValue.count({ where: { optionId: option.id } }));
      if (used > 0) await tx.attributeOption.update({ where: { id: option.id }, data: { archivedAt: new Date() } });
      else await tx.attributeOption.delete({ where: { id: option.id } });
    }

    const takenValues = new Set(existing.options.filter((o) => keptIds.has(o.id)).map((o) => o.value));
    for (const [index, option] of input.options.entries()) {
      if (option.id && existing.options.some((o) => o.id === option.id)) {
        await tx.attributeOption.update({
          where: { id: option.id },
          data: { label: option.label, colorHex: option.colorHex ?? null, sortOrder: index },
        });
      } else {
        let value = optionValue(option.label, index);
        for (let n = 2; takenValues.has(value); n++) value = `${optionValue(option.label, index)}-${n}`;
        takenValues.add(value);
        await tx.attributeOption.create({
          data: { attributeId: id, label: option.label, value, colorHex: option.colorHex ?? null, sortOrder: index },
        });
      }
    }

    await recordAudit(tx, actor, {
      action: "attribute.updated",
      entityType: "AttributeDefinition",
      entityId: id,
      before: { label: existing.label, options: existing.options.map((o) => o.label) },
      after: { label: input.label, options: input.options.map((o) => o.label) },
    });
  });
}

export async function archiveAttribute(actor: StaffActor, id: string) {
  assertCan(actor, "catalog.archive");
  const attribute = await getAttribute(actor, id);
  const templates = await db.categoryAttribute.count({ where: { attributeId: id } });
  if (templates > 0) throw new ConflictError("Remove this attribute from category templates before archiving it.");
  await db.$transaction(async (tx) => {
    await tx.attributeDefinition.update({ where: { id }, data: { archivedAt: new Date() } });
    await recordAudit(tx, actor, { action: "attribute.archived", entityType: "AttributeDefinition", entityId: attribute.id });
  });
}
