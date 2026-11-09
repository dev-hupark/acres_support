// CRA exposes only REACT_APP_*; never copy the server secret into its environment.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local'), quiet: true });
for (const [target, source] of Object.entries({
  REACT_APP_SUPABASE_URL: 'VITE_SUPABASE_URL',
  REACT_APP_SUPABASE_PUBLISHABLE_KEY: 'VITE_SUPABASE_PUBLISHABLE_KEY',
})) {
  if (!process.env[target]) process.env[target] = process.env[source] || '';
}
const command = process.argv[2];
if (!['start', 'build', 'test'].includes(command)) throw new Error('Unsupported command');
process.argv.splice(2, 1);
require(`react-scripts/scripts/${command}`);
