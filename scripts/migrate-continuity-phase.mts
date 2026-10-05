/** Applies only this phase's additive migrations. Default is a rollback dry run.
 * pnpm exec tsx scripts/migrate-continuity-phase.mts --env <env> [--apply]
 * Rollback after release: redeploy the prior app; preserve these additive tables.
 */
import { config } from 'dotenv';
import { Client, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const envFlag=process.argv.indexOf('--env');
config({path:envFlag>=0 ? process.argv[envFlag+1] : '.env.local',quiet:true});
neonConfig.webSocketConstructor=ws;
const client=new Client({connectionString:process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL});
const journal=JSON.parse(readFileSync('src/db/migrations/meta/_journal.json','utf8')).entries.filter((e:{idx:number})=>e.idx>=69&&e.idx<=72);
const apply=process.argv.includes('--apply');
await client.connect();
try {
 await client.query('BEGIN');
 for(const entry of journal)await client.query(readFileSync(`src/db/migrations/${entry.tag}.sql`,'utf8'));
 // Exercise new schema and cleanup with disposable, private fixtures.
 const cid=randomUUID(),a=randomUUID(),b=randomUUID(),mid=randomUUID(),copy=randomUUID(),op=randomUUID();
 await client.query(`INSERT INTO characters(id,user_id,name,attr_physical,attr_mental,attr_magical) VALUES($1,'phase-migration-check','Migration check',4,3,3)`,[cid]);
 await client.query(`INSERT INTO play_states(subject_kind,subject_id) VALUES('CHARACTER',$1)`,[cid]);
 await client.query(`INSERT INTO play_state_operations(subject_kind,subject_id,op_id,request_hash,revision,expires_at) VALUES('CHARACTER',$1,$2,'check',0,now())`,[cid,op]);
 await client.query('DELETE FROM characters WHERE id=$1',[cid]);
 const leftovers=await client.query('SELECT (SELECT count(*) FROM play_states WHERE subject_id=$1)+(SELECT count(*) FROM play_state_operations WHERE subject_id=$1) AS total',[cid]);
 if(Number(leftovers.rows[0].total))throw new Error('Character deletion left play state');
 await client.query(`INSERT INTO collections(id,owner_id,name) VALUES($1,'phase-migration-check','Parent')`,[a]);
 await client.query(`INSERT INTO collections(id,owner_id,name,parent_id) VALUES($1,'phase-migration-check','Child',$2)`,[b,a]);
 await client.query('SAVEPOINT cycle_check');
 let rejected=false;try{await client.query('UPDATE collections SET parent_id=$1 WHERE id=$2',[b,a]);}catch{rejected=true;}
 await client.query('ROLLBACK TO SAVEPOINT cycle_check');if(!rejected)throw new Error('Collection cycle allowed');
 await client.query('SAVEPOINT owner_check');rejected=false;
 try{await client.query(`UPDATE collections SET owner_id='another-user' WHERE id=$1`,[b]);}catch{rejected=true;}
 await client.query('ROLLBACK TO SAVEPOINT owner_check');if(!rejected)throw new Error('Cross-owner parent allowed');
 await client.query('DELETE FROM collections WHERE id=$1',[b]);await client.query('DELETE FROM collections WHERE id=$1',[a]);
 await client.query(`INSERT INTO monsters(id,user_id,name,definition) VALUES($1,'phase-migration-check','Check','{}')`,[mid]);
 const version=await client.query(`INSERT INTO monster_versions(monster_id,version,definition) VALUES($1,1,'{}') RETURNING id`,[mid]);
 await client.query(`INSERT INTO monster_copies(id,user_id,name,template_id,template_version,template_version_id,current_vitality) VALUES($1,'phase-migration-check','Check',$2,1,$3,1)`,[copy,mid,version.rows[0].id]);
 await client.query('SAVEPOINT pin_check');rejected=false;
 try{await client.query('DELETE FROM monster_versions WHERE id=$1',[version.rows[0].id]);}catch{rejected=true;}
 await client.query('ROLLBACK TO SAVEPOINT pin_check');if(!rejected)throw new Error('Referenced monster version could be deleted');
 await client.query('DELETE FROM monster_copies WHERE id=$1',[copy]);await client.query('DELETE FROM monsters WHERE id=$1',[mid]);
 if(apply){
  for(const entry of journal)await client.query('INSERT INTO drizzle.__drizzle_migrations(id,hash,created_at) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[entry.idx,entry.tag,entry.when]);
  await client.query('COMMIT');console.log('Applied migrations 0069–0072; fixture checks passed and fixtures removed.');
 }else{await client.query('ROLLBACK');console.log('Rollback dry run passed: schema, cycle/owner constraints, character state cleanup, monster version retention; no changes retained.');}
}catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
