import { db } from "../src/db/db-adapter.js";
import bcrypt from "bcrypt";

const migrate = async () => {
  await db.init();
  console.log("🔄 Starting password migration...");

  const users = await db.query("SELECT * FROM users");
  let migratedCount = 0;

  for (const user of users) {
    if (!user.password.startsWith("$2b$")) {
      console.log(`🔒 Hashing password for user: ${user.username}`);
      const hashedPassword = await bcrypt.hash(user.password, 10);

      await db.execute("UPDATE users SET password = ? WHERE id = ?", [
        hashedPassword,
        user.id,
      ]);
      migratedCount++;
    }
  }

  console.log(`✅ Migration complete. ${migratedCount} users updated.`);
};

migrate().catch(console.error);
