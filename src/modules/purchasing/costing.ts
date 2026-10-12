/**
 * Moving weighted average unit cost (D-016): after receiving `qty` units at `unitCost`,
 *   newCost = (onHandBefore × currentCost + qty × unitCost) / (onHandBefore + qty)
 * rounded to the nearest minor unit. Without a usable prior cost or stock, the receipt cost wins.
 */
export function movingAverageCost(onHandBefore: number, currentCostMinor: number | null, quantity: number, unitCostMinor: number): number {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError("quantity must be a positive integer");
  if (currentCostMinor === null || onHandBefore <= 0) return unitCostMinor;
  return Math.round((onHandBefore * currentCostMinor + quantity * unitCostMinor) / (onHandBefore + quantity));
}
