#!/usr/bin/env python3
"""Check that a coturn server is NOT an open relay (standard library only).

Runs from anywhere with UDP egress (AWS CloudShell, the instance itself):

  python3 infra/turn-check.py --host 203.0.113.10 [--port 3478] [--secret-file F] [--realm R]

Checks, over UDP:
  1. Allocate with no credentials             -> must be refused (401).
  2. Allocate with a made-up username/password -> must be refused (401).
  3. Allocate with an EXPIRED REST credential  -> must be refused (401).   [needs --secret-file]
  4. Allocate with a valid short-lived one     -> must succeed.             [needs --secret-file]
  5. CreatePermission towards private / loopback / link-local peers on
     that allocation                           -> must be refused (403).   [needs --secret-file]
The allocation is released (Refresh, lifetime 0) at the end.

Exit status: 0 all checks passed, 1 a check failed (open relay or broken
auth), 2 no answer (port blocked / server down: inconclusive).

The secret file holds coturn's static-auth-secret (use-auth-secret mode,
the TURN REST scheme the hub uses: username "<expiry>:<id>", password
base64(HMAC-SHA1(secret, username))). It is read from a file so it never
appears in a process list.
"""
import argparse
import base64
import hashlib
import hmac
import os
import socket
import struct
import sys
import time

MAGIC = 0x2112A442
ALLOCATE, REFRESH, CREATE_PERMISSION = 0x003, 0x004, 0x008
A_USERNAME, A_MI, A_ERROR, A_LIFETIME = 0x0006, 0x0008, 0x0009, 0x000D
A_XOR_PEER, A_REALM, A_NONCE, A_XOR_RELAYED, A_TRANSPORT = 0x0012, 0x0014, 0x0015, 0x0016, 0x0019


def msg_type(method, cls):
    # cls: 0 request, 1 indication, 2 success, 3 error (RFC 5389 section 6)
    m = method
    return (m & 0x000F) | ((m & 0x0070) << 1) | ((m & 0x0F80) << 2) | ((cls & 1) << 4) | ((cls & 2) << 7)


def split_type(t):
    cls = ((t >> 4) & 1) | ((t >> 7) & 2)
    method = (t & 0x000F) | ((t >> 1) & 0x0070) | ((t >> 2) & 0x0F80)
    return method, cls


def attr(kind, value):
    pad = (4 - len(value) % 4) % 4
    return struct.pack('!HH', kind, len(value)) + value + b'\0' * pad


def xor_addr(ip, port):
    packed = socket.inet_aton(ip)
    x_port = port ^ (MAGIC >> 16)
    x_ip = bytes(a ^ b for a, b in zip(packed, struct.pack('!I', MAGIC)))
    return struct.pack('!BBH', 0, 1, x_port) + x_ip


def build(method, attrs, key=None):
    tid = os.urandom(12)
    body = b''.join(attrs)
    if key is not None:
        # MESSAGE-INTEGRITY covers the header with a length that already counts the MI attribute (24 bytes).
        head = struct.pack('!HHI', msg_type(method, 0), len(body) + 24, MAGIC) + tid
        mac = hmac.new(key, head + body, hashlib.sha1).digest()
        body += attr(A_MI, mac)
    return tid, struct.pack('!HHI', msg_type(method, 0), len(body), MAGIC) + tid + body


def parse(data):
    if len(data) < 20:
        return None
    t, length, cookie = struct.unpack('!HHI', data[:8])
    if cookie != MAGIC:
        return None
    method, cls = split_type(t)
    attrs, i = {}, 20
    while i + 4 <= 20 + length and i + 4 <= len(data):
        k, n = struct.unpack('!HH', data[i:i + 4])
        attrs.setdefault(k, data[i + 4:i + 4 + n])
        i += 4 + n + ((4 - n % 4) % 4)
    err = None
    if A_ERROR in attrs and len(attrs[A_ERROR]) >= 4:
        e = attrs[A_ERROR]
        err = (e[2] & 0x7) * 100 + e[3]
    return {'tid': data[8:20], 'method': method, 'cls': cls, 'attrs': attrs, 'error': err}


class Turn:
    def __init__(self, host, port, timeout):
        self.addr = (socket.gethostbyname(host), port)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(timeout)

    def ask(self, method, attrs, key=None, tries=3):
        for _ in range(tries):
            tid, packet = build(method, attrs, key)
            self.sock.sendto(packet, self.addr)
            deadline = time.time() + self.sock.gettimeout()
            while time.time() < deadline:
                try:
                    data, _ = self.sock.recvfrom(2048)
                except socket.timeout:
                    break
                r = parse(data)
                if r and r['tid'] == tid:
                    return r
        return None


def long_term_key(username, realm, password):
    return hashlib.md5(f'{username}:{realm}:{password}'.encode()).digest()


def rest_credential(secret, ttl, ident='turn-check'):
    username = f'{int(time.time()) + ttl}:{ident}'
    password = base64.b64encode(hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()).decode()
    return username, password


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--host', required=True)
    ap.add_argument('--port', type=int, default=3478)
    ap.add_argument('--secret-file', help="file holding coturn's static-auth-secret (enables checks 3-5)")
    ap.add_argument('--timeout', type=float, default=2.0)
    args = ap.parse_args()

    turn = Turn(args.host, args.port, args.timeout)
    transport = attr(A_TRANSPORT, bytes([17, 0, 0, 0]))  # UDP
    failures = []

    def check(name, ok, detail):
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}: {detail}")
        if not ok:
            failures.append(name)

    print(f'TURN check against {turn.addr[0]}:{args.port}/udp')
    first = turn.ask(ALLOCATE, [transport])
    if first is None:
        print('  [????] no answer: UDP blocked on this network, firewall closed, or coturn down (inconclusive)')
        return 2
    check('unauthenticated Allocate refused', first['cls'] == 3 and first['error'] == 401,
          f"error {first['error']}" if first['cls'] == 3 else 'ALLOCATION GRANTED WITHOUT CREDENTIALS (open relay)')
    if first['cls'] != 3:
        return 1
    realm = first['attrs'].get(A_REALM, b'').decode(errors='replace')
    nonce = first['attrs'].get(A_NONCE, b'')
    if not realm or not nonce:
        check('server challenges with realm + nonce', False, 'no REALM/NONCE in the 401')
        return 1

    def allocate(username, password):
        # A fresh socket (5-tuple) per attempt: coturn answers 437 to a second Allocate on a 5-tuple it has seen.
        t = Turn(args.host, args.port, args.timeout)
        challenge = t.ask(ALLOCATE, [transport])
        if challenge is None:
            return None, None, None, t
        n = challenge['attrs'].get(A_NONCE, b'')
        key = long_term_key(username, realm, password)
        a = [attr(A_USERNAME, username.encode()), attr(A_REALM, realm.encode()), attr(A_NONCE, n)]
        return t.ask(ALLOCATE, [transport] + a, key), key, a, t

    bogus, _, _, _ = allocate('1:nobody', 'not-the-password')
    check('made-up credentials refused', bogus is not None and bogus['cls'] == 3 and bogus['error'] in (401, 438),
          'no answer' if bogus is None else (f"error {bogus['error']}" if bogus['cls'] == 3 else 'ALLOCATION GRANTED'))

    if not args.secret_file:
        print('  (no --secret-file: skipped expired/valid-credential and peer-restriction checks)')
        return 1 if failures else 0
    with open(args.secret_file, encoding='utf-8') as f:
        secret = f.read().strip()

    user, pw = rest_credential(secret, -3600)
    expired, _, _, _ = allocate(user, pw)
    check('expired REST credential refused', expired is not None and expired['cls'] == 3 and expired['error'] in (401, 438),
          'no answer' if expired is None else (f"error {expired['error']}" if expired['cls'] == 3 else 'ALLOCATION GRANTED'))

    user, pw = rest_credential(secret, 300)
    ok, key, auth, turn = allocate(user, pw)
    granted = ok is not None and ok['cls'] == 2
    check('valid short-lived credential accepted', granted,
          'allocated' if granted else ('no answer' if ok is None else f"error {ok['error']}"))
    if not granted:
        return 1

    for peer in ('127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1'):
        r = turn.ask(CREATE_PERMISSION, [attr(A_XOR_PEER, xor_addr(peer, 9))] + auth, key)
        refused = r is not None and r['cls'] == 3 and r['error'] == 403
        check(f'relay to {peer} refused', refused,
              'no answer' if r is None else (f"error {r['error']}" if r['cls'] == 3 else 'PERMISSION GRANTED'))

    turn.ask(REFRESH, [attr(A_LIFETIME, struct.pack('!I', 0))] + auth, key, tries=1)
    print('  allocation released')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
