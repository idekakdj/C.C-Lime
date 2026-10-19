// Tiny stored ZIPs for containment tests. Raw names are intentional: ZIP-writing
// libraries often sanitize exactly the malformed paths the tests must exercise.
export function zipFixture(entries) {
  const locals = [], central = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8'), data = Buffer.from(entry.data ?? 'fixture');
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50); header.writeUInt16LE(0x0314, 4); header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x800, 8); header.writeUInt16LE(0x21, 14); header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20); header.writeUInt32LE(data.length, 24); header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(((entry.mode ?? 0o100644) * 65536) >>> 0, 38); header.writeUInt32LE(offset, 42);
    locals.push(local, name, data); central.push(header, name); offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
