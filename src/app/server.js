import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db/database.js';
import { createF8Service } from './f8-service.js';
import { createAuthService } from './auth-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, 'public');
const contentTypes = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
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
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
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
  const root = path.resolve(publicDir);
  const filePath = path.resolve(publicDir, requested);
  if ((!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html'))) {
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

function clinicalEngineFilters(url) {
  const filters = protocolFilters(url);
  for (const key of ['professionalArea', 'ageYears', 'wavelengthNm', 'applicatorId', 'selectedPowerMw']) {
    const value = String(url.searchParams.get(key) ?? '').trim();
    if (value) filters[key] = value;
  }
  return filters;
}

function evidenceFilters(url) {
  const filters = {};
  const mappings = [
    ['q', 'query'],
    ['studyType', 'studyType'],
    ['condition', 'condition'],
    ['bodyRegion', 'bodyRegion'],
    ['wavelengthNm', 'wavelengthNm']
  ];
  for (const [queryKey, filterKey] of mappings) {
    const value = String(url.searchParams.get(queryKey) ?? '').trim();
    if (value) filters[filterKey] = value;
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
  const service = createF8Service(db, { storageRoot, backupRoot });
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
          return sendJson(response, /já concluída/i.test(error?.message || '') ? 409 : 400, {
            error: error?.message || 'Falha na configuração inicial.'
          });
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

        if (request.method === 'GET' && url.pathname === '/api/clinical-engine/protocols') {
          return sendJson(response, 200, { results: service.searchClinicalProtocols(clinicalEngineFilters(url)) });
        }

        if (request.method === 'GET' && url.pathname === '/api/evidence') {
          return sendJson(response, 200, { evidence: service.listEvidence(evidenceFilters(url)) });
        }
        if (request.method === 'POST' && url.pathname === '/api/evidence') {
          return sendJson(response, 201, { evidence: service.createEvidence(await readJson(request), actorId) });
        }

        if (request.method === 'GET' && url.pathname === '/api/body-map/catalog') {
          return sendJson(response, 200, { regions: service.getBodyMapCatalog() });
        }

        if (request.method === 'GET' && url.pathname === '/api/patients') {
          return sendJson(response, 200, { patients: service.listPatients() });
        }
        if (request.method === 'POST' && url.pathname === '/api/patients') {
          return sendJson(response, 201, { patient: service.createPatient(await readJson(request), actorId) });
        }

        const patientBodyMapMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/body-map-points$/);
        if (patientBodyMapMatch && request.method === 'GET') {
          return sendJson(response, 200, { points: service.listBodyMapPoints(decodeURIComponent(patientBodyMapMatch[1])) });
        }

        const patientOutcomesMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/outcomes$/);
        if (patientOutcomesMatch && request.method === 'GET') {
          const patientId = decodeURIComponent(patientOutcomesMatch[1]);
          return sendJson(response, 200, {
            outcomes: service.listOutcomes(patientId, {
              metricType: url.searchParams.get('metricType'),
              baselineGroup: url.searchParams.get('baselineGroup'),
              order: url.searchParams.get('order') || 'desc'
            })
          });
        }
        if (patientOutcomesMatch && request.method === 'POST') {
          const patientId = decodeURIComponent(patientOutcomesMatch[1]);
          return sendJson(response, 201, {
            outcome: service.recordOutcome({ patientId, ...(await readJson(request)) }, actorId)
          });
        }

        const patientTimelineMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/timeline$/);
        if (patientTimelineMatch && request.method === 'GET') {
          return sendJson(response, 200, {
            timeline: service.getPatientTimeline(decodeURIComponent(patientTimelineMatch[1]), {
              order: url.searchParams.get('order') || 'asc'
            })
          });
        }

        const patientSeriesMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/outcome-series$/);
        if (patientSeriesMatch && request.method === 'GET') {
          return sendJson(response, 200, {
            series: service.getOutcomeSeries(
              decodeURIComponent(patientSeriesMatch[1]),
              url.searchParams.get('metricType'),
              { baselineGroup: url.searchParams.get('baselineGroup') }
            )
          });
        }

        const patientMatch = url.pathname.match(/^\/api\/patients\/([^/]+)$/);
        if (request.method === 'PATCH' && patientMatch) {
          return sendJson(response, 200, {
            patient: service.updatePatient(decodeURIComponent(patientMatch[1]), await readJson(request), actorId)
          });
        }
        const archiveMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/archive$/);
        if (request.method === 'POST' && archiveMatch) {
          return sendJson(response, 200, { patient: service.archivePatient(decodeURIComponent(archiveMatch[1]), actorId) });
        }
        const workspaceMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/workspace$/);
        if (request.method === 'GET' && workspaceMatch) {
          return sendJson(response, 200, service.getPatientWorkspace(decodeURIComponent(workspaceMatch[1])));
        }
        const patientEncounterMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/encounters$/);
        if (request.method === 'POST' && patientEncounterMatch) {
          return sendJson(response, 201, {
            encounter: service.startEncounter(decodeURIComponent(patientEncounterMatch[1]), await readJson(request), actorId)
          });
        }

        const finalizeMatch = url.pathname.match(/^\/api\/encounters\/([^/]+)\/finalize$/);
        if (request.method === 'POST' && finalizeMatch) {
          return sendJson(response, 200, { encounter: service.finalizeEncounter(decodeURIComponent(finalizeMatch[1]), actorId) });
        }
        const encounterPdfMatch = url.pathname.match(/^\/api\/encounters\/([^/]+)\/pdf$/);
        if (request.method === 'POST' && encounterPdfMatch) {
          return sendJson(response, 201, { document: service.finalizeEncounterPdf(decodeURIComponent(encounterPdfMatch[1]), actorId) });
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
          return sendJson(response, 201, {
            consent: service.acceptConsent({ patientId, ...(await readJson(request)) }, actorId)
          });
        }
        const revokeConsentMatch = url.pathname.match(/^\/api\/consents\/([^/]+)\/revoke$/);
        if (revokeConsentMatch && request.method === 'POST') {
          const body = await readJson(request);
          return sendJson(response, 201, {
            consent: service.revokeConsent(decodeURIComponent(revokeConsentMatch[1]), body.reason, actorId)
          });
        }

        const patientMediaMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/media$/);
        if (patientMediaMatch && request.method === 'GET') {
          return sendJson(response, 200, { media: service.listClinicalMedia(decodeURIComponent(patientMediaMatch[1])) });
        }
        if (patientMediaMatch && request.method === 'POST') {
          const patientId = decodeURIComponent(patientMediaMatch[1]);
          return sendJson(response, 201, {
            media: service.storeClinicalImage({ patientId, ...(await readJson(request)) }, actorId)
          });
        }

        const patientBasicOutcomesMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/basic-outcomes$/);
        if (patientBasicOutcomesMatch && request.method === 'GET') {
          return sendJson(response, 200, { outcomes: service.listBasicOutcomes(decodeURIComponent(patientBasicOutcomesMatch[1])) });
        }
        if (patientBasicOutcomesMatch && request.method === 'POST') {
          const patientId = decodeURIComponent(patientBasicOutcomesMatch[1]);
          return sendJson(response, 201, {
            outcome: service.recordBasicOutcome({ patientId, ...(await readJson(request)) }, actorId)
          });
        }

        if (request.method === 'GET' && url.pathname === '/api/equipment') {
          return sendJson(response, 200, { equipment: service.listEquipmentDetailed() });
        }
        if (request.method === 'POST' && url.pathname === '/api/equipment') {
          return sendJson(response, 201, { equipment: service.createEquipment(await readJson(request), actorId) });
        }
        const equipmentMatch = url.pathname.match(/^\/api\/equipment\/([^/]+)$/);
        if (request.method === 'PATCH' && equipmentMatch) {
          return sendJson(response, 200, {
            equipment: service.updateEquipment(decodeURIComponent(equipmentMatch[1]), await readJson(request), actorId)
          });
        }
        const applicatorMatch = url.pathname.match(/^\/api\/equipment\/([^/]+)\/applicators$/);
        if (request.method === 'POST' && applicatorMatch) {
          return sendJson(response, 201, {
            applicator: service.createApplicator(decodeURIComponent(applicatorMatch[1]), await readJson(request), actorId)
          });
        }

        if (request.method === 'GET' && url.pathname === '/api/protocols') {
          const filters = protocolFilters(url);
          const source = Object.keys(filters).length ? service.searchProtocols(filters) : service.listProtocols();
          return sendJson(response, 200, {
            protocols: source.map((protocol) => ({ ...protocol, versions: service.listProtocolVersions(protocol.id) }))
          });
        }
        if (request.method === 'POST' && url.pathname === '/api/protocols') {
          const protocol = service.createProtocol(await readJson(request), actorId);
          return sendJson(response, 201, {
            protocol: { ...protocol, versions: service.listProtocolVersions(protocol.id) }
          });
        }
        const versionMatch = url.pathname.match(/^\/api\/protocols\/([^/]+)\/versions$/);
        if (request.method === 'POST' && versionMatch) {
          return sendJson(response, 201, {
            version: service.createProtocolVersion(decodeURIComponent(versionMatch[1]), await readJson(request), actorId)
          });
        }

        const protocolEvidenceMatch = url.pathname.match(/^\/api\/protocol-versions\/([^/]+)\/evidence$/);
        if (protocolEvidenceMatch && request.method === 'GET') {
          return sendJson(response, 200, {
            evidence: service.listProtocolEvidence(decodeURIComponent(protocolEvidenceMatch[1]))
          });
        }
        if (protocolEvidenceMatch && request.method === 'POST') {
          const body = await readJson(request);
          return sendJson(response, 201, {
            link: service.linkEvidenceToProtocolVersion(
              decodeURIComponent(protocolEvidenceMatch[1]), body.evidenceId, body, actorId
            )
          });
        }

        const adaptMatch = url.pathname.match(/^\/api\/protocol-versions\/([^/]+)\/adapt$/);
        if (request.method === 'POST' && adaptMatch) {
          const body = await readJson(request);
          return sendJson(response, 200, {
            adaptation: service.adaptProtocolVersion(
              decodeURIComponent(adaptMatch[1]), body.applicatorId, body.selectedPowerMw ?? null, actorId
            )
          });
        }

        if (request.method === 'GET' && url.pathname === '/api/sessions') {
          return sendJson(response, 200, { sessions: service.listSessions() });
        }
        if (request.method === 'POST' && url.pathname === '/api/sessions') {
          return sendJson(response, 201, { session: service.createTreatmentSession(await readJson(request), actorId) });
        }

        const bodyMapPointMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/body-map-points$/);
        if (request.method === 'POST' && bodyMapPointMatch) {
          return sendJson(response, 201, {
            point: service.recordBodyMapPoint(decodeURIComponent(bodyMapPointMatch[1]), await readJson(request), actorId)
          });
        }

        const applicationPointMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/application-points$/);
        if (request.method === 'POST' && applicationPointMatch) {
          return sendJson(response, 201, {
            applicationPoint: service.recordApplicationPoint(
              decodeURIComponent(applicationPointMatch[1]), await readJson(request), actorId
            )
          });
        }

        if (request.method === 'POST' && url.pathname === '/api/backup') {
          return sendJson(response, 201, { backup: service.createLocalBackup(actorId) });
        }
        if (request.method === 'POST' && url.pathname === '/api/backup/verify') {
          const body = await readJson(request);
          return sendJson(response, 200, { verification: service.verifyLocalBackup(body.backupPath) });
        }

        if (request.method === 'GET' && url.pathname === '/api/audit') {
          return sendJson(response, 200, service.getAudit());
        }
        return sendJson(response, 404, { error: 'API route not found' });
      }

      if (request.method !== 'GET') {
        response.writeHead(405); response.end('Method not allowed'); return;
      }
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
