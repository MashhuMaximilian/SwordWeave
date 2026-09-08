/* Apply only the additive workspace release migration, atomically. Credentials
 * come from the runtime environment and are never written to the release log. */
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const {Client}=require('@neondatabase/serverless');
require('@next/env').loadEnvConfig(process.cwd());
async function main(){
 const entry=JSON.parse(readFileSync('src/db/migrations/meta/_journal.json','utf8')).entries.find(entry=>entry.tag==='0058_character_workspace_consequences');
 const sql=readFileSync(`src/db/migrations/${entry.tag}.sql`,'utf8');
 const client=new Client({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL});await client.connect();
 try{
  const journal=await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS name");
  const existing=journal.rows[0].name?(await client.query('SELECT id,hash FROM drizzle.__drizzle_migrations WHERE id=$1',[entry.idx])).rows[0]:null;
  if(existing&&existing.hash!==entry.tag)throw new Error('Migration journal entry is occupied by another migration.');
  console.log(JSON.stringify({database:new URL(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL).pathname.slice(1),migration:entry.tag,sha256:createHash('sha256').update(sql).digest('hex'),alreadyApplied:!!existing,mode:process.argv.includes('--apply')?'apply':'check'}));
  if(!process.argv.includes('--apply'))return;
  const before=(await client.query("SELECT user_id,content_hash FROM heritage WHERE id='cc803578-a681-4a61-9054-9e5716ccc9c2'")).rows;
  await client.query('BEGIN');
  try {
   await client.query("SET LOCAL lock_timeout='5s'");
   await client.query("SELECT pg_advisory_xact_lock(hashtext('swordweave:migrations'))");
   for(const statement of sql.split('--> statement-breakpoint'))if(statement.trim())await client.query(statement);
   await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
   await client.query('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY,hash TEXT NOT NULL,created_at BIGINT NOT NULL)');
   await client.query('INSERT INTO drizzle.__drizzle_migrations (id,hash,created_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',[entry.idx,entry.tag,entry.when]);
   const after=(await client.query("SELECT user_id,content_hash FROM heritage WHERE id='cc803578-a681-4a61-9054-9e5716ccc9c2'")).rows;
   if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Heritage ownership/content invariant changed.');
   await client.query('COMMIT');console.log('Migration committed; existing heritage ownership and content preserved.');
  }catch(error){await client.query('ROLLBACK');throw error;}
 }finally{await client.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
