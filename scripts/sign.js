/**
 * Custom signing hook for electron-builder.
 *
 * electron-builder calls this file (via the "afterSign" hook or the
 * ELECTRON_BUILDER_SIGN environment variable) for every binary that needs
 * to be signed. It uses Windows signtool.exe which ships with the
 * Windows SDK / Visual Studio Build Tools.
 *
 * ── How to activate ─────────────────────────────────────────────────────────
 * Set these environment variables before running `npm run package`:
 *
 *   Option A – PFX file (standard OV / EV certificate):
 *     CSC_LINK          absolute path to your .pfx file
 *                       OR base-64 encoded PFX: `certutil -encode cert.pfx cert.b64`
 *     CSC_KEY_PASSWORD  password protecting the .pfx
 *
 *   Option B – Windows Certificate Store (EV tokens, Azure Trusted Signing):
 *     WIN_CSC_SUBJECT_NAME  Subject name / CN of the cert in the store
 *                           e.g. "My Company Ltd"
 *
 * electron-builder reads CSC_LINK / CSC_KEY_PASSWORD automatically.
 * WIN_CSC_SUBJECT_NAME is consumed by the custom signtool call below.
 *
 * Copy .env.signing.example → .env.signing, fill in your values, then run:
 *   scripts\build-signed.ps1
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Locates signtool.exe from the Windows SDK.
 * Searches common installation paths for the most recent version.
 */
function findSigntool() {
  const sdkBase = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (fs.existsSync(sdkBase)) {
    const versions = fs.readdirSync(sdkBase)
      .filter((d) => d.startsWith('10.'))
      .sort()
      .reverse(); // newest first
    for (const ver of versions) {
      const candidate = path.join(sdkBase, ver, 'x64', 'signtool.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  // Fallback: assume signtool is on PATH (Visual Studio or SDK in PATH)
  return 'signtool';
}

/**
 * Signs a single file.
 * Called by electron-builder for each binary (exe, dll) in the package.
 *
 * @param {import('electron-builder').CustomSignOptions} configuration
 */
exports.default = async function sign(configuration) {
  const { path: filePath } = configuration;

  // Skip if no signing credentials are configured.
  const pfxPath    = process.env.CSC_LINK;
  const pfxPass    = process.env.CSC_KEY_PASSWORD;
  const subjectName = process.env.WIN_CSC_SUBJECT_NAME;

  if (!pfxPath && !subjectName) {
    console.log(`[sign] No credentials set – skipping: ${path.basename(filePath)}`);
    return;
  }

  const signtool = findSigntool();
  let cmd;

  if (subjectName) {
    // Certificate Store (EV USB token, Azure Trusted Signing, etc.)
    cmd = [
      `"${signtool}"`, 'sign',
      '/n', `"${subjectName}"`,
      '/fd', 'sha256',
      '/td', 'sha256',
      '/tr', 'http://timestamp.digicert.com',
      '/v',
      `"${filePath}"`,
    ].join(' ');
  } else {
    // PFX file (standard OV certificate)
    const resolvedPfx = pfxPath.startsWith('data:') || pfxPath.includes('base64')
      ? (() => {
          // Write base-64 PFX to a temp file
          const tmp = path.join(require('os').tmpdir(), 'msm-codesign.pfx');
          const b64 = pfxPath.replace(/^data:[^;]+;base64,/, '');
          fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
          return tmp;
        })()
      : pfxPath;

    cmd = [
      `"${signtool}"`, 'sign',
      '/f', `"${resolvedPfx}"`,
      '/p', `"${pfxPass}"`,
      '/fd', 'sha256',
      '/td', 'sha256',
      '/tr', 'http://timestamp.digicert.com',
      '/v',
      `"${filePath}"`,
    ].join(' ');
  }

  console.log(`[sign] Signing: ${path.basename(filePath)}`);
  execSync(cmd, { stdio: 'inherit' });
};
