import "dotenv/config";

import express, { type Request, type Response } from "express";
import {
  cacheOrdersToDatabase,
  getTrackingStats,
  getTimestampComparison,
} from "./cacheToDatabase";
import { getOrderByName } from "./getOrderByName";

const app = express();
const port = 3000;

// Global variables for pagination
let paginationInterval: NodeJS.Timeout;
let monitoringInterval: NodeJS.Timeout;
let nextPageUrl: string | null = null;

app.get("/", (request: Request, response: Response) => {
  response.send("It's a nice day");
});

app.get(
  "/getOrderByName/:orderName",
  async (request: Request, response: Response) => {
    try {
      let orderName = request.params.orderName as string;

      if (!orderName) {
        return response
          .status(400)
          .json({ error: "Missing order name in URL" });
      }

      orderName = decodeURIComponent(orderName);

      const order = await getOrderByName(orderName);

      if (!order) {
        return response.status(404).json({ error: "Order not found" });
      }

      response.json(order);
    } catch (error) {
      console.error("Error in /getOrderByName endpoint:", error);
      response.status(500).json({ error: "Internal server error" });
    }
  },
);

app.listen(port, () => {
  console.log(`Fast pufferfish listening on port ${port}`);

  // Phase 1: Historical sync - get all existing orders
  console.log("Starting Phase 1: Historical order sync...");
  paginationInterval = setInterval(async () => {
    try {
      // Use next page URL if available, otherwise use default URL
      const apiUrl =
        nextPageUrl ||
        `https://${process.env.SHOPIFY_SUB_DOMAIN}/admin/api/2025-07/orders.json?status=any&limit=1`;

      const response = await fetch(apiUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_API_KEY!,
        },
      });

      const data = await response.json();

      // Check for Link header with pagination info
      const linkHeader = response.headers.get("link");

      // Parse Link header to find next page URL
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);

        if (nextMatch) {
          nextPageUrl = nextMatch[1];
        } else {
          console.log(
            "No next page URL found - reached end of historical sync",
          );

          // Phase 1 complete, transition to Phase 2
          clearInterval(paginationInterval);
          startPhase2Monitoring();
          return;
        }
      }

      // Process and save orders to database
      if (data.orders && data.orders.length > 0) {
        const successCount = await cacheOrdersToDatabase(data.orders);
        const stats = getTrackingStats();

        console.log(
          `Phase 1 - Cached ${successCount}/${data.orders.length} orders successfully`,
        );
        console.log(`Phase 1 - Total Orders Processed: ${stats.totalOrders}`);
      } else {
        console.log("No orders found in response");
      }
    } catch (error) {
      console.error("Phase 1 API call failed:", error);
    }
  }, 1000);
});

// Phase 2: Continuous monitoring for any new orders
function startPhase2Monitoring() {
  const stats = getTrackingStats();
  const comparison = getTimestampComparison();

  // Use the first timestamp (newest order) for filtering, not latest (oldest)
  let filterTimestamp = comparison.isDescending
    ? comparison.firstTimestamp
    : comparison.latestTimestamp;

  // Add 1 second to the timestamp to avoid re-fetching the same order (because it will constantly fetch the latest order)
  if (filterTimestamp) {
    const filterDate = new Date(filterTimestamp);
    filterDate.setSeconds(filterDate.getSeconds() + 1);
    filterTimestamp = filterDate.toISOString();
  }

  console.log("Starting Phase 2: Continuous new order monitoring...");

  monitoringInterval = setInterval(async () => {
    try {
      const currentStats = getTrackingStats();

      // Build API URL with timestamp filter
      let apiUrl = `https://${process.env.SHOPIFY_SUB_DOMAIN}/admin/api/2025-07/orders.json?status=any&limit=1`;

      if (filterTimestamp) {
        apiUrl += `&created_at_min=${filterTimestamp}`;
      }

      const response = await fetch(apiUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_API_KEY!,
        },
      });

      const data = await response.json();

      // Process new orders if found
      if (data.orders && data.orders.length > 0) {
        console.log(`Found ${data.orders.length} new orders`);

        const successCount = await cacheOrdersToDatabase(data.orders);
        const updatedStats = getTrackingStats();

        console.log(
          `Phase 2 - Cached ${successCount}/${data.orders.length} new orders successfully`,
        );
        console.log(
          `Phase 2 - Total Orders Ever Processed: ${updatedStats.totalOrders}`,
        );
      } else {
        console.log("Phase 2 - No new orders found");
      }
    } catch (error) {
      console.error("Phase 2 monitoring failed:", error);
    }
  }, 60000);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful
  shutdown...`);

  // Clear intervals to stop API polling
  if (paginationInterval) {
    clearInterval(paginationInterval);
    console.log("Stopped Phase 1 polling");
  }

  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    console.log("Stopped Phase 2 monitoring");
  }

  // Close database connections (if needed)
  // db.close() - depends on your DB library

  console.log("Graceful shutdown complete");
  process.exit(0);
}
