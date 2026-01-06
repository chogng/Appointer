import { db } from "../src/db/db-adapter.js";

try {
  await db.init();
  console.log("Database initialized.");
  process.exit(0);
} catch (error) {
  console.error("Database init failed:", error);
  process.exit(1);
}
