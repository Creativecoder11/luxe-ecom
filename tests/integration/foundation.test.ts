/**
 * Runs against TEST_DATABASE_URL (migrated by scripts/prepare-test-db.ts).
 * Verifies the foundation migration: relations, the append-only audit trigger,
 * outbox idempotency and CHECK constraints.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db as prisma, resetDatabase } from "../support/db";

let businessId: string;

beforeAll(async () => {
  await resetDatabase();
  const business = await prisma.business.create({
    data: { slug: "test-business", name: "Test Business", settings: { create: { storeName: "Test Store" } } },
    include: { settings: true },
  });
  businessId = business.id;
  expect(business.settings?.guestCheckoutEnabled).toBe(true);
  expect(business.currency).toBe("BDT");
  expect(business.timezone).toBe("Asia/Dhaka");
});

describe("audit log", () => {
  it("accepts inserts", async () => {
    const entry = await prisma.auditLog.create({
      data: {
        businessId,
        actorType: "SYSTEM",
        action: "business.created",
        entityType: "Business",
        entityId: businessId,
        after: { name: "Test Business" },
      },
    });
    expect(entry.id).toBeTruthy();
  });

  it("rejects updates and deletes at the database level", async () => {
    const entry = await prisma.auditLog.create({
      data: { businessId, actorType: "SYSTEM", action: "test.immutable", entityType: "Test" },
    });
    await expect(
      prisma.auditLog.update({ where: { id: entry.id }, data: { action: "tampered" } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/append-only/);

    const stillThere = await prisma.auditLog.findUniqueOrThrow({ where: { id: entry.id } });
    expect(stillThere.action).toBe("test.immutable");
  });

  it("prevents deleting a business that has audit history", async () => {
    await expect(prisma.business.delete({ where: { id: businessId } })).rejects.toThrow();
  });
});

describe("outbox", () => {
  it("enforces idempotency keys", async () => {
    const data = { businessId, type: "order.confirmed", payload: { orderId: "o1" }, idempotencyKey: "order.confirmed:o1" };
    await prisma.outboxEvent.create({ data });
    await expect(prisma.outboxEvent.create({ data })).rejects.toThrow();
    expect(await prisma.outboxEvent.count({ where: { idempotencyKey: data.idempotencyKey } })).toBe(1);
  });

  it("rejects invalid retry bookkeeping", async () => {
    await expect(
      prisma.outboxEvent.create({
        data: { businessId, type: "x", payload: {}, idempotencyKey: "neg", attempts: -1 },
      }),
    ).rejects.toThrow();
  });
});
