const buildPolicy = require('./scripts/electron-build-policy.cjs');

module.exports = {
  packagerConfig: {
    download: buildPolicy.downloadOptions(),
    asar: { unpack: '**/*.node' }, executableName: 'cc-lime', icon: 'assets/icon',
    appBundleId: 'app.cclime.desktop',
    ignore: [/^\/(src|tests|docs|scripts|cloud|test-results|playwright-report|coverage|release|build)(\/|$)/, /^\/\.(git|env|codex|agents|tools|local)/, /PROJECT_PLAN\.md$/, /.*-debug\.log$/, /cloud-client\.json$/],
    extraResource: ['assets/icon.png', 'assets/icon.ico'],
  },
  hooks: {
    prePackage: (config, platform, arch) => buildPolicy.beginBuild(config, platform, arch, require('./package.json')),
    postPackage: config => buildPolicy.finishBuild(config),
  },
  rebuildConfig: {},
  makers: [{ name: '@electron-forge/maker-squirrel', config: {
    name: 'cc_lime', authors: 'idekakdj', description: 'C.C. Lime student calendar',
    setupExe: `CC-Lime-${require('./package.json').version}-Setup-x64.exe`, setupIcon: 'assets/icon.ico',
    noMsi: true,
  }}],
};
