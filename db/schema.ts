import { pgTable, varchar } from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  orderId: varchar("order_id", { length: 256 }).primaryKey(),
  name: varchar("name", { length: 256 }),
});
