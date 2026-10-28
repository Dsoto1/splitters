// Packages the Host Service for players' computers: one download per OS that needs no git, pnpm or
// Node install. Each is a folder (zip, or tar.gz for Linux) holding the official Node runtime, the
// service bundled into one file (esbuild), node-datachannel's prebuilt WebRTC module for that OS,
// our suite's maps, and a start file to double-click. (A true single executable isn't practical yet:
// Node's single-executable apps can't load a native module from inside themselves.)
//
//   node packages/host/tools/package.mjs [--out dir] [--targets linux-x64,windows-x64,macos-arm64,macos-x64] [--bundle-only]
//
// Downloads are checked: Node against nodejs.org's SHASUMS256.txt, npm packages by npm's own integrity check.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, chmodSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const ROOT = resolve(PKG, '../..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const OUT = resolve(opt('--out', join(ROOT, 'host-release')));
/** The Node runtime shipped (an LTS line; bump with care: node-datachannel's prebuilds use N-API, so any recent Node works). */
const NODE_VERSION = opt('--node', '22.22.0');
const NDC_VERSION = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')).dependencies['node-datachannel'];
const VERSION = JSON.parse(readFileSync(join(ROOT, 'packages/client/package.json'), 'utf8')).version;
const TARGETS = {
  'linux-x64': { node: `node-v${NODE_VERSION}-linux-x64.tar.gz`, bin: 'bin/node', exe: 'node', ndc: 'linux-x64-gnu', archive: 'tar.gz' },
  'windows-x64': { node: `node-v${NODE_VERSION}-win-x64.zip`, bin: 'node.exe', exe: 'node.exe', ndc: 'win32-x64-msvc', archive: 'zip' },
  'macos-arm64': { node: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`, bin: 'bin/node', exe: 'node', ndc: 'darwin-arm64', archive: 'zip' },
  'macos-x64': { node: `node-v${NODE_VERSION}-darwin-x64.tar.gz`, bin: 'bin/node', exe: 'node', ndc: 'darwin-x64', archive: 'zip' },
};
const targets = opt('--targets', Object.keys(TARGETS).join(',')).split(',').filter(Boolean);
for (const t of targets) if (!TARGETS[t]) throw new Error(`unknown target ${t} (${Object.keys(TARGETS).join(', ')})`);

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const CACHE = join(OUT, '.cache');
mkdirSync(CACHE, { recursive: true });

async function download(url, file) {
  if (existsSync(file)) return file;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** The service as one ES module (node-datachannel stays outside: it loads a native module). */
async function bundle(dir) {
  mkdirSync(dir, { recursive: true });
  await build({
    entryPoints: [join(PKG, 'src/main.ts')],
    outfile: join(dir, 'host.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['node-datachannel', 'node-datachannel/*', 'bufferutil', 'utf-8-validate'],
    // CommonJS dependencies (PeerJS, ws) call require(): give the bundle one.
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    legalComments: 'external',
    logLevel: 'warning',
  });
  writeFileSync(join(dir, 'version.txt'), `${VERSION}\n`);
  // Our suite: the maps a host may run and change to (not the imported ones or tools' files).
  mkdirSync(join(dir, 'maps'), { recursive: true });
  for (const f of readdirSync(join(ROOT, 'maps'))) if (f.endsWith('.json')) copyFileSync(join(ROOT, 'maps', f), join(dir, 'maps', f));
  // node-datachannel's JavaScript and its one dependency, from the lockfile's install.
  const store = join(ROOT, 'node_modules/.pnpm');
  const from = (name) => {
    const d = readdirSync(store).find((x) => x.startsWith(`${name.replace('/', '+')}@`));
    if (!d) throw new Error(`${name} is not installed (pnpm install)`);
    return join(store, d, 'node_modules', name);
  };
  for (const name of ['node-datachannel', 'detect-libc']) {
    const src = from(name);
    cpSync(src, join(dir, 'node_modules', name), { recursive: true, dereference: true, filter: (p) => !/\/(src|test|cpp|build|\.github)(\/|$)/.test(p.slice(src.length)) });
  }
}

/** node-datachannel's prebuilt native module for one OS (npm checks its integrity). */
function nativeModule(plat, dir) {
  const name = `@node-datachannel/${plat}`;
  const tgz = run('npm', ['pack', `${name}@${NDC_VERSION}`, '--silent', '--pack-destination', CACHE]).trim().split('\n').pop();
  const dest = join(dir, 'node_modules', name);
  mkdirSync(dest, { recursive: true });
  run('tar', ['-xzf', join(CACHE, tgz), '-C', dest, '--strip-components=1']);
}

async function nodeRuntime(t, dir) {
  const base = `https://nodejs.org/dist/v${NODE_VERSION}`;
  const sums = await download(`${base}/SHASUMS256.txt`, join(CACHE, `SHASUMS256-${NODE_VERSION}.txt`));
  const archive = await download(`${base}/${t.node}`, join(CACHE, t.node));
  const want = readFileSync(sums, 'utf8').split('\n').find((l) => l.endsWith(`  ${t.node}`))?.split(/\s+/)[0];
  if (!want || want !== sha256(archive)) throw new Error(`${t.node}: checksum mismatch`);
  const top = t.node.replace(/\.(tar\.gz|zip)$/, '');
  if (t.node.endsWith('.zip')) run('unzip', ['-o', '-j', archive, `${top}/${t.bin}`, '-d', dir]);
  else run('tar', ['-xzf', archive, '-C', dir, '--strip-components=2', `${top}/${t.bin}`]);
  copyFileSync(join(CACHE, `SHASUMS256-${NODE_VERSION}.txt`), join(dir, 'app', 'node-SHASUMS256.txt'));
}

const README = `Tile Trigger Host Service ${VERSION}

A dedicated host for Tile Trigger: people join your server from https://trigger.toshiroplay.com
(the game browser, or your join code). No port forwarding, no certificates, no browser tab.

Start:  double-click the start file (Windows: "Start Tile Trigger Host.cmd";
        macOS: right-click "Start Tile Trigger Host.command" → Open the first time;
        Linux: ./start-host.sh in a terminal).
        A server window opens and the server starts (Frost Basin, 24 players and bots, listed).
Manage: type help in that window, or open https://trigger.toshiroplay.com/host (the window shows
        the link that pairs your browser with this server).
Stop:   type quit, or close the window.

Your settings, bans and the pairing key are kept in your user profile; logs in ./logs.
Nothing here needs administrator rights, and nothing on your computer is opened to the internet.
More: https://github.com/Dsoto1/splitters/blob/main/docs/HOSTING.md ("Dedicated host").
`;

const START = {
  cmd: `@echo off\r\ntitle Tile Trigger Host\r\ncd /d "%~dp0"\r\nset "HOST_APP_DIR=%~dp0."\r\n"%~dp0node.exe" "%~dp0app\\host.mjs" %*\r\nif errorlevel 1 pause\r\n`,
  sh: `#!/bin/sh\n# Tile Trigger Host Service: a server window; type help, or close it to stop.\ncd "$(dirname "$0")" || exit 1\n# Downloaded files are quarantined on macOS: you opened this file deliberately, so let its own runtime run.\n[ "$(uname)" = Darwin ] && xattr -dr com.apple.quarantine . 2>/dev/null\nHOST_APP_DIR="$(pwd)" exec ./node app/host.mjs "$@"\n`,
};

rmSync(join(OUT, 'stage'), { recursive: true, force: true });
const app = join(OUT, 'stage', 'app-common');
await bundle(app);
console.log(`bundled ${join(app, 'host.mjs')}`);
if (!argv.includes('--bundle-only')) {
  for (const name of targets) {
    const t = TARGETS[name];
    const folder = 'tiletrigger-host';
    const root = join(OUT, 'stage', name, folder);
    mkdirSync(root, { recursive: true });
    cpSync(app, join(root, 'app'), { recursive: true });
    nativeModule(t.ndc, join(root, 'app'));
    await nodeRuntime(t, root);
    writeFileSync(join(root, 'README.txt'), README.replace(/\n/g, name.startsWith('windows') ? '\r\n' : '\n'));
    if (name.startsWith('windows')) writeFileSync(join(root, 'Start Tile Trigger Host.cmd'), START.cmd);
    else {
      const file = join(root, name.startsWith('macos') ? 'Start Tile Trigger Host.command' : 'start-host.sh');
      writeFileSync(file, START.sh);
      chmodSync(file, 0o755);
      chmodSync(join(root, t.exe), 0o755);
    }
    const out = join(OUT, `tiletrigger-host-${name}.${t.archive}`);
    rmSync(out, { force: true });
    // Fixed times and order: the same inputs give the same archive.
    run('find', [folder, '-exec', 'touch', '-h', '-d', '2026-01-01T00:00:00Z', '{}', '+'], join(OUT, 'stage', name));
    if (t.archive === 'zip') run('zip', ['-q', '-r', '-X', out, folder], join(OUT, 'stage', name));
    else run('tar', ['--sort=name', '--owner=0', '--group=0', '--numeric-owner', '-czf', out, folder], join(OUT, 'stage', name));
    console.log(`${out}  ${sha256(out)}`);
  }
}
