-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_BALANCE', 'RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'RESERVE', 'RELEASE', 'SALE', 'RETURN_RESTOCK');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('STAFF', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "codEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "codMaxOrderMinor" INTEGER,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "vatRegistrationNumber" TEXT;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "lowStockThreshold" INTEGER,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "shipping_zones" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districts" TEXT[],
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "baseFeeMinor" INTEGER NOT NULL,
    "includedWeightGrams" INTEGER NOT NULL DEFAULT 1000,
    "extraPerKgMinor" INTEGER NOT NULL DEFAULT 0,
    "freeShippingThresholdMinor" INTEGER,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "estimate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "onHandDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "onHandAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "unitCostMinor" INTEGER,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "actorType" "ActorKind" NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("businessId","key")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "orderedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "unitCostMinor" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "notes" TEXT,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCostMinor" INTEGER NOT NULL,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipping_zones_businessId_isActive_idx" ON "shipping_zones"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_businessId_code_key" ON "warehouses"("businessId", "code");

-- CreateIndex
CREATE INDEX "stock_balances_variantId_idx" ON "stock_balances"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_warehouseId_variantId_key" ON "stock_balances"("warehouseId", "variantId");

-- CreateIndex
CREATE INDEX "stock_movements_variantId_createdAt_idx" ON "stock_movements"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_businessId_createdAt_idx" ON "stock_movements"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_sourceType_sourceId_idx" ON "stock_movements"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "suppliers_businessId_isActive_idx" ON "suppliers"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "purchase_orders_businessId_status_createdAt_idx" ON "purchase_orders"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_businessId_number_key" ON "purchase_orders"("businessId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchaseOrderId_variantId_key" ON "purchase_order_items"("purchaseOrderId", "variantId");

-- CreateIndex
CREATE INDEX "goods_receipts_businessId_receivedAt_idx" ON "goods_receipts"("businessId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_businessId_number_key" ON "goods_receipts"("businessId", "number");

-- AddForeignKey
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integrity guards
-- ---------------------------------------------------------------------------
-- Stock can never go negative and reservations can never exceed what is on hand (prevents overselling).
ALTER TABLE "stock_balances"
  ADD CONSTRAINT "stock_balances_non_negative" CHECK ("onHand" >= 0 AND "reserved" >= 0),
  ADD CONSTRAINT "stock_balances_reserved_le_on_hand" CHECK ("reserved" <= "onHand");

-- The stock ledger is append-only.
CREATE OR REPLACE FUNCTION reject_stock_movement_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only (% rejected)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON "stock_movements"
  FOR EACH ROW EXECUTE FUNCTION reject_stock_movement_mutation();

ALTER TABLE "shipping_zones"
  ADD CONSTRAINT "shipping_zones_fees_check" CHECK (
    "baseFeeMinor" >= 0 AND "extraPerKgMinor" >= 0 AND "codFeeMinor" >= 0 AND "includedWeightGrams" >= 0
    AND ("freeShippingThresholdMinor" IS NULL OR "freeShippingThresholdMinor" >= 0));
CREATE UNIQUE INDEX "shipping_zones_one_active_fallback" ON "shipping_zones" ("businessId") WHERE "isFallback" AND "isActive";

CREATE UNIQUE INDEX "warehouses_one_default_per_business" ON "warehouses" ("businessId") WHERE "isDefault";

ALTER TABLE "purchase_order_items"
  ADD CONSTRAINT "purchase_order_items_quantities_check" CHECK ("quantityOrdered" > 0 AND "quantityReceived" >= 0 AND "unitCostMinor" >= 0);
ALTER TABLE "goods_receipt_items"
  ADD CONSTRAINT "goods_receipt_items_check" CHECK ("quantity" > 0 AND "unitCostMinor" >= 0);
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_low_stock_check" CHECK ("lowStockThreshold" IS NULL OR "lowStockThreshold" >= 0);
ALTER TABLE "business_settings"
  ADD CONSTRAINT "business_settings_cod_max_check" CHECK ("codMaxOrderMinor" IS NULL OR "codMaxOrderMinor" > 0);
