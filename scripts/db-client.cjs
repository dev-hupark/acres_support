// Node-only database connection. This module must never be imported from src/.
const fs = require('node:fs');
const path = require('node:path');
const { X509Certificate } = require('node:crypto');
const { Client } = require('pg');

async function connectDatabase() {
  const env = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../.env.local')));
  const raw = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
  if (!raw) throw new Error('SUPABASE_DB_URL is missing');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected PostgreSQL URL');
  // Keep certificate and hostname verification enabled, including with sslmode=require.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const response = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Could not download the Supabase CA certificate');
  const ca = await response.text();
  const certificate = new X509Certificate(ca);
  if (!certificate.ca || !certificate.subject.includes('Supabase')) throw new Error('Unexpected CA certificate');
  const client = new Client({ connectionString: url.toString(), ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 12000, query_timeout: 30000, application_name: 'acres_schema_management' });
  try { await client.connect(); return client; }
  catch (error) { await client.end().catch(() => {}); throw error; }
}
module.exports = { connectDatabase };
