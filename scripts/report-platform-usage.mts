/** Read-only report. Never prints database URLs, private entity payloads or user IDs.
 * pnpm usage:report -- --env .env.local --out .local-plans/usage-report.json */
import { config } from "dotenv";
import { Pool,neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { writeFileSync } from "node:fs";
import { list } from "@vercel/blob";
import { estimateBenchmark, type StorageSample } from "../src/lib/operations/storage-benchmark";
const args=process.argv.slice(2);const arg=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
config({path:arg("--env")??".env.local",quiet:true});neonConfig.webSocketConstructor=ws;
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try {
 const size=await pool.query("SELECT pg_database_size(current_database())::float8 AS bytes");
 const tables=await pool.query(`SELECT relname AS name, pg_relation_size(relid)::float8 AS heap, pg_indexes_size(relid)::float8 AS indexes, pg_total_relation_size(relid)::float8 AS total, (SELECT count(*) FROM pg_index i WHERE i.indrelid=relid)::int AS index_count, n_live_tup::float8 AS rows FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(relid) DESC`);
 const samples:StorageSample[]=[];
 for(const row of tables.rows) {
  const table=String(row.name).replaceAll('"','""');
  const r=await pool.query(`SELECT COALESCE(avg(pg_column_size(t)),0)::float8 AS bytes FROM (SELECT * FROM "${table}" LIMIT 500) t`);
  samples.push({name:row.name,rows:Number(row.rows),heapBytes:Number(row.heap),indexBytes:Number(row.indexes),totalBytes:Number(row.total),averageRowBytes:Number(r.rows[0].bytes),indexCount:Number(row.index_count)});
 }
 const allowance=Number(arg("--db-allowance-bytes"));const used=Number(size.rows[0].bytes);const fraction=allowance>0?used/allowance:null;
 let blobInventory:unknown=null;
 if(args.includes('--blob') && process.env.BLOB_READ_WRITE_TOKEN){
  let cursor:string|undefined;let count=0,bytes=0,pages=0;const groups:Record<string,{count:number;bytes:number}>={};let more=false;
  do {const result=await list({limit:1000,cursor});pages++;for(const object of result.blobs){const group=object.pathname.startsWith('user-uploads/')?'private-user-uploads':object.pathname.startsWith('images/')?'legacy-catalog-art':'other';groups[group]??={count:0,bytes:0};groups[group].count++;groups[group].bytes+=object.size;count++;bytes+=object.size;}cursor=result.cursor;more=result.hasMore;}while(more&&pages<20);
  blobInventory={count,bytes,pages,complete:!more,groups,uploadPolicy:'New user uploads use private Blob access; legacy object permissions must remain unchanged during any future migration.'};
 }
 const report={measuredAt:new Date().toISOString(),databaseBytes:used,databaseAllowanceBytes:allowance>0?allowance:null,storageAction:fraction===null?"Verify effective integration allowance":fraction>=.75?"Take action":fraction>=.5?"Review growth":"Within reviewed thresholds",tables:samples,blobInventory,benchmarks:[1,3,5].map(n=>estimateBenchmark(samples,1000,n)),providerChecklist:["Vercel: function/CPU/CDN/transfer, deployment storage and Blob usage separately", "Neon: effective Vercel-managed storage/compute allowance, branch count and restore history separately", "Cloudflare: R2 Standard bytes/Class A/Class B and Worker requests/CPU separately", "Clerk: current plan and monthly retained user allowance"],limitations:["Table row counts are PostgreSQL statistics; ANALYZE freshness affects density estimates.","Provider account/project allowance and billing usage require dashboard verification; databaseBytes covers this database only."]};
 if(arg("--out"))writeFileSync(arg("--out")!,JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify(report,null,2));
}finally{await pool.end();}
