import path from 'node:path';
import { createAppServer } from './server.js';

const port = Number(process.env.PORT ?? 8788);
const dbFile = process.env.PBM_DB_FILE ?? path.resolve('data/fotobiomodulacao.sqlite');
const app = await createAppServer({ dbFile, port });
console.log(`Fotobiomodulação F0 disponível em ${app.url}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
