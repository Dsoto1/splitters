#!/usr/bin/env python3
"""Tile Trigger hub state backups (installed on the box as /usr/local/bin/tiletrigger-backup by infra/host-setup.sh).

  tiletrigger-backup                 copy /var/lib/tiletrigger (profiles, community, published maps) to the
                                     backup bucket now (the nightly timer runs this)
  tiletrigger-backup --check         say what would be copied, and where; upload nothing
  tiletrigger-backup --restore FILE  unpack a backup into the empty state folder (the deploy does this on a
                                     fresh box, before the hub starts); --force moves a non-empty one aside first

The box has no AWS role (Lightsail has none) and no AWS CLI: this signs one S3 PUT itself (Signature V4,
standard library only) with the put-only key in /etc/tiletrigger-backup.conf (root, 0600, written by the
deploy from SSM). The key can add objects under backups/ and nothing else: it can't list, read or delete.
Backups are tar.gz files named backups/tiletrigger-<UTC time>.tar.gz; the bucket keeps them
BackupRetentionDays (30) days (docs/HOSTING.md, "Backups").
"""
import datetime
import hashlib
import hmac
import io
import os
import pwd
import shutil
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request

CONF = os.environ.get('TILETRIGGER_BACKUP_CONF', '/etc/tiletrigger-backup.conf')
STATE = os.environ.get('TILETRIGGER_STATE', '/var/lib/tiletrigger')
PARTS = ('profiles', 'community', 'maps')


def conf():
    out = {}
    with open(CONF) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                out[k.strip()] = v.strip()
    for k in ('BUCKET', 'REGION', 'KEY_ID', 'SECRET'):
        if not out.get(k):
            sys.exit(f'{CONF}: {k} is missing (re-run infra/deploy-multiplayer.sh)')
    return out


def archive():
    """The state folder's parts as one tar.gz in memory (a few MB at most at this scale)."""
    buf = io.BytesIO()
    found = []
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        for part in PARTS:
            path = os.path.join(STATE, part)
            if os.path.isdir(path):
                tar.add(path, arcname=part, filter=lambda t: None if t.issym() or t.islnk() else t)
                found.append(part)
    return buf.getvalue(), found


def sign(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def put(c, key, body):
    host = f"{c['BUCKET']}.s3.{c['REGION']}.amazonaws.com"
    path = '/' + urllib.parse.quote(key, safe='/-_.~')
    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date, day = now.strftime('%Y%m%dT%H%M%SZ'), now.strftime('%Y%m%d')
    payload = hashlib.sha256(body).hexdigest()
    headers = {'host': host, 'x-amz-content-sha256': payload, 'x-amz-date': amz_date}
    signed = ';'.join(sorted(headers))
    canonical = '\n'.join(['PUT', path, '', *(f'{k}:{headers[k]}' for k in sorted(headers)), '', signed, payload])
    scope = f"{day}/{c['REGION']}/s3/aws4_request"
    to_sign = '\n'.join(['AWS4-HMAC-SHA256', amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    k = sign(('AWS4' + c['SECRET']).encode(), day)
    for part in (c['REGION'], 's3', 'aws4_request'):
        k = sign(k, part)
    signature = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(f'https://{host}{path}', data=body, method='PUT', headers={
        'x-amz-content-sha256': payload, 'x-amz-date': amz_date, 'Content-Type': 'application/gzip',
        'Content-Length': str(len(body)),
        'Authorization': f"AWS4-HMAC-SHA256 Credential={c['KEY_ID']}/{scope}, SignedHeaders={signed}, Signature={signature}",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status
    except urllib.error.HTTPError as e:
        # The error body names the problem (never the key); keep it short for the journal.
        sys.exit(f'upload refused: HTTP {e.code} {e.read()[:300].decode(errors="replace")}')


def backup(check):
    body, found = archive()
    key = 'backups/tiletrigger-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.tar.gz'
    if not found:
        print(f'nothing to back up yet ({STATE} has none of {", ".join(PARTS)})')
        return
    if check:
        c = conf()
        print(f"would upload {len(body)} bytes ({', '.join(found)}) to s3://{c['BUCKET']}/{key}")
        return
    c = conf()
    put(c, key, body)
    print(f"backed up {', '.join(found)}: {len(body)} bytes to s3://{c['BUCKET']}/{key}")


def restore(file, force):
    if os.path.isdir(STATE) and os.listdir(STATE):
        if not force:
            sys.exit(f'{STATE} is not empty: not restoring over it (--force moves it aside first)')
        aside = STATE + '.before-restore-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        shutil.move(STATE, aside)
        print(f'moved the current state aside to {aside}')
    os.makedirs(STATE, mode=0o750, exist_ok=True)
    with tarfile.open(file, mode='r:gz') as tar:
        for m in tar.getmembers():
            top = m.name.split('/', 1)[0]
            if top not in PARTS or not (m.isfile() or m.isdir()):
                sys.exit(f'refusing the backup: unexpected entry {m.name!r}')
        # 'data': no absolute paths, no .., no links or devices, no special modes.
        tar.extractall(STATE, filter='data')
    try:
        pwd.getpwnam('tiletrigger')
    except KeyError:
        pass  # a rehearsal off the box
    else:
        shutil.chown(STATE, 'tiletrigger', 'tiletrigger')
        for root, dirs, files in os.walk(STATE):
            for n in dirs + files:
                shutil.chown(os.path.join(root, n), 'tiletrigger', 'tiletrigger')
    os.chmod(STATE, 0o750)
    print(f'restored {", ".join(sorted(p for p in PARTS if os.path.isdir(os.path.join(STATE, p))))} into {STATE}')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['--restore'] and len(args) >= 2:
        restore(args[1], '--force' in args[2:])
    elif args in ([], ['--check']):
        backup(args == ['--check'])
    else:
        sys.exit(__doc__)
