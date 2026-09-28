const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const target = Object.freeze({
  version: '44.4.2', platform: 'win32', arch: 'x64',
  filename: 'electron-v44.4.2-win32-x64.zip',
  // https://github.com/electron/electron/releases/download/v44.4.2/SHASUMS256.txt
  sha256: '6aae435b6cd5c0eedf9fd38824bae4045ffdaecd029f0b8c8328bac3f5b71f03',
});
const owned = new WeakMap();
const downloadOptions = () => ({ checksums: { [target.filename]: target.sha256 }, unsafelyDisableChecksums: false });

function validateBuild(config, platform, arch, manifest, environment = process.env) {
  if (platform !== target.platform || arch !== target.arch || manifest.devDependencies?.electron !== target.version) {
    throw new Error('This build requires the reviewed Electron version and Windows x64 target. Review archive checksums before changing them.');
  }
  const options = config.packagerConfig;
  if (!options || options.electronZipDir !== undefined || options.tmpdir !== undefined ||
      !isDeepStrictEqual(options.download, downloadOptions())) {
    throw new Error('Custom archive, temporary-directory or download options require a build-security review.');
  }
  // @electron/get accepts several npm/environment spellings, ahead of options.
  // Refuse those selectors without printing their possibly sensitive values.
  const selectors = /^(?:npm_config_|npm_package_config_)?electron_(?:mirror|nightly_?mirror|custom_?dir|custom_?filename|custom_?version)$/i;
  for (const [key, value] of Object.entries(environment)) {
    if (value && selectors.test(key)) throw new Error('An Electron download environment override is set. Remove it for this verified build.');
  }
}

async function beginBuild(config, platform, arch, manifest, environment = process.env, tempParent = os.tmpdir()) {
  validateBuild(config, platform, arch, manifest, environment);
  if (owned.has(config)) throw new Error('This configuration already owns an active package build.');
  const parent = fs.realpathSync(tempParent);
  const root = fs.mkdtempSync(path.join(parent, 'cc-lime-build-'));
  const identity = fs.realpathSync(root);
  const { dev, ino } = fs.statSync(root, { bigint: true });
  owned.set(config, { root, parent, identity, dev, ino });
  config.packagerConfig.tmpdir = root;
}

async function finishBuild(config) {
  const record = owned.get(config);
  if (!record) return;
  const { root, parent, identity } = record;
  const current = fs.lstatSync(root, { bigint: true });
  if (path.dirname(root) !== parent || !path.basename(root).startsWith('cc-lime-build-') ||
      !current.isDirectory() || current.isSymbolicLink() || fs.realpathSync(root) !== identity ||
      current.dev !== record.dev || current.ino !== record.ino) {
    throw new Error('Build directory identity changed; automatic cleanup refused.');
  }
  fs.rmSync(root, { recursive: true, force: false });
  delete config.packagerConfig.tmpdir;
  owned.delete(config);
}

module.exports = { target, downloadOptions, validateBuild, beginBuild, finishBuild };
