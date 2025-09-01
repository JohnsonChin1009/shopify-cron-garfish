import { db } from "../db/connection";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";
import { orders } from "../db/schema";

dotenv.config();

export async function getOrderByName(name: string) {
  try {
    const result = await db
      .select({ id: orders.orderId })
      .from(orders)
      .where(eq(orders.name, name))
      .limit(1);

    if (!result || result.length === 0) {
      return null;
    }

    const orderId = result[0].id;

    const response = await fetch(
      `https://${process.env.SHOPIFY_SUB_DOMAIN}/admin/api/2025-07/orders/${orderId}.json?fields=id%2Cline_items%2Cname%2Ctotal_price`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    return data.order;
  } catch (error) {
    console.error("Error fetching order by name:", error);
    throw error;
  }
}
