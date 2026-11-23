// Load the ignored local .env and pass the key through stdin, never command arguments.
require('dotenv').config({ quiet: true });
require('dotenv').config({ path: '.env.groq', quiet: true });
const { spawnSync } = require('node:child_process');
if (!process.env.GROQ_API_KEY?.trim()) {
  console.error('Add GROQ_API_KEY to your ignored .env file first.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'secret', 'put', 'GROQ_API_KEY', '--config', 'wrangler.company.toml'], {
  input: process.env.GROQ_API_KEY.trim() + '\n', stdio: ['pipe', 'inherit', 'inherit'], env: process.env
});
process.exit(result.status ?? 1);
