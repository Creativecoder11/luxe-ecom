import { beforeAll, describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv-parse";
import { ForbiddenError } from "@/lib/errors";
import { exportProductsCsv, importProductsCsv } from "@/modules/catalog/csv";
import { createProduct } from "@/modules/catalog/product.service";
import type { StaffActor } from "@/modules/identity/actor";
import { seedCatalog, type SeededCatalog } from "../../prisma/fixtures/catalog";
import { createBusiness, createStaffActor, db, resetDatabase } from "../support/db";

let owner: StaffActor;
let businessId: string;
let catalog: SeededCatalog;

beforeAll(async () => {
  await resetDatabase();
  businessId = (await createBusiness()).id;
  owner = await createStaffActor(businessId, "owner");
  catalog = await seedCatalog(owner);
});

function csv(lines: string[]) {
  return lines.join("\n") + "\n";
}

describe("product CSV export", () => {
  it("exports one row per variant with option and attribute columns", async () => {
    const { csv: text, rowCount } = await exportProductsCsv(owner);
    const { headers, rows } = parseCsv(text);
    expect(rowCount).toBe(rows.length);
    expect(rows.length).toBe(await db.productVariant.count({ where: { businessId } }));
    expect(headers).toEqual(expect.arrayContaining(["product_slug", "sku", "price", "option:size", "option:shade", "attr:warranty_months", "attr:skin_type"]));
    const kurti = rows.find((r) => r.sku === "KRT-CLASSIC-M-OLIVE")!;
    expect(kurti).toMatchObject({ product_slug: "classic-cotton-kurti", price: "1890", compare_at: "2490", "option:size": "M", "option:color": "Olive", status: "published" });
    const serum = rows.find((r) => r.product_slug === "hydrating-face-serum-30-ml")!;
    expect(serum["attr:skin_type"]).toBe("Dry|Combination");
  });

  it("neutralizes spreadsheet formulas in exported text", async () => {
    await createProduct(owner, {
      title: "=HYPERLINK(\"http://evil.example\")",
      slug: "formula-test",
      primaryCategoryId: catalog.categoryIds.home!,
      variants: [{ combinationKey: "default", sku: "FORMULA-1", price: "10" }],
    });
    const { csv: text } = await exportProductsCsv(owner);
    expect(text).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
  });

  it("requires the export permission", async () => {
    const crm = await createStaffActor(businessId, "crm_agent");
    await expect(exportProductsCsv(crm)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("product CSV import", () => {
  it("re-imports its own export cleanly as updates (round trip)", async () => {
    const { csv: text } = await exportProductsCsv(owner);
    const report = await importProductsCsv(owner, text, { apply: false });
    expect(report.issues).toEqual([]);
    expect(report.creates).toBe(0);
    expect(report.updates).toBe(report.products);
  });

  it("reports every problem with its line number and writes nothing", async () => {
    const before = await db.product.count();
    const report = await importProductsCsv(
      owner,
      csv([
        "product_slug,title,category_slug,status,sku,price,option:size,attr:material",
        "linen-shirt,Linen Shirt,men-s-clothing,published,LIN-S,1200,S,Linen",
        "linen-shirt,Linen Shirt,men-s-clothing,published,LIN-M,abc,M,Linen",
        "linen-shirt,Linen Shirt,men-s-clothing,published,LIN-XXL,1200,XXL,Linen",
        "mystery-item,Mystery,no-such-category,,MYS-1,100,,",
        "Bad Slug!,X,men-s-clothing,,BAD-1,100,M,Cotton",
        "dup-sku,Dup,men-s-clothing,,ser-hydra-30,100,M,Cotton",
      ]),
      { apply: true },
    );
    expect(report.applied).toBe(false);
    expect(await db.product.count()).toBe(before);
    const byLine = (line: number) => report.issues.filter((i) => i.line === line).map((i) => i.message).join(" ");
    expect(byLine(3)).toMatch(/price/);
    expect(byLine(4)).toMatch(/XXL.*not a Size option/);
    expect(byLine(5)).toMatch(/Unknown category_slug/);
    expect(byLine(6)).toMatch(/product_slug/);
    expect(byLine(7)).toMatch(/already used/);
  });

  it("creates and publishes new multi-variant products when the file is valid", async () => {
    const report = await importProductsCsv(
      owner,
      csv([
        "product_slug,title,category_slug,brand_slug,status,sku,price,compare_at,option:size,attr:material,attr:fit",
        "linen-shirt,Linen Shirt,men-s-clothing,thread-and-co,published,LIN-S,1200,1500,S,Washed linen,Relaxed",
        "linen-shirt,Linen Shirt,men-s-clothing,thread-and-co,published,LIN-M,1200,1500,M,Washed linen,Relaxed",
      ]),
      { apply: true },
    );
    expect(report.issues).toEqual([]);
    expect(report.applied).toBe(true);
    const shirt = await db.product.findFirstOrThrow({ where: { businessId, slug: "linen-shirt" }, include: { variants: true, brand: true } });
    expect(shirt.status).toBe("ACTIVE");
    expect(shirt.brand?.slug).toBe("thread-and-co");
    expect(shirt.variants.map((v) => v.sku).sort()).toEqual(["LIN-M", "LIN-S"]);
    expect(shirt.priceFromMinor).toBe(120_000);
    expect(await db.auditLog.count({ where: { action: "catalog.imported" } })).toBe(1);
  });

  it("rejects unknown columns and malformed files up front", async () => {
    const unknown = await importProductsCsv(owner, csv(["product_slug,title,category_slug,sku,price,colour", "a,b,men-s-clothing,X1,1,red"]), { apply: false });
    expect(unknown.issues[0]?.message).toMatch(/Unknown column “colour”/);
    const missing = await importProductsCsv(owner, csv(["title,sku", "a,b"]), { apply: false });
    expect(missing.issues[0]?.message).toMatch(/Missing required columns/);
  });

  it("requires the import permission", async () => {
    const agent = await createStaffActor(businessId, "order_agent");
    await expect(importProductsCsv(agent, "product_slug\n", { apply: false })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
