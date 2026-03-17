/**
 * electron-builder afterPack hook.
 * Embeds a requireAdministrator UAC manifest into the inner application EXE
 * BEFORE electron-builder wraps it in the NSIS portable archive.
 * This ensures NSIS calculates a valid CRC over the already-modified EXE.
 */
const path = require('path');

exports.default = async function (context) {
  const innerExe = path.join(context.appOutDir, 'MinecraftServerManager-Setup.exe');

  console.log(`[afterPack] Embedding requireAdministrator manifest → ${path.basename(innerExe)}`);
  const { rcedit } = await import('rcedit');
  await rcedit(innerExe, { 'requested-execution-level': 'requireAdministrator' });
  console.log('[afterPack] Done.');
};
