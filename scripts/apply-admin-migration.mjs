import fs from "node:fs/promises";
import pg from "pg";

const connectionString=process.env.DATABASE_URL;
if(!connectionString) throw new Error("DATABASE_URL não configurada para a migração.");
const client=new pg.Client({connectionString,ssl:connectionString.includes("localhost")?undefined:{rejectUnauthorized:false}});
await client.connect();
try{
  await client.query("SELECT pg_advisory_lock(734627301)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const name="004_admin_managed_accounts.sql";
  const applied=await client.query("SELECT 1 FROM schema_migration WHERE name=$1",[name]);
  if(!applied.rowCount){
    const sql=await fs.readFile(new URL(`../database/migrations/${name}`,import.meta.url),"utf8");
    await client.query(sql);
    await client.query("INSERT INTO schema_migration(name) VALUES($1) ON CONFLICT DO NOTHING",[name]);
    console.info(`Migração aplicada: ${name}`);
  }else console.info(`Migração já aplicada: ${name}`);
}finally{
  await client.query("SELECT pg_advisory_unlock(734627301)").catch(()=>{});
  await client.end();
}
