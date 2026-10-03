import fs from 'node:fs';

// A pre-read stat is insufficient: the file can grow or be replaced between
// selecting it and reading it. Bound the actual bytes read from one descriptor.
export function readBoundedText(filename: string, maximum: number, label: string): string {
  const selected = fs.lstatSync(filename);
  if (!selected.isFile() || selected.isSymbolicLink()) throw new Error(`Choose a regular ${label} file.`);
  if (selected.size > maximum) throw new Error(`${label} exceeds its ${maximum / 1024 / 1024} MiB limit.`);
  const fd = fs.openSync(filename, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile()) throw new Error(`Choose a regular ${label} file.`);
    if (opened.size > maximum) throw new Error(`${label} exceeds its ${maximum / 1024 / 1024} MiB limit.`);
    const parts: Buffer[] = [];
    let total = 0;
    while (total <= maximum) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maximum + 1 - total));
      const count = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!count) return Buffer.concat(parts, total).toString('utf8');
      total += count;
      if (total > maximum) throw new Error(`${label} exceeds its ${maximum / 1024 / 1024} MiB limit.`);
      parts.push(chunk.subarray(0, count));
    }
    throw new Error(`${label} exceeds its size limit.`);
  } finally { fs.closeSync(fd); }
}
