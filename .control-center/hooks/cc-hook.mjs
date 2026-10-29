#!/usr/bin/env node
// cc-hook.mjs — Claude Code hooks for the Project Control Center (docs/AGENT_ACCESS.md). No secrets in this file.
//   start : print this project's memory (approved decisions, open tasks, recent sessions, shared lessons) into the new session
//   stop  : after a reply, send the session in the background at most every 15 minutes (cloud sessions may never "end")
//   end   : send the session one last time (transcript + .control-center/session-summary.json if the agent wrote one)
// And for agents, by hand (v0.72): `template <name>` prints one of the owner's templates; `propose <name> <file> [note]` sends a
// changed (or new) template for the owner to approve. Unlike the hooks, these print their errors.
// Needs CONTROL_CENTER_URL and CONTROL_CENTER_KEY in the environment (never in the repo); without them it does nothing.
// With an account key (v0.71) the project comes from this repo and the account from the key. With a per-project key, optional:
// CONTROL_CENTER_ACCOUNT = the account profile nickname (e.g. "Claude A"). Every failure is silent to the session.
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_ = (process.env.CONTROL_CENTER_URL || '').replace(/\/+$/, '');
// the key only ever goes to an https address (plain http only to this machine, for testing)
const SAFE = /^https:\/\/[^/]+$/.test(URL_) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(URL_);
const KEY = process.env.CONTROL_CENTER_KEY || '';
const MAX = 25 * 1024 * 1024;
const EVERY_MS = 15 * 60 * 1000;
const mode = process.argv[2];
const log = (m) => process.stderr.write(`[control-center] ${m}\n`);
// which project this repo is, so the dashboard refuses a key that belongs to another project (409, nothing read or sent)
let WHO = {};
function whoAmI(projectDir) {
  const h = {};
  try {
    const slug = JSON.parse(readFileSync(join(projectDir, '.control-center', 'project.json'), 'utf8')).slug;
    if (typeof slug === 'string' && /^[a-z0-9-]{1,64}$/.test(slug)) h['x-control-center-project'] = slug;
  } catch { /* no manifest */ }
  try {
    const url = execFileSync('git', ['-C', projectDir, 'config', '--get', 'remote.origin.url'], { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    // only GitHub remotes (https, ssh) and the cloud sessions' git proxy (…/git/owner/repo); anything else isn't reported
    const m = url.match(/^(?:https:\/\/(?:[^@/]+@)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/]|https?:\/\/[^/]+\/git\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
    if (m) h['x-control-center-repo'] = `${m[1]}/${m[2]}`;
  } catch { /* not a git checkout */ }
  return h;
}

async function stdinJson() {
  if (process.stdin.isTTY) return {};
  let s = '';
  for await (const c of process.stdin) s += c;
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

async function call(method, path, body, ms) {
  const r = await fetch(URL_ + path, { method, signal: AbortSignal.timeout(ms), redirect: 'error',
    headers: { authorization: `Bearer ${KEY}`, ...WHO, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`${method} ${path}: HTTP ${r.status} ${text.slice(0, 200)}`), { status: r.status, text });
  return text;
}

/** When this session began: the first timestamp in its transcript (or the file's creation time). */
function sessionStart(transcriptPath) {
  try {
    const first = readFileSync(transcriptPath, 'utf8').slice(0, 20_000).split('\n').map((l) => { try { return JSON.parse(l).timestamp; } catch { return null; } }).find(Boolean);
    if (first && !Number.isNaN(Date.parse(first))) return Date.parse(first);
    return statSync(transcriptPath).birthtimeMs || 0;
  } catch { return 0; }
}

async function send(transcriptPath, sessionId, projectDir, final) {
  const summaryFile = projectDir ? join(projectDir, '.control-center', 'session-summary.json') : null;
  let summary;
  // a summary file left by an earlier session (one that never "ended") is not attached to this one
  const fresh = summaryFile && existsSync(summaryFile) && statSync(summaryFile).mtimeMs >= sessionStart(transcriptPath) - 60_000;
  if (fresh && statSync(summaryFile).size < 200_000) {
    try { summary = JSON.parse(readFileSync(summaryFile, 'utf8')); } catch { log('session-summary.json is not valid JSON; sending the transcript only'); }
  }
  let buf = null;
  if (transcriptPath && existsSync(transcriptPath) && statSync(transcriptPath).size <= MAX) buf = readFileSync(transcriptPath);
  if (!buf && !summary) return;
  const start = JSON.parse(await call('POST', '/api/agent/sessions', {
    claudeSessionId: sessionId, ...(buf ? { size: buf.length, sha256: createHash('sha256').update(buf).digest('hex') } : {}) }, 8_000));
  if (buf) {
    const put = await fetch(start.uploadUrl, { method: 'PUT', body: buf, headers: { 'content-type': 'application/octet-stream' }, signal: AbortSignal.timeout(22_000) });
    if (!put.ok) throw new Error(`upload: HTTP ${put.status}`);
  }
  // timeouts add up to under the 60 s SessionEnd budget (8 + 22 + 28)
  await call('POST', `/api/agent/sessions/${start.uploadId}/commit`, { summary, agentTool: 'claude-code', final,
    accountLabel: process.env.CONTROL_CENTER_ACCOUNT || undefined }, 28_000);
  if (final && summary && summaryFile) { try { unlinkSync(summaryFile); } catch { /* already gone */ } }
}

async function main() {
  if (!URL_ || !KEY) return; // not set up on this machine / environment: do nothing
  if (!SAFE) { log('CONTROL_CENTER_URL must be an https:// address with no path; nothing sent'); return; }
  if (mode === 'send') { WHO = whoAmI(process.argv[5] || '.'); await send(process.argv[3], process.argv[4], process.argv[5], false); return; }
  if (mode === 'template' || mode === 'propose') {
    WHO = whoAmI(process.env.CLAUDE_PROJECT_DIR || '.');
    const name = process.argv[3] || '';
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(name)) { process.stdout.write('Template names are lower-case letters, digits and dashes.\n'); return; }
    try {
      if (mode === 'template') { process.stdout.write(await call('GET', `/api/agent/templates/${name}`, null, 10_000)); return; }
      const file = process.argv[4];
      if (!file || !existsSync(file) || statSync(file).size > 200_000) { process.stdout.write('Usage: propose <name> <file under 200 KB> [note]\n'); return; }
      const r = JSON.parse(await call('POST', `/api/agent/templates/${name}/proposals`, { text: readFileSync(file, 'utf8'), note: process.argv.slice(5).join(' ') || undefined }, 15_000));
      process.stdout.write(`Proposed ${name} v${r.proposedVersion} for the owner to approve${r.redactions ? ` (${r.redactions} secret-looking item(s) redacted)` : ''}.\n`);
    } catch (e) {
      let m = ''; try { m = JSON.parse(e.text).message; } catch { /* plain */ }
      process.stdout.write(`Project Control Center: ${m || e.message}\n`);
    }
    return;
  }
  const input = await stdinJson();
  const sid = typeof input.session_id === 'string' ? input.session_id : '';
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || '';
  WHO = whoAmI(projectDir || '.');
  if (mode === 'start') {
    try {
      process.stdout.write(await call('GET', '/api/agent/context', null, 5_000));
    } catch (e) {
      // tell the session (and through it the owner) when the environment's key is another project's
      if (e.status === 409) { let m = ''; try { m = JSON.parse(e.text).message; } catch { /* plain */ } process.stdout.write(`Project Control Center: ${m || 'this key belongs to another project'}\n`); return; }
      throw e;
    }
    return;
  }
  if (!sid) return;
  if (mode === 'stop') {
    const mark = join(tmpdir(), `control-center-${sid.replace(/[^A-Za-z0-9-]/g, '')}.json`);
    let last = 0;
    try { last = JSON.parse(readFileSync(mark, 'utf8')).at || 0; } catch { /* first time */ }
    if (Date.now() - last < EVERY_MS) return;
    writeFileSync(mark, JSON.stringify({ at: Date.now() }));
    // in the background, so the reply isn't held up
    spawn(process.execPath, [process.argv[1], 'send', input.transcript_path || '', sid, projectDir], { detached: true, stdio: 'ignore', windowsHide: true, env: process.env }).unref();
    return;
  }
  if (mode === 'end') await send(input.transcript_path, sid, projectDir, true);
}

main().catch((e) => log(String(e && e.message ? e.message : e))).finally(() => process.exit(0));
