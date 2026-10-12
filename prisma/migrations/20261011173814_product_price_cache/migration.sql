-- AlterTable
ALTER TABLE "products" ADD COLUMN     "compareAtFromMinor" INTEGER,
ADD COLUMN     "priceFromMinor" INTEGER;

-- CreateIndex
CREATE INDEX "products_businessId_status_priceFromMinor_idx" ON "products"("businessId", "status", "priceFromMinor");
