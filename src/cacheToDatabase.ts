import { db } from "../db/connection";
import { orders } from "../db/schema";

// Types for Shopify order data
interface ShopifyOrder {
  id: number;
  name?: string;
  order_number?: number;
  created_at?: string;
  [key: string]: any;
}

// Global tracking variables
export const productIds: number[] = [];
export let latestTimestamp: string | null = null;
export let firstTimestamp: string | null = null;

// Cache a single order to the database
export async function cacheOrderToDatabase(
  order: ShopifyOrder,
): Promise<boolean> {
  try {
    // Always add to tracking array and update timestamp (even if DB fails)
    productIds.push(order.id);

    if (order.created_at) {
      // Track first timestamp (earliest date)
      if (
        !firstTimestamp ||
        new Date(order.created_at) < new Date(firstTimestamp)
      ) {
        firstTimestamp = order.created_at;
      }

      // Track latest timestamp (most recent date)
      if (
        !latestTimestamp ||
        new Date(order.created_at) > new Date(latestTimestamp)
      ) {
        latestTimestamp = order.created_at;
      }
    }

    await db
      .insert(orders)
      .values({
        orderId: order.id.toString(),
        name: order.name || `Order #${order.order_number || order.id}`,
      })
      .onConflictDoNothing();

    console.log(
      `Saved Order ID: ${order.id}, Name: ${order.name || "N/A"} to database`,
    );
    return true;
  } catch (error) {
    console.error(
      `Database save failed for order ${order.id}, but continuing with in-memory tracking:`,
      error,
    );
    // Still return true since we have in-memory tracking
    return true;
  }
}

// Cache multiple orders to the database
export async function cacheOrdersToDatabase(
  orders: ShopifyOrder[],
): Promise<number> {
  let successCount = 0;

  for (const order of orders) {
    const success = await cacheOrderToDatabase(order);
    if (success) {
      successCount++;
    }
  }

  return successCount;
}

// Get current tracking stats
export function getTrackingStats() {
  return {
    totalOrders: productIds.length,
    firstTimestamp,
    latestTimestamp,
    allOrderIds: [...productIds],
  };
}

// Get timestamp comparison info
export function getTimestampComparison() {
  if (!firstTimestamp || !latestTimestamp) {
    return {
      firstTimestamp,
      latestTimestamp,
      timeDifference: null,
      daysDifference: null,
    };
  }

  const firstDate = new Date(firstTimestamp);
  const lastDate = new Date(latestTimestamp);
  const timeDifference = lastDate.getTime() - firstDate.getTime();
  const daysDifference = Math.round(timeDifference / (1000 * 60 * 60 * 24));

  return {
    firstTimestamp,
    latestTimestamp,
    timeDifference,
    daysDifference,
    isDescending: firstDate > lastDate, // true if orders are coming in reverse chronological order
  };
}

// Update the latest timestamp (for Phase 2 monitoring)
export function updateLatestTimestamp(timestamp: string) {
  latestTimestamp = timestamp;
}

// Reset tracking (if needed for testing)
export function resetTracking() {
  productIds.length = 0;
  latestTimestamp = null;
  firstTimestamp = null;
}
