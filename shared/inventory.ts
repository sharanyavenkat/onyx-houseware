/**
 * Shared inventory calculation utilities for two-tier inventory model
 * 
 * In this model:
 * - Working Stock = Opening Balance + Expected Receipts (normal operational inventory)
 * - Safety Stock = Buffer inventory that can be used but should be maintained
 * - Usable Stock = Working Stock + Safety Stock (total available to fulfill orders)
 */

export interface InventoryMetrics {
  // Input values
  openingBalance: number;
  expectedReceipts: number;
  pendingQty: number;
  safetyStock: number;
  
  // Calculated values
  workingStock: number;              // opening + expected
  usableStock: number;                // working + safety
  postPendingStock: number;           // usable - pending
  
  // Requirements
  shortfallToFulfill: number;         // How much needed to fulfill pending orders
  shortfallToRestoreSafety: number;   // How much needed to restore safety stock
  totalRequired: number;              // Total to order
  
  // Status flags
  isSafetyBufferBreached: boolean;    // Whether safety stock would be depleted to 0 or below
  safetyStockStatus: 'critical' | 'low' | 'good';
}

/**
 * Calculate inventory metrics for an item
 */
export function calculateInventoryMetrics(
  openingBalance: number,
  expectedReceipts: number,
  pendingQty: number,
  safetyStock: number
): InventoryMetrics {
  // Core calculations
  const workingStock = openingBalance + expectedReceipts;
  const usableStock = workingStock + safetyStock;
  const postPendingStock = usableStock - pendingQty;
  
  // Requirements
  const shortfallToFulfill = Math.max(0, pendingQty - workingStock);
  const shortfallToRestoreSafety = Math.max(0, safetyStock - Math.max(0, postPendingStock));
  const totalRequired = shortfallToFulfill + shortfallToRestoreSafety;
  
  // Status flags
  const isSafetyBufferBreached = postPendingStock <= 0;
  
  let safetyStockStatus: 'critical' | 'low' | 'good' = 'good';
  if (postPendingStock < 0) {
    // Negative stock after using safety buffer - critical
    safetyStockStatus = 'critical';
  } else if (postPendingStock < safetyStock * 0.5) {
    // Less than 50% of safety stock remaining - critical
    safetyStockStatus = 'critical';
  } else if (postPendingStock < safetyStock) {
    // Less than full safety stock remaining - low
    safetyStockStatus = 'low';
  }
  
  return {
    openingBalance,
    expectedReceipts,
    pendingQty,
    safetyStock,
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
