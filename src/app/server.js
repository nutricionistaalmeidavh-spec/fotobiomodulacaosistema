import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db/database.js';
import { createF0Service } from './f0-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');
const contentTypes = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'
});

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 128 * 1024) throw new Error('Request body is too large');
  return JSON.parse(raw);
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(publicDir, requested);
  if (!filePath.startsWith(`${path.resolve(publicDir)}${path.sep}`) && filePath !== path.join(publicDir, 'index.html')) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.writeHead(200, {
    'content-type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
    'cache-control': 'no-store'
  });
  fs.createReadStream(filePath).pipe(response);
}

export async function createAppServer({ dbFile = path.resolve('data/fotobiomodulacao.sqlite'), port = 8788 } = {}) {
  if (dbFile !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
  const db = openDatabase(dbFile);
  const service = createF0Service(db);
  service.ensureSeedData();
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    try {
      if (request.method === 'GET' && url.pathname === '/api/status') return sendJson(response, 200, service.getStatus());
      if (request.method === 'GET' && url.pathname === '/api/patients') return sendJson(response, 200, { patients: service.listPatients() });
      if (request.method === 'GET' && url.pathname === '/api/equipment') return sendJson(response, 200, { equipment: service.listEquipment() });
      if (request.method === 'GET' && url.pathname === '/api/protocols') {
        const protocols = service.listProtocols().map((protocol) => ({ ...protocol, versions: service.listProtocolVersions(protocol.id) }));
        return sendJson(response, 200, { protocols });
      }
      if (request.method === 'POST' && url.pathname === '/api/protocols') {
        const body = await readJson(request);
        const protocol = service.createProtocol(body);
        return sendJson(response, 201, { protocol: { ...protocol, versions: service.listProtocolVersions(protocol.id) } });
      }
      const versionMatch = url.pathname.match(/^\/api\/protocols\/([^/]+)\/versions$/);
      if (request.method === 'POST' && versionMatch) {
        const body = await readJson(request);
        const version = service.createProtocolVersion(decodeURIComponent(versionMatch[1]), body);
        return sendJson(response, 201, { version });
      }
      if (request.method === 'GET' && url.pathname === '/api/sessions') return sendJson(response, 200, { sessions: service.listSessions() });
      if (request.method === 'POST' && url.pathname === '/api/sessions') {
        const body = await readJson(request);
        const session = service.createTreatmentSession(body);
        return sendJson(response, 201, { session });
      }
      if (request.method === 'GET' && url.pathname === '/api/audit') return sendJson(response, 200, service.getAudit());
      if (url.pathname.startsWith('/api/')) return sendJson(response, 404, { error: 'API route not found' });
      if (request.method !== 'GET') { response.writeHead(405); response.end('Method not allowed'); return; }
      serveStatic(response, url.pathname);
    } catch (error) {
      sendJson(response, 400, { error: error?.message || 'Unexpected error' });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    url: `http://127.0.0.1:${actualPort}`,
    port: actualPort,
    service,
    db,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      db.close();
    }
  };
}
