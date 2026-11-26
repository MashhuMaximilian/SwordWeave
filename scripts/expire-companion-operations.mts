import { pool } from "@/db/client";
import { expireCompanionOperations } from "@/lib/mcp/operations";

try {
  const removed = await expireCompanionOperations();
  console.log(`Removed ${removed} expired companion operations.`);
} catch (error) {
  console.error("Companion operation cleanup failed.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
