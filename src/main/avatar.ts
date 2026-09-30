import fs from 'node:fs';
import type { NativeImage } from 'electron';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export function avatarDimensions(bytes: Buffer): { width: number; height: number } {
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) throw new Error('Choose a PNG or JPEG photo no larger than 5 MiB.');
  let width = 0, height = 0;
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR') {
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9 || offset + 2 > bytes.length) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 8) { height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5); break; }
      offset += length;
    }
  }
  if (!width || !height || width > 4096 || height > 4096) throw new Error('Choose a valid PNG or JPEG up to 4,096 pixels wide and high.');
  return { width, height };
}
export function readAvatar(filename: string, decode: (bytes: Buffer) => NativeImage): string {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_AVATAR_BYTES) throw new Error('Choose a regular PNG or JPEG file no larger than 5 MiB.');
  const descriptor=fs.openSync(filename,'r');let bytes:Buffer;
  try{const opened=fs.fstatSync(descriptor);if(!opened.isFile()||opened.size>MAX_AVATAR_BYTES)throw new Error('Choose a regular photo no larger than 5 MiB.');
    const buffer=Buffer.alloc(MAX_AVATAR_BYTES+1);let count=0,read=0;
    do{read=fs.readSync(descriptor,buffer,count,buffer.length-count,null);count+=read;}while(read&&count<buffer.length);
    bytes=buffer.subarray(0,count);
  }finally{fs.closeSync(descriptor);}
  const dimensions = avatarDimensions(bytes), image = decode(bytes);
  if (image.isEmpty()) throw new Error('This photo could not be opened. Choose another PNG or JPEG.');
  const actual = image.getSize();
  if (actual.width !== dimensions.width || actual.height !== dimensions.height) throw new Error('This photo has inconsistent image dimensions.');
  const side = Math.min(actual.width, actual.height);
  const png = image.crop({ x: Math.floor((actual.width - side) / 2), y: Math.floor((actual.height - side) / 2), width: side, height: side }).resize({ width: 128, height: 128, quality: 'best' }).toPNG();
  const result = `data:image/png;base64,${png.toString('base64')}`;
  if (!png.length || result.length > 100000) throw new Error('This photo could not be reduced to a profile icon.');
  return result;
}
