import { createHash } from 'node:crypto';
import { openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { getRawHeader } from '@electron/asar';
import { NtExecutable, NtExecutableResource } from 'resedit';

// Inspect only. Parsing signed PE resources does not verify the publisher signature.
// Accept the exact resource shape emitted by the pinned Electron Packager.
export function readEmbeddedAsarIntegrity(executableBytes) {
  const executable = NtExecutable.from(executableBytes, { ignoreCert: true });
  const resources = NtExecutableResource.from(executable).entries.filter(entry =>
    typeof entry.type === 'string' && entry.type.toUpperCase() === 'INTEGRITY' &&
    typeof entry.id === 'string' && entry.id.toUpperCase() === 'ELECTRONASAR');
  if (resources.length !== 1) throw new Error('Missing or ambiguous embedded ASAR integrity resource.');
  const resource = resources[0];
  if (resource.type !== 'INTEGRITY' || resource.id !== 'ELECTRONASAR' || resource.bin.byteLength > 16384) {
    throw new Error('Unreviewed embedded ASAR integrity resource format.');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(resource.bin);
  let entries;
  try { entries = JSON.parse(text); } catch { throw new Error('Malformed embedded ASAR integrity JSON.'); }
  // Canonical Packager JSON also rejects duplicate object keys that JSON.parse would discard.
  if (JSON.stringify(entries) !== text || !Array.isArray(entries) || entries.length !== 1) {
    throw new Error('Noncanonical or ambiguous embedded ASAR integrity entries.');
  }
  const entry = entries[0];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      Object.keys(entry).sort().join(',') !== 'alg,file,value' ||
      entry.file !== 'resources\\app.asar' || entry.alg !== 'SHA256' ||
      typeof entry.value !== 'string' || !/^[a-f0-9]{64}$/.test(entry.value)) {
    throw new Error('Unreviewed embedded ASAR integrity entry.');
  }
  return { file: entry.file, algorithm: entry.alg, headerSha256: entry.value };
}

export function inspectAsarIntegrity(executableBytes, archivePath) {
  const embedded = readEmbeddedAsarIntegrity(executableBytes);
  // Bound the allocation made by getRawHeader before parsing a potentially damaged archive.
  const descriptor = openSync(archivePath, 'r');
  try {
    const prefix = Buffer.alloc(8), stat = fstatSync(descriptor);
    if (!stat.isFile() || readSync(descriptor, prefix, 0, 8, 0) !== 8 || prefix.readUInt32LE(0) !== 4) {
      throw new Error('Invalid ASAR header prefix.');
    }
    const bytes = prefix.readUInt32LE(4);
    if (bytes < 8 || bytes > 16 * 1024 * 1024 || bytes + 8 > stat.size) {
      throw new Error('Invalid or oversized ASAR header length.');
    }
  } finally { closeSync(descriptor); }
  const { headerString } = getRawHeader(archivePath);
  const actual = createHash('sha256').update(headerString, 'utf8').digest('hex');
  if (actual !== embedded.headerSha256) throw new Error('Embedded ASAR header digest does not match the archive.');
  return { ...embedded, headerMatches: true,
    scope: 'Static PE resource and ASAR header equality only; no runtime enforcement, file-content validation or publisher verification.' };
}
