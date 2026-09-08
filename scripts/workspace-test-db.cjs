/** Isolated verification database. Credentials stay in the child environment.
 * Usage: node scripts/workspace-test-db.cjs setup
 *        node scripts/workspace-test-db.cjs run npx vitest run ...
 *        node scripts/workspace-test-db.cjs run npx next dev --port 3100
 */
require('@next/env').loadEnvConfig(process.cwd());
const { spawnSync, spawn } = require('node:child_process');
const { writeFileSync, readFileSync } = require('node:fs');
const production = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const name = 'sw_workspace_verify_20260908';
const isolated = new URL(production); isolated.pathname = '/' + name;
const bin = '/opt/homebrew/opt/libpq/bin/';
function run(exe, args, input) {
  const result = spawnSync(bin + exe, args, { input, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
  if (result.status !== 0) throw new Error((result.stderr || 'Database command failed').replaceAll(production, '[database]').replaceAll(isolated.href, '[isolated database]'));
  return result.stdout;
}
if (process.argv[2] === 'setup') {
  const exists = run('psql', ['-d', production, '-XAtc', `SELECT 1 FROM pg_database WHERE datname = '${name}'`]).trim();
  if (!exists) run('psql', ['-d', production, '-X', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${name}`]);
  const initialized = run('psql', ['-d', isolated.href, '-XAtc', "SELECT to_regclass('public.characters') IS NOT NULL"]).trim() === 't';
  if (!initialized) {
    const ddl = run('pg_dump', ['--dbname', production, '--schema-only', '--schema=public', '--no-owner', '--no-privileges']);
    run('psql', ['-d', isolated.href, '-X', '-v', 'ON_ERROR_STOP=1'], ddl.replace('CREATE SCHEMA public;', 'CREATE SCHEMA IF NOT EXISTS public;'));
    writeFileSync('/tmp/swordweave-workspace-schema.sql', ddl, { mode: 0o600 });
  }
  const migration = readFileSync('src/db/migrations/0058_character_workspace_consequences.sql', 'utf8');
  run('psql', ['-d', isolated.href, '-X', '-v', 'ON_ERROR_STOP=1'], 'BEGIN;\n' + migration + '\nCOMMIT;');
  run('psql', ['-d', isolated.href, '-X', '-v', 'ON_ERROR_STOP=1'], 'BEGIN;\n' + migration + '\nCOMMIT;');
  console.log('Isolated schema ready; additive migration applied twice successfully. No character data copied.');
} else if (process.argv[2] === 'run') {
  const [command, ...args] = process.argv.slice(3);
  if (!command) throw new Error('A command is required.');
  const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, DATABASE_URL: isolated.href, DATABASE_URL_UNPOOLED: isolated.href, WORKSPACE_TEST_DATABASE: name } });
  child.on('exit', code => process.exit(code ?? 1));
} else throw new Error('Use setup or run.');
