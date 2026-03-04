/**
 * Steamworks SDK integration.
 *
 * ── What this does ───────────────────────────────────────────────────────────
 *  • In DEVELOPMENT (app.isPackaged === false) all Steam calls are silent
 *    no-ops so the dev loop works without a running Steam client.
 *
 *  • In PRODUCTION the app refuses to start unless:
 *      1. Steam is running and the user is logged in.
 *      2. The user owns this app (App ID must match).
 *    This is the primary copy-protection mechanism.
 *    Steam's own DRM wrapper (applied in the Steamworks publisher tools)
 *    adds a second layer on top.
 *
 * ── One-time setup checklist ─────────────────────────────────────────────────
 *  1. Register at https://partner.steamgames.com and create your app.
 *  2. Replace STEAM_APP_ID (currently 480 = Valve's public test app) with
 *     your real App ID.
 *  3. Open Stats & Achievements in the Steamworks dashboard and create each
 *     ACH_* entry below with the EXACT same string ID.
 *  4. Click "Publish" on the Achievements page before testing.
 *  5. In "SteamPipe / Builds", upload the packaged app as a depot.
 *  6. Optionally apply the Steam DRM Wrapper in "Technical Tools → DRM".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { app } from 'electron';

// ---------------------------------------------------------------------------
// App ID
// ---------------------------------------------------------------------------

/**
 * Your Steam App ID.
 *  480  = Spacewar (Valve's public test app – safe to use for local dev).
 *  Replace with your real App ID before submitting to Steam.
 */
export const STEAM_APP_ID = 480;

// ---------------------------------------------------------------------------
// Achievement IDs
// ---------------------------------------------------------------------------

/**
 * Achievement IDs must exactly match what you configure in Steamworks.
 * Add/rename entries here then mirror the change in the Steamworks dashboard.
 */
export const ACH = {
  /** App opened for the first time. Auto-unlocks on startup. */
  FIRST_LAUNCH:  'ACH_FIRST_LAUNCH',
  /** Started a Minecraft server for the first time. */
  FIRST_SERVER:  'ACH_FIRST_SERVER',
  /** Used "Safe Exit" while servers were running. */
  SAFE_EXIT:     'ACH_SAFE_EXIT',
  /** Used "Force Kill" at least once. */
  FORCE_KILLER:  'ACH_FORCE_KILLER',
  /** Banned a player. */
  BAN_HAMMER:    'ACH_BAN_HAMMER',
  /** Granted OP to a player. */
  OP_GRANTED:    'ACH_OP_GRANTED',
  /** Enabled the whitelist. */
  WHITELIST:     'ACH_WHITELIST',
  /** Had 2 or more servers running simultaneously. */
  MULTITASKER:   'ACH_MULTITASKER',
} as const;

export type AchievementId = typeof ACH[keyof typeof ACH];

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: ReturnType<typeof import('steamworks.js').init> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialises Steamworks.
 *
 * Returns `true` on success (or unconditionally in dev builds).
 * Returns `false` if Steam is not running or the user doesn't own the app –
 * the caller must show an error message and call `app.quit()`.
 */
export function initSteam(): boolean {
  if (!app.isPackaged) {
    console.log('[Steam] Dev build – ownership check skipped.');
    return true;
  }

  try {
    // Runtime require keeps the native module out of the Vite dev bundle.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const steamworks = require('steamworks.js') as typeof import('steamworks.js');
    client = steamworks.init(STEAM_APP_ID);

    const name = client.localplayer.getName();
    console.log(`[Steam] Ready. Logged in as: ${name}`);

    // Unlock the first-launch achievement; Steam ignores it if already earned.
    unlockAchievement(ACH.FIRST_LAUNCH);

    return true;
  } catch (err) {
    console.error('[Steam] Initialisation failed:', err);
    return false;
  }
}

/**
 * Unlocks a Steam achievement.
 *
 * Safe to call unconditionally – no-ops in dev mode or when Steam is
 * unavailable. Steam itself silently ignores already-unlocked achievements.
 */
export function unlockAchievement(id: AchievementId): void {
  if (!client) return;
  try {
    client.achievement.activate(id);
  } catch (err) {
    console.warn(`[Steam] Could not unlock "${id}":`, err);
  }
}

/**
 * Returns the Steam display name of the current user, or null in dev mode /
 * when Steam is unavailable. Useful for a "Logged in as …" label in the UI.
 */
export function getSteamUsername(): string | null {
  if (!client) return null;
  try {
    return client.localplayer.getName();
  } catch {
    return null;
  }
}

/** Cleanly shuts down the Steamworks API. Must be called before app.quit(). */
export function shutdownSteam(): void {
  if (!client) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require('steamworks.js') as typeof import('steamworks.js')).deinit();
  } catch { /* ignore */ }
  client = null;
}
