import fs from 'node:fs';
import path from 'node:path';
import { createAppServer } from '../src/app/server.js';

const tempDir = path.resolve('.tmp');
const dbFile = path.join(tempDir, 'e2e.sqlite');
fs.mkdirSync(tempDir, { recursive: true });
fs.rmSync(dbFile, { force: true });
const app = await createAppServer({ dbFile, port: 8788 });
console.log(`E2E server at ${app.url}`);

async function shutdown() {
  await app.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
