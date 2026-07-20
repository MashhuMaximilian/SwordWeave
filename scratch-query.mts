import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
const sql = neon(url);

const rows = await sql`
  SELECT p.id, p.user_id, u.username, u.display_name, u.avatar_url
  FROM primitives p
  LEFT JOIN users u ON u.clerk_user_id = p.user_id
  WHERE p.user_id IS NOT NULL
  LIMIT 8
`;
console.log(JSON.stringify(rows, null, 2));
