import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const db = drizzle(
  new Pool({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'admin',
  }),
);
