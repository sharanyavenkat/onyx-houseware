/**
 * Shared inventory calculation utilities for two-tier inventory model
 * 
 * SIMPLIFIED MODEL (Option A - Batch-Driven):
 * - Current Stock = Real-time inventory from batches (single source of truth)
 * - Working Stock = Current Stock + Expected Receipts (normal operational inventory)
 * - Current Safety Stock = Buffer inventory currently available
 * - Desired Safety Stock = Target buffer inventory level we want to maintain
 * - Usable Stock = Working Stock + Current Safety Stock (total available to fulfill orders)
 * 
 * Note: The first parameter is called "openingBalance" for backward compatibility,
 * but it now represents the current on-hand stock from batches.
 */

export interface InventoryMetrics {
  // Input values
  openingBalance: number;            // Now represents current stock from batches (kept for compatibility)
  expectedReceipts: number;
  pendingQty: number;
  currentSafetyStock: number;
  desiredSafetyStock: number;
  
  // Calculated values
  workingStock: number;              // current stock + expected receipts
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
 * 
 * @param openingBalance - Current stock from batches (parameter name kept for backward compatibility)
 * @param expectedReceipts - Batches expected to arrive this month
 * @param pendingQty - Quantity in pending orders
 * @param currentSafetyStock - Current available safety stock buffer
 * @param desiredSafetyStock - Target safety stock level
 */
export function calculateInventoryMetrics(
  openingBalance: number,            // Actually current stock from batches
  expectedReceipts: number,
  pendingQty: number,
  currentSafetyStock: number,
  desiredSafetyStock: number
): InventoryMetrics {
  // Core calculations - Working Stock = Current Stock + Expected Receipts
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
