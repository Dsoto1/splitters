// probe: runs the dedicatedhost flow on main (not for merging)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/**
 * Opening the launcher in a window of its own: Edge, Chrome, Brave or Chromium
 * in "app" mode (no tabs or address bar, the launcher's own title and icon),
 * with a profile of its own in the service's state folder, so it opens the
 * same size every time and has nothing to do with your normal browsing.
 * Edge comes with Windows, so on Windows this nearly always works. Without one
 * of these browsers (or with HOST_APP_WINDOW=0), the launcher opens in your
 * default browser as a normal tab.
 *
 * Closing the window only closes the window: the server runs on in the
 * console (type `launcher` to open it again).
 */

type Env = Record<string, string | undefined>;

/** Where the Chromium browsers live, most likely first. */
export function browserCandidates(platform: NodeJS.Platform, env: Env): string[] {
  if (platform === 'win32') {
    const roots = [env['ProgramFiles(x86)'], env.ProgramFiles, env.LOCALAPPDATA].filter((r): r is string => !!r);
    const apps = ['Microsoft\\Edge\\Application\\msedge.exe', 'Google\\Chrome\\Application\\chrome.exe', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe', 'Chromium\\Application\\chrome.exe'];
    return apps.flatMap((a) => roots.map((r) => `${r}\\${a}`));
  }
  if (platform === 'darwin') {
    const apps = ['Google Chrome.app/Contents/MacOS/Google Chrome', 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Brave Browser.app/Contents/MacOS/Brave Browser', 'Chromium.app/Contents/MacOS/Chromium'];
    const roots = ['/Applications', ...(env.HOME ? [join(env.HOME, 'Applications')] : [])];
    return apps.flatMap((a) => roots.map((r) => join(r, a)));
  }
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser'];
  const dirs = (env.PATH ?? '').split(delimiter).filter(Boolean);
  return names.flatMap((n) => dirs.map((d) => join(d, n)));
}

/** The first browser found that can open an app window, or null. */
export function findAppBrowser(platform: NodeJS.Platform = process.platform, env: Env = process.env, exists: (p: string) => boolean = existsSync): string | null {
  return browserCandidates(platform, env).find((p) => exists(p)) ?? null;
}

/** The arguments that open `url` as an app window with its own profile in `profileDir`. */
export function appWindowArgs(url: string, profileDir: string): string[] {
  return [`--app=${url}`, `--user-data-dir=${profileDir}`, '--window-size=1280,820', '--no-first-run', '--no-default-browser-check', '--disable-sync'];
}

/** Open `url` in the default browser (a normal tab). */
function openTab(url: string, onError: () => void): void {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd as string, args as string[], { stdio: 'ignore', detached: true, windowsHide: true }).on('error', onError).unref();
}

/**
 * Open the launcher: an app window when a browser for it is found (and
 * `appWindow` is on), else a tab. Returns what happened, for the console.
 */
export function openLauncherWindow(url: string, o: { profileDir: string; appWindow: boolean; log: (line: string) => void }): string {
  const failed = () => o.log(`[service] couldn't open a browser: open ${url} yourself`);
  try {
    const browser = o.appWindow ? findAppBrowser() : null;
    if (browser) {
      spawn(browser, appWindowArgs(url, o.profileDir), { stdio: 'ignore', detached: true, windowsHide: false })
        .on('error', () => {
          o.log('[service] the launcher window didn\'t open; opening it in your browser instead');
          try {
            openTab(url, failed);
          } catch {
            failed();
          }
        })
        .unref();
      return 'opening the launcher in its own window…';
    }
    openTab(url, failed);
    return 'opening the launcher in your browser…';
  } catch {
    return `couldn't open a browser: open ${url} yourself`;
  }
}
