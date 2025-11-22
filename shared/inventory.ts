/**
 * Shared inventory calculation utilities for two-tier inventory model
 * 
 * SIMPLIFIED MODEL (Batch-Driven):
 * - Current Stock = Real-time inventory from batches (single source of truth)
 * - Working Stock = Current Stock + Expected Receipts (normal operational inventory)
 * - Current Safety Stock = Buffer inventory currently available
 * - Desired Safety Stock = Target buffer inventory level we want to maintain
 * - Usable Stock = Working Stock + Current Safety Stock (total available to fulfill orders)
 */

export interface InventoryMetrics {
  // Input values
  currentStock: number;              // Real-time on-hand stock from batches
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
 * @param currentStock - Real-time on-hand stock from batches
 * @param expectedReceipts - Batches expected to arrive this month
 * @param pendingQty - Quantity in pending orders
 * @param currentSafetyStock - Current available safety stock buffer
 * @param desiredSafetyStock - Target safety stock level
 */
export function calculateInventoryMetrics(
  currentStock: number,
  expectedReceipts: number,
  pendingQty: number,
  currentSafetyStock: number,
  desiredSafetyStock: number
): InventoryMetrics {
  // Core calculations - Working Stock = Current Stock + Expected Receipts
  const workingStock = currentStock + expectedReceipts;
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
    currentStock,
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
