import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
});

function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function decodeStrictBase64(raw) {
  const data = String(raw ?? '').trim();
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw new Error('Invalid base64 payload');
  }
  const buffer = Buffer.from(data, 'base64');
  const normalizedInput = data.replace(/=+$/, '');
  const normalizedOutput = buffer.toString('base64').replace(/=+$/, '');
  if (normalizedInput !== normalizedOutput) throw new Error('Invalid base64 payload');
  return buffer;
}

export function storeClinicalImageFile({ storageRoot, patientId, originalFilename, mimeType, dataBase64 }) {
  const root = path.resolve(requireText(storageRoot, 'Storage root'));
  const patient = requireText(patientId, 'Patient id');
  const filename = requireText(originalFilename, 'Original filename');
  const mime = requireText(mimeType, 'MIME type').toLowerCase();
  const extension = IMAGE_EXTENSIONS[mime];
  if (!extension) throw new Error('Unsupported image MIME type');

  const buffer = decodeStrictBase64(dataBase64);
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Clinical image exceeds the 5 MiB decoded limit');

  const directory = path.join(root, 'media', patient);
  fs.mkdirSync(directory, { recursive: true });
  const storagePath = path.join(directory, `${randomUUID()}${extension}`);
  fs.writeFileSync(storagePath, buffer, { flag: 'wx' });
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  return Object.freeze({
    storagePath,
    sha256,
    byteSize: buffer.length,
    mimeType: mime,
    originalFilename: filename
  });
}
