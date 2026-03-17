#!/usr/bin/env node
/**
 * Full release script:
 *  1. Build main app
 *  2. Build installer
 *  3. Create GitHub release and upload installer EXE
 */

const { execSync } = require('child_process');
const { version }  = require('../package.json');
const tag          = `v${version}`;
const installerExe = `installer\\installer-dist\\Minecraft Server Manager Setup ${version}.exe`;
const gh           = `"C:\\Program Files\\GitHub CLI\\gh.exe"`;

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

run('npm run build');
run('npx electron-builder');
run('npm --prefix installer run package');
run(`${gh} release create "${tag}" "${installerExe}" --title "Minecraft Server Manager ${tag}" --generate-notes`);

console.log(`\nRelease ${tag} published successfully.`);
