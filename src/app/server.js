import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db/database.js';
import { createF4Service } from './f4-service.js';
import { createAuthService } from './auth-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');
const contentTypes = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8'
});

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function parseCookies(request) {
  const raw = request.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function sessionCookie(token, request) {
  const secure = request.socket.encrypted || String(request.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  return `pbm_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(request) {
  const secure = request.socket.encrypted || String(request.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  return `pbm_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
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

function protocolFilters(url) {
  const filters = {};
  for (const key of ['query', 'condition', 'symptom', 'bodyRegion', 'therapeuticGoal', 'clinicalPhase']) {
    const value = String(url.searchParams.get(key) ?? '').trim();
    if (value) filters[key] = value;
  }
  return filters;
}

export async function createAppServer({
  dbFile = path.resolve('data/fotobiomodulacao.sqlite'),
  storageRoot = path.resolve('data/clinical-assets'),
  backupRoot = path.resolve('data/backups'),
  port = 8788
} = {}) {
  if (dbFile !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
  const db = openDatabase(dbFile);
  const service = createF4Service(db, { storageRoot, backupRoot });
  const auth = createAuthService(db);
  service.ensureSeedData();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const cookies = parseCookies(request);
    const sessionToken = cookies.pbm_session || '';
    try {
      if (request.method === 'GET' && url.pathname === '/api/auth/status') {
        return sendJson(response, 200, auth.getStatus(sessionToken));
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/setup') {
        const body = await readJson(request);
        try {
          const result = auth.setup(body);
          return sendJson(response, 201, { user: result.user }, { 'set-cookie': sessionCookie(result.token, request) });
        } catch (error) {
          const status = /já concluída/i.test(error?.message || '') ? 409 : 400;
          return sendJson(response, status, { error: error?.message || 'Falha na configuração inicial.' });
        }
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const body = await readJson(request);
        try {
          const result = auth.login(body);
          return sendJson(response, 200, { user: result.user }, { 'set-cookie': sessionCookie(result.token, request) });
        } catch (error) {
          if (error?.code === 'INVALID_CREDENTIALS') return sendJson(response, 401, { error: 'Credenciais inválidas.' });
          throw error;
        }
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        auth.logout(sessionToken);
        return sendJson(response, 200, { ok: true }, { 'set-cookie': clearSessionCookie(request) });
      }

      if (url.pathname.startsWith('/api/')) {
        const user = auth.authenticate(sessionToken);
        if (!user) return sendJson(response, 401, { error: 'Autenticação necessária.' });
        const actorId = user.professionalId;

        if (request.method === 'GET' && url.pathname === '/api/status') return sendJson(response, 200, service.getStatus());
        if (request.method === 'GET' && url.pathname === '/api/patients') {
          return sendJson(response, 200, { patients: service.listPatients() });
        }
        if (request.method === 'POST' && url.pathname === '/api/patients') {
          const patient = service.createPatient(await readJson(request), actorId);
          return sendJson(response, 201, { patient });
        }
        const patientMatch = url.pathname.match(/^\/api\/patients\/([^/]+)$/);
        if (request.method === 'PATCH' && patientMatch) {
          const patient = service.updatePatient(decodeURIComponent(patientMatch[1]), await readJson(request), actorId);
          return sendJson(response, 200, { patient });
        }
        const archiveMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/archive$/);
        if (request.method === 'POST' && archiveMatch) {
          const patient = service.archivePatient(decodeURIComponent(archiveMatch[1]), actorId);
          return sendJson(response, 200, { patient });
        }
        const workspaceMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/workspace$/);
        if (request.method === 'GET' && workspaceMatch) {
          return sendJson(response, 200, service.getPatientWorkspace(decodeURIComponent(workspaceMatch[1])));
        }
        const patientEncounterMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/encounters$/);
        if (request.method === 'POST' && patientEncounterMatch) {
          const encounter = service.startEncounter(decodeURIComponent(patientEncounterMatch[1]), await readJson(request), actorId);
          return sendJson(response, 201, { encounter });
        }
        const finalizeMatch = url.pathname.match(/^\/api\/encounters\/([^/]+)\/finalize$/);
        if (request.method === 'POST' && finalizeMatch) {
          const encounter = service.finalizeEncounter(decodeURIComponent(finalizeMatch[1]), actorId);
          return sendJson(response, 200, { encounter });
        }
        const encounterPdfMatch = url.pathname.match(/^\/api\/encounters\/([^/]+)\/pdf$/);
        if (request.method === 'POST' && encounterPdfMatch) {
          const document = service.finalizeEncounterPdf(decodeURIComponent(encounterPdfMatch[1]), actorId);
          return sendJson(response, 201, { document });
        }
        if (request.method === 'GET' && url.pathname === '/api/encounters/open') {
          return sendJson(response, 200, { encounters: service.listOpenEncounters() });
        }

        const patientConsentsMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/consents$/);
        if (patientConsentsMatch && request.method === 'GET') {
          return sendJson(response, 200, { consents: service.listConsents(decodeURIComponent(patientConsentsMatch[1])) });
        }
        if (patientConsentsMatch && request.method === 'POST') {
          const patientId = decodeURIComponent(patientConsentsMatch[1]);
          const consent = service.acceptConsent({ patientId, ...(await readJson(request)) }, actorId);
          return sendJson(response, 201, { consent });
        }
        const revokeConsentMatch = url.pathname.match(/^\/api\/consents\/([^/]+)\/revoke$/);
        if (revokeConsentMatch && request.method === 'POST') {
          const body = await readJson(request);
          const consent = service.revokeConsent(decodeURIComponent(revokeConsentMatch[1]), body.reason, actorId);
          return sendJson(response, 201, { consent });
        }

        const patientMediaMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/media$/);
        if (patientMediaMatch && request.method === 'GET') {
          return sendJson(response, 200, { media: service.listClinicalMedia(decodeURIComponent(patientMediaMatch[1])) });
        }
        if (patientMediaMatch && request.method === 'POST') {
          const patientId = decodeURIComponent(patientMediaMatch[1]);
          const media = service.storeClinicalImage({ patientId, ...(await readJson(request)) }, actorId);
          return sendJson(response, 201, { media });
        }

        const patientBasicOutcomesMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/basic-outcomes$/);
        if (patientBasicOutcomesMatch && request.method === 'GET') {
          return sendJson(response, 200, { outcomes: service.listBasicOutcomes(decodeURIComponent(patientBasicOutcomesMatch[1])) });
        }
        if (patientBasicOutcomesMatch && request.method === 'POST') {
          const patientId = decodeURIComponent(patientBasicOutcomesMatch[1]);
          const outcome = service.recordBasicOutcome({ patientId, ...(await readJson(request)) }, actorId);
          return sendJson(response, 201, { outcome });
        }

        if (request.method === 'GET' && url.pathname === '/api/equipment') {
          return sendJson(response, 200, { equipment: service.listEquipmentDetailed() });
        }
        if (request.method === 'POST' && url.pathname === '/api/equipment') {
          const equipment = service.createEquipment(await readJson(request), actorId);
          return sendJson(response, 201, { equipment });
        }
        const equipmentMatch = url.pathname.match(/^\/api\/equipment\/([^/]+)$/);
        if (request.method === 'PATCH' && equipmentMatch) {
          const equipment = service.updateEquipment(decodeURIComponent(equipmentMatch[1]), await readJson(request), actorId);
          return sendJson(response, 200, { equipment });
        }
        const applicatorMatch = url.pathname.match(/^\/api\/equipment\/([^/]+)\/applicators$/);
        if (request.method === 'POST' && applicatorMatch) {
          const applicator = service.createApplicator(decodeURIComponent(applicatorMatch[1]), await readJson(request), actorId);
          return sendJson(response, 201, { applicator });
        }

        if (request.method === 'GET' && url.pathname === '/api/protocols') {
          const filters = protocolFilters(url);
          const source = Object.keys(filters).length ? service.searchProtocols(filters) : service.listProtocols();
          const protocols = source.map((protocol) => ({ ...protocol, versions: service.listProtocolVersions(protocol.id) }));
          return sendJson(response, 200, { protocols });
        }
        if (request.method === 'POST' && url.pathname === '/api/protocols') {
          const body = await readJson(request);
          const protocol = service.createProtocol(body, actorId);
          return sendJson(response, 201, { protocol: { ...protocol, versions: service.listProtocolVersions(protocol.id) } });
        }
        const versionMatch = url.pathname.match(/^\/api\/protocols\/([^/]+)\/versions$/);
        if (request.method === 'POST' && versionMatch) {
          const version = service.createProtocolVersion(decodeURIComponent(versionMatch[1]), await readJson(request), actorId);
          return sendJson(response, 201, { version });
        }
        const adaptMatch = url.pathname.match(/^\/api\/protocol-versions\/([^/]+)\/adapt$/);
        if (request.method === 'POST' && adaptMatch) {
          const body = await readJson(request);
          const adaptation = service.adaptProtocolVersion(
            decodeURIComponent(adaptMatch[1]), body.applicatorId, body.selectedPowerMw ?? null, actorId
          );
          return sendJson(response, 200, { adaptation });
        }

        if (request.method === 'GET' && url.pathname === '/api/sessions') return sendJson(response, 200, { sessions: service.listSessions() });
        if (request.method === 'POST' && url.pathname === '/api/sessions') {
          const session = service.createTreatmentSession(await readJson(request), actorId);
          return sendJson(response, 201, { session });
        }
        if (request.method === 'POST' && url.pathname === '/api/backup') {
          const backup = service.createLocalBackup(actorId);
          return sendJson(response, 201, { backup });
        }
        if (request.method === 'GET' && url.pathname === '/api/audit') return sendJson(response, 200, service.getAudit());
        return sendJson(response, 404, { error: 'API route not found' });
      }

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
    auth,
    db,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      db.close();
    }
  };
}