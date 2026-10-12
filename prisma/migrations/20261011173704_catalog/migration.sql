-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('NONE', 'BATCH_EXPIRY', 'SERIAL');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'VARIANT');

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "unit" TEXT,
    "helpText" TEXT,
    "isVariantAxis" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT false,
    "validation" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_options" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "colorHex" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "attribute_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultTrackingMode" "TrackingMode" NOT NULL DEFAULT 'NONE',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attributes" (
    "categoryId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("categoryId","attributeId")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_classes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tax_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "brandId" TEXT,
    "primaryCategoryId" TEXT NOT NULL,
    "taxClassId" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'SIMPLE',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "trackingMode" "TrackingMode" NOT NULL DEFAULT 'NONE',
    "baseSku" TEXT,
    "returnPolicyNote" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "firstPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DECIMAL(18,4),
    "dateValue" DATE,
    "booleanValue" BOOLEAN,
    "optionId" TEXT,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "title" TEXT NOT NULL,
    "combinationKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "costMinor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_option_values" (
    "variantId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "variant_option_values_pkey" PRIMARY KEY ("variantId","attributeId")
);

-- CreateTable
CREATE TABLE "price_lists" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BDT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_prices" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "compareAtMinor" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_businessId_code_key" ON "attribute_definitions"("businessId", "code");

-- CreateIndex
CREATE INDEX "attribute_options_attributeId_sortOrder_idx" ON "attribute_options"("attributeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_options_attributeId_value_key" ON "attribute_options"("attributeId", "value");

-- CreateIndex
CREATE INDEX "categories_businessId_parentId_sortOrder_idx" ON "categories"("businessId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_businessId_slug_key" ON "categories"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_businessId_slug_key" ON "brands"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "tax_classes_businessId_code_key" ON "tax_classes"("businessId", "code");

-- CreateIndex
CREATE INDEX "products_businessId_status_publishedAt_idx" ON "products"("businessId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "products_primaryCategoryId_status_idx" ON "products"("primaryCategoryId", "status");

-- CreateIndex
CREATE INDEX "products_brandId_status_idx" ON "products"("brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_businessId_slug_key" ON "products"("businessId", "slug");

-- CreateIndex
CREATE INDEX "product_categories_categoryId_idx" ON "product_categories"("categoryId");

-- CreateIndex
CREATE INDEX "product_attribute_values_productId_idx" ON "product_attribute_values"("productId");

-- CreateIndex
CREATE INDEX "product_attribute_values_attributeId_optionId_idx" ON "product_attribute_values"("attributeId", "optionId");

-- CreateIndex
CREATE INDEX "product_attribute_values_attributeId_numberValue_idx" ON "product_attribute_values"("attributeId", "numberValue");

-- CreateIndex
CREATE INDEX "product_variants_productId_position_idx" ON "product_variants"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_businessId_sku_key" ON "product_variants"("businessId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_businessId_barcode_key" ON "product_variants"("businessId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_combinationKey_key" ON "product_variants"("productId", "combinationKey");

-- CreateIndex
CREATE INDEX "variant_option_values_attributeId_optionId_idx" ON "variant_option_values"("attributeId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "price_lists_businessId_code_key" ON "price_lists"("businessId", "code");

-- CreateIndex
CREATE INDEX "variant_prices_priceListId_amountMinor_idx" ON "variant_prices"("priceListId", "amountMinor");

-- CreateIndex
CREATE UNIQUE INDEX "variant_prices_priceListId_variantId_key" ON "variant_prices"("priceListId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "product_media_storageKey_key" ON "product_media"("storageKey");

-- CreateIndex
CREATE INDEX "product_media_productId_sortOrder_idx" ON "product_media"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_classes" ADD CONSTRAINT "tax_classes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_taxClassId_fkey" FOREIGN KEY ("taxClassId") REFERENCES "tax_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_values" ADD CONSTRAINT "variant_option_values_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_prices" ADD CONSTRAINT "variant_prices_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_prices" ADD CONSTRAINT "variant_prices_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity guards the ORM cannot express
-- ---------------------------------------------------------------------------
ALTER TABLE "variant_prices"
  ADD CONSTRAINT "variant_prices_amount_check" CHECK ("amountMinor" >= 0),
  ADD CONSTRAINT "variant_prices_compare_at_check" CHECK ("compareAtMinor" IS NULL OR "compareAtMinor" > "amountMinor");

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_cost_check" CHECK ("costMinor" IS NULL OR "costMinor" >= 0),
  ADD CONSTRAINT "product_variants_weight_check" CHECK ("weightGrams" IS NULL OR "weightGrams" >= 0);

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_not_own_parent_check" CHECK ("parentId" IS NULL OR "parentId" <> "id");

ALTER TABLE "tax_classes"
  ADD CONSTRAINT "tax_classes_rate_check" CHECK ("rateBasisPoints" >= 0 AND "rateBasisPoints" <= 10000);

-- At most one default price list and one default tax class per business.
CREATE UNIQUE INDEX "price_lists_one_default_per_business" ON "price_lists" ("businessId") WHERE "isDefault";
CREATE UNIQUE INDEX "tax_classes_one_default_per_business" ON "tax_classes" ("businessId") WHERE "isDefault";

-- Product search (FR-CAT-02): trigram indexes make ILIKE '%term%' on titles and SKUs fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "products_title_trgm" ON "products" USING GIN (lower("title") gin_trgm_ops);
CREATE INDEX "product_variants_sku_trgm" ON "product_variants" USING GIN (lower("sku") gin_trgm_ops);
