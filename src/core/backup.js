import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

function hashFile(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyTree(source, destination) {
  if (!fs.existsSync(source)) return;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    ensureDir(destination);
    for (const entry of fs.readdirSync(source)) copyTree(path.join(source, entry), path.join(destination, entry));
    return;
  }
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function listFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function createBackup({ db, assetRoot, destinationRoot }) {
  if (!db?.prepare) throw new Error('Database handle is required');
  const destination = path.resolve(String(destinationRoot ?? '').trim());
  if (!destinationRoot) throw new Error('Backup destination root is required');
  const backupPath = path.join(destination, `backup-${safeTimestamp()}-${randomUUID().slice(0, 8)}`);
  ensureDir(backupPath);
  try {
    const snapshotPath = path.join(backupPath, 'clinical.sqlite');
    db.prepare('VACUUM INTO ?').run(snapshotPath);

    const resolvedAssetRoot = assetRoot ? path.resolve(assetRoot) : null;
    const backupAssetRoot = path.join(backupPath, 'clinical-assets');
    if (resolvedAssetRoot && fs.existsSync(resolvedAssetRoot)) copyTree(resolvedAssetRoot, backupAssetRoot);
    else ensureDir(backupAssetRoot);

    const manifestFiles = [snapshotPath, ...listFiles(backupAssetRoot)]
      .map((filePath) => ({
        path: path.relative(backupPath, filePath).split(path.sep).join('/'),
        sha256: hashFile(filePath),
        bytes: fs.statSync(filePath).size
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    const manifest = Object.freeze({
      version: 1,
      createdAt: new Date().toISOString(),
      files: manifestFiles
    });
    fs.writeFileSync(path.join(backupPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    return Object.freeze({ backupPath, manifest });
  } catch (error) {
    fs.rmSync(backupPath, { recursive: true, force: true });
    throw error;
  }
}

export function verifyBackup(backupPath) {
  const root = path.resolve(String(backupPath ?? '').trim());
  const errors = [];
  const manifestPath = path.join(root, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { valid: false, errors: ['manifest.json missing'] };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return { valid: false, errors: ['manifest.json invalid'] };
  }
  if (manifest?.version !== 1 || !Array.isArray(manifest.files)) errors.push('manifest format invalid');
  for (const item of manifest?.files ?? []) {
    const relative = String(item.path ?? '');
    const target = path.resolve(root, relative);
    if (!relative || (!target.startsWith(`${root}${path.sep}`) && target !== root)) {
      errors.push(`${relative || '<empty>'}: invalid path`);
      continue;
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      errors.push(`${relative}: missing`);
      continue;
    }
    const bytes = fs.statSync(target).size;
    if (bytes !== item.bytes) errors.push(`${relative}: byte size mismatch`);
    const sha256 = hashFile(target);
    if (sha256 !== item.sha256) errors.push(`${relative}: sha256 mismatch`);
  }
  return { valid: errors.length === 0, errors, manifest };
}
