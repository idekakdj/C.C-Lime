// Read-only schema reviewed against electron/electron v44.4.5 build/fuses/fuses.json5.
// A changed schema must be reviewed; do not silently reinterpret future bytes.
export const fuseSentinel = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
export const fuseNames = Object.freeze([
  'runAsNode', 'cookieEncryption', 'nodeOptions', 'nodeCliInspect',
  'embeddedAsarIntegrityValidation', 'onlyLoadAppFromAsar',
  'loadBrowserProcessSpecificV8Snapshot', 'grantFileProtocolExtraPrivileges', 'wasmTrapHandlers',
]);

export function readElectronFuses(bytes) {
  const offset = bytes.indexOf(fuseSentinel);
  if (offset < 0 || bytes.indexOf(fuseSentinel, offset + 1) >= 0) throw new Error('Missing or ambiguous Electron fuse sentinel.');
  const start = offset + fuseSentinel.length;
  if (bytes.length < start + 2) throw new Error('Truncated Electron fuse header.');
  const version = bytes[start], length = bytes[start + 1];
  if (version !== 1 || length !== fuseNames.length) throw new Error('Unreviewed Electron fuse schema.');
  if (bytes.length < start + 2 + length) throw new Error('Truncated Electron fuse wire.');
  const values = [...bytes.subarray(start + 2, start + 2 + length)];
  if (values.some(value => ![0x30, 0x31, 0x72].includes(value))) throw new Error('Unknown Electron fuse state.');
  return { version, values: Object.fromEntries(fuseNames.map((name, i) => [name, values[i] === 0x72 ? 'removed' : values[i] === 0x31])) };
}

export function hardeningGaps(fuses) {
  const targets = {
    runAsNode: false, cookieEncryption: true, nodeOptions: false, nodeCliInspect: false,
    embeddedAsarIntegrityValidation: true, onlyLoadAppFromAsar: true, grantFileProtocolExtraPrivileges: false,
  };
  return Object.entries(targets).filter(([name, desired]) => fuses.values[name] !== desired)
    .map(([name, desired]) => ({ name, observed: fuses.values[name] ?? 'unknown', desired }));
}
