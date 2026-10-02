const buildPolicy = require('./scripts/electron-build-policy.cjs');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  packagerConfig: {
    download: buildPolicy.downloadOptions(),
    asar: { unpack: '**/*.node' }, executableName: 'cc-lime', icon: 'assets/icon',
    appBundleId: 'app.cclime.desktop',
    ignore: [/^\/(src|tests|docs|scripts|cloud|test-results|playwright-report|coverage|release|build)(\/|$)/, /^\/\.(git|env|codex|agents|tools|local)/, /PROJECT_PLAN\.md$/, /.*-debug\.log$/, /cloud-client\.json$/],
    extraResource: ['assets/icon.png', 'assets/icon.ico', 'dist/THIRD_PARTY_NOTICES.txt', 'dist/third-party-source'],
  },
  hooks: {
    prePackage: (config, platform, arch) => buildPolicy.beginBuild(config, platform, arch, require('./package.json')),
    postPackage: async (config, result) => {
      for (const output of result.outputPaths) {
        const notice = fs.lstatSync(path.join(output, 'LICENSES.chromium.html'));
        if (!notice.isFile() || notice.size === 0) throw new Error('Chromium notices are required before creating an installer.');
      }
      await buildPolicy.finishBuild(config);
    },
  },
  rebuildConfig: {},
  makers: [{ name: '@electron-forge/maker-squirrel', config: {
    name: 'cc_lime', authors: 'idekakdj', description: 'C.C. Lime student calendar',
    setupExe: `CC-Lime-${require('./package.json').version}-Setup-x64.exe`, setupIcon: 'assets/icon.ico',
    noMsi: true,
    additionalFiles: [{ src: 'LICENSES.chromium.html', target: 'lib\\net45' }],
  }}],
};
