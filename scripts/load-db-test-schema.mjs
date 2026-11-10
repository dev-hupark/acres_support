import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { connectDatabase } = require('./db-client.cjs');
const ident = value => `"${value.replaceAll('"', '""')}"`;
const relation = table => `public.${ident(table)}`;

// Read metadata and common-code dictionaries only. Never copy member/party rows
// or issue writes to the remote database. No SQL snapshot files are produced.
export async function loadTestSchema(db) {
  const remote = await connectDatabase();
  try {
    await remote.query('begin isolation level repeatable read read only');
    const tables = (await remote.query(`select c.relname as name,c.relrowsecurity as rls,
      has_table_privilege('authenticated',c.oid,'SELECT') as member_read,
      has_table_privilege('anon',c.oid,'SELECT') as anonymous_read
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and left(c.relname,6)='acres_' order by c.relname`)).rows;
    if (!tables.some(t => t.name === 'acres_users')) throw new Error('The connected database does not contain the ACRES schema');
    const names = tables.map(t => t.name);
    const columns = (await remote.query(`select c.relname as table_name,a.attname as name,
      format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as required,
      pg_get_expr(d.adbin,d.adrelid) as default_expression
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
      where n.nspname='public' and c.relname=any($1::text[]) and a.attnum>0 and not a.attisdropped
      order by c.relname,a.attnum`, [names])).rows;
    const constraints = (await remote.query(`select c.relname as table_name,k.conname as name,
      pg_get_constraintdef(k.oid,true) as definition
      from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[])
      order by case when k.contype in ('p','u') then 0 when k.contype='f' then 2 else 1 end,k.conname`, [names])).rows;
    const indexes = (await remote.query(`select pg_get_indexdef(i.indexrelid) as definition from pg_index i
      join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[])
      and not exists(select 1 from pg_constraint k where k.conindid=i.indexrelid)`, [names])).rows;
    const functions = (await remote.query(`select n.nspname as schema_name,p.proname as name,
      pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as member_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.prokind='f' and (n.nspname='acres_private' or (n.nspname='public' and left(p.proname,6)='acres_'))
      order by n.nspname,p.proname`)).rows;
    const policies = (await remote.query(`select c.relname as table_name,p.polname as name,
      p.polpermissive as permissive,p.polcmd as command,pg_get_expr(p.polqual,p.polrelid) as using_expression,
      pg_get_expr(p.polwithcheck,p.polrelid) as check_expression,
      array(select case when role_id=0 then 'PUBLIC' else pg_get_userbyid(role_id)::text end from unnest(p.polroles) as role_id) as roles
      from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=any($1::text[])`, [names])).rows;
    const groups = (await remote.query('select group_code,name from public.acres_code_groups')).rows;
    const codes = (await remote.query('select group_code,code,name,sort_order,status from public.acres_common_codes')).rows;
    await remote.query('rollback');

    // All construction below runs exclusively in the disposable local PGlite DB.
    await db.exec('create schema acres_private; revoke all on schema acres_private from public; grant usage on schema acres_private to authenticated;');
    for (const table of tables) {
      const fields = columns.filter(c => c.table_name === table.name).map(c => `${ident(c.name)} ${c.type}${c.default_expression ? ` default ${c.default_expression}` : ''}${c.required ? ' not null' : ''}`);
      await db.exec(`create table ${relation(table.name)} (${fields.join(',')});`);
    }
    for (const constraint of constraints) await db.exec(`alter table ${relation(constraint.table_name)} add constraint ${ident(constraint.name)} ${constraint.definition};`);
    for (const index of indexes) await db.exec(index.definition);
    await db.exec('set check_function_bodies=off;');
    for (const fn of functions) await db.exec(fn.definition);
    await db.exec('set check_function_bodies=on;');
    for (const table of tables) {
      await db.exec(`revoke all on ${relation(table.name)} from public,anon,authenticated;`);
      if (table.member_read) await db.exec(`grant select on ${relation(table.name)} to authenticated;`);
      if (table.anonymous_read) await db.exec(`grant select on ${relation(table.name)} to anon;`);
      if (table.rls) await db.exec(`alter table ${relation(table.name)} enable row level security;`);
    }
    for (const policy of policies) {
      const commands = { '*': 'ALL', r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE' };
      const roles = policy.roles.map(r => r === 'PUBLIC' ? 'PUBLIC' : ident(r)).join(',');
      await db.exec(`create policy ${ident(policy.name)} on ${relation(policy.table_name)} as ${policy.permissive ? 'permissive' : 'restrictive'} for ${commands[policy.command]} to ${roles}${policy.using_expression ? ` using (${policy.using_expression})` : ''}${policy.check_expression ? ` with check (${policy.check_expression})` : ''};`);
    }
    for (const fn of functions) {
      const signature = `${ident(fn.schema_name)}.${ident(fn.name)}(${fn.arguments})`;
      await db.exec(`revoke all on function ${signature} from public,anon,authenticated;`);
      if (fn.member_execute) await db.exec(`grant execute on function ${signature} to authenticated;`);
      if (fn.anonymous_execute) await db.exec(`grant execute on function ${signature} to anon;`);
    }
    for (const group of groups) await db.query('insert into public.acres_code_groups(group_code,name) values($1,$2)', [group.group_code, group.name]);
    for (const code of codes) await db.query('insert into public.acres_common_codes(group_code,code,name,sort_order,status) values($1,$2,$3,$4,$5)', [code.group_code, code.code, code.name, code.sort_order, code.status]);
    console.log(`Loaded ${tables.length} table definitions into local memory; no remote member or party data copied.`);
  } finally { await remote.query('rollback').catch(() => {}); await remote.end(); }
}
