/**
 * Shared inventory calculation utilities for two-tier inventory model
 * 
 * In this model:
 * - Working Stock = Opening Balance + Expected Receipts (normal operational inventory)
 * - Current Safety Stock = Buffer inventory currently available
 * - Desired Safety Stock = Target buffer inventory level we want to maintain
 * - Usable Stock = Working Stock + Current Safety Stock (total available to fulfill orders)
 */

export interface InventoryMetrics {
  // Input values
  openingBalance: number;
  expectedReceipts: number;
  pendingQty: number;
  currentSafetyStock: number;
  desiredSafetyStock: number;
  
  // Calculated values
  workingStock: number;              // opening + expected
  usableStock: number;                // working + current safety stock
  postPendingStock: number;           // usable - pending
  
  // Requirements
  shortfallToFulfill: number;         // How much needed to fulfill pending orders
  shortfallToRestoreSafety: number;   // How much needed to restore to DESIRED safety stock level
  totalRequired: number;              // Total to order
  
  // Status flags
  isSafetyBufferBreached: boolean;    // Whether safety stock would be depleted to 0 or below
  safetyStockStatus: 'critical' | 'low' | 'good';
}

/**
 * Calculate inventory metrics for an item with two-tier safety stock model
 */
export function calculateInventoryMetrics(
  openingBalance: number,
  expectedReceipts: number,
  pendingQty: number,
  currentSafetyStock: number,
  desiredSafetyStock: number
): InventoryMetrics {
  // Core calculations
  const workingStock = openingBalance + expectedReceipts;
  const usableStock = workingStock + currentSafetyStock;
  const postPendingStock = usableStock - pendingQty;
  
  // Requirements
  // Shortfall to fulfill uses USABLE stock (including current safety stock), not just working stock
  const shortfallToFulfill = Math.max(0, pendingQty - usableStock);
  // Shortfall to restore uses DESIRED safety stock as the target
  const shortfallToRestoreSafety = Math.max(0, desiredSafetyStock - Math.max(0, postPendingStock));
  const totalRequired = shortfallToFulfill + shortfallToRestoreSafety;
  
  // Status flags
  const isSafetyBufferBreached = postPendingStock <= 0;
  
  let safetyStockStatus: 'critical' | 'low' | 'good' = 'good';
  if (postPendingStock < 0) {
    // Negative stock - cannot fulfill orders even with safety buffer - CRITICAL
    safetyStockStatus = 'critical';
  } else if (postPendingStock < desiredSafetyStock * 0.5) {
    // Can fulfill orders but less than 50% of desired safety stock remaining - low
    safetyStockStatus = 'low';
  } else if (postPendingStock < desiredSafetyStock) {
    // Can fulfill orders but less than full desired safety stock remaining - low
    safetyStockStatus = 'low';
  }
  
  return {
    openingBalance,
    expectedReceipts,
    pendingQty,
    currentSafetyStock,
    desiredSafetyStock,
    workingStock,
    usableStock,
    postPendingStock,
    shortfallToFulfill,
    shortfallToRestoreSafety,
    totalRequired,
    isSafetyBufferBreached,
    safetyStockStatus,
  };
}
