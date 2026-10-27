#!/usr/bin/env bash
# Tile Trigger hub box: bootstrap/update an Ubuntu 24.04 Lightsail instance.
# Run as root ON THE INSTANCE by infra/deploy-multiplayer.sh (over SSH):
#
#   sudo bash host-setup.sh /path/to/bootstrap.env
#
# bootstrap.env (written by the deploy script, mode 0600, deleted after use):
#   DOMAIN=trigger.toshiroplay.com      site + hub hostname (Caddy, HTTPS/WSS)
#   ROOT_DOMAIN=toshiroplay.com         optional: Caddy redirects it to DOMAIN
#   TURN_HOST=trigger.toshiroplay.com   hostname in the TURN URLs players get
#   STATIC_IP=203.0.113.10              the Lightsail static IP (coturn external-ip)
#   REPO=https://github.com/…  BRANCH=main  REF=<commit, optional>
#   ICE_TTL=3600                        TURN credential lifetime (seconds)
#   TURN_SECRET=…  HUB_SIGNING_SECRET=… (from SSM SecureStrings; never in Git)
#   COGNITO_REGION=… COGNITO_USER_POOL_ID=… COGNITO_APP_CLIENT_ID=… COGNITO_DOMAIN=…
#   HOST_FIREWALL=1                     ufw on the box as well as Lightsail's firewall
#
# Same pieces as deploy/aws-lightsail-setup.sh (site + hub + coturn + Caddy),
# with: secrets from SSM instead of generated on the box, 1 h TURN
# credentials, coturn quotas/bandwidth caps and denied peers (incl. the box's
# own addresses), crash-loop-safe restarts, systemd hardening for the hub,
# Caddy security headers and body limits, bounded journald, and ufw.
# Idempotent: every run converges the box to this state.
set -euo pipefail

CONF="${1:?usage: host-setup.sh <bootstrap.env>}"
[ "$(id -u)" = 0 ] || { echo "run as root"; exit 1; }
# shellcheck disable=SC1090
. "$CONF"
: "${DOMAIN:?}" "${STATIC_IP:?}" "${TURN_SECRET:?}" "${HUB_SIGNING_SECRET:?}"
TURN_HOST="${TURN_HOST:-$DOMAIN}"
ROOT_DOMAIN="${ROOT_DOMAIN:-}"
REPO="${REPO:-https://github.com/Dsoto1/splitters.git}"
BRANCH="${BRANCH:-main}"
REF="${REF:-}"
ICE_TTL="${ICE_TTL:-3600}"
HOST_FIREWALL="${HOST_FIREWALL:-1}"
APP=/opt/tiletrigger
ENV_FILE=/etc/tiletrigger.env

export DEBIAN_FRONTEND=noninteractive
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
log() { printf '== %s\n' "$*"; }
log "Tile Trigger host setup for $DOMAIN (branch $BRANCH${REF:+ @ $REF})"

# ---------------------------------------------------------------- base system
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg debian-keyring debian-archive-keyring \
  apt-transport-https coturn ufw unattended-upgrades python3 >/dev/null
# Security updates install themselves (Ubuntu's default, made explicit).
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades

# Bounded logs (journald holds the hub, coturn and Caddy logs).
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=300M\nMaxRetentionSec=14day\n' > /etc/systemd/journald.conf.d/tiletrigger.conf
systemctl restart systemd-journald

# Node 22 (NodeSource) and pnpm (corepack).
if ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
corepack enable

# Caddy (HTTPS certificates fetched and renewed automatically).
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

# ---------------------------------------------------------------- the game
id tiletrigger >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin tiletrigger
mkdir -p "$APP" && chown tiletrigger:tiletrigger "$APP"
as_app() { sudo -u tiletrigger -H env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 bash -c "cd $APP && $1"; }
if [ -d "$APP/.git" ]; then
  as_app "git remote set-url origin '$REPO' && git fetch -q origin '$BRANCH' && git checkout -q -B '$BRANCH' 'origin/$BRANCH'"
else
  as_app "git clone -q --branch '$BRANCH' '$REPO' ."
fi
[ -n "$REF" ] && as_app "git fetch -q origin '$REF' 2>/dev/null || true; git reset -q --hard '$REF'"
log "Building $(as_app 'git log -1 --format="%h %s"') (a few minutes)…"
as_app "corepack pnpm install --frozen-lockfile && VITE_HUB=self corepack pnpm build"

# ---------------------------------------------------------------- hub runtime config
# The hub reads TURN_SECRET/TURN_URLS/ICE_TTL today (packages/server/src/ice.ts);
# the rest is for the authenticated hub (docs/MULTIPLAYER_PROTOCOL.md).
umask 027
cat > "$ENV_FILE.new" <<ENV
TURN_SECRET=$TURN_SECRET
TURN_URLS=turn:$TURN_HOST:3478 turn:$TURN_HOST:3478?transport=tcp
ICE_TTL=$ICE_TTL
HUB_SIGNING_SECRET=$HUB_SIGNING_SECRET
PUBLIC_ORIGIN=https://$DOMAIN
COGNITO_REGION=${COGNITO_REGION:-}
COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID:-}
COGNITO_APP_CLIENT_ID=${COGNITO_APP_CLIENT_ID:-}
COGNITO_DOMAIN=${COGNITO_DOMAIN:-}
ENV
chown root:tiletrigger "$ENV_FILE.new" && chmod 640 "$ENV_FILE.new" && mv "$ENV_FILE.new" "$ENV_FILE"
umask 022

# ---------------------------------------------------------------- coturn
PRIVATE_IP="$(hostname -I | awk '{print $1}')"
cat > /etc/turnserver.conf.new <<TURN
# Managed by infra/host-setup.sh: edits are overwritten on the next deploy.
listening-port=3478
external-ip=$STATIC_IP/$PRIVATE_IP
min-port=49160
max-port=49200
# Short-lived REST credentials only (the hub signs them; ICE_TTL=$ICE_TTL s).
use-auth-secret
static-auth-secret=$TURN_SECRET
realm=$DOMAIN
fingerprint
stale-nonce=600
no-cli
# No TURNS/DTLS listeners (5349 is closed in the firewall; TURN over TLS on 443 is a later option).
no-tls
no-dtls
no-multicast-peers
# Game traffic is WebRTC data channels over UDP: no TCP relay allocations.
no-tcp-relay
# Bounds (docs/MULTIPLAYER_SECURITY.md): allocations in total (= the 41 relay ports) and per
# credential; bytes/s per session (a relayed player needs ~3-10 KB/s) and for the whole relay
# (2 MB/s out = at most ~5 TB/month even if abused around the clock; the NetworkOut alarm fires
# at 1 MB/s sustained).
total-quota=40
user-quota=8
max-bps=48000
bps-capacity=2000000
max-allocate-lifetime=3600
# Relay only to the internet: never to loopback, private networks (this box's private IP is in
# 172.16/12) or cloud metadata. The static IP itself stays allowed: two players who both need
# the relay reach each other through it (relay address to relay address).
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.0.2.0-192.0.2.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=198.51.100.0-198.51.100.255
denied-peer-ip=203.0.113.0-203.0.113.255
denied-peer-ip=240.0.0.0-255.255.255.255
denied-peer-ip=::1
denied-peer-ip=64:ff9b::-64:ff9b::ffff:ffff
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
# Logs to syslog/journald (bounded above); per-session usage lines show relay consumption.
syslog
TURN
chown root:turnserver /etc/turnserver.conf.new && chmod 640 /etc/turnserver.conf.new && mv /etc/turnserver.conf.new /etc/turnserver.conf
sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true

# ---------------------------------------------------------------- restart policies
# Never give up, but back off: 5 s doubling to 5 min between restarts (no tight crash loop).
for unit in coturn caddy tiletrigger-hub; do
  mkdir -p "/etc/systemd/system/$unit.service.d"
  cat > "/etc/systemd/system/$unit.service.d/10-restart.conf" <<UNIT
[Unit]
StartLimitIntervalSec=0

[Service]
Restart=always
RestartSec=5
RestartSteps=6
RestartMaxDelaySec=300
UNIT
done

cat > /etc/systemd/system/tiletrigger-hub.service <<UNIT
[Unit]
Description=Tile Trigger hub (site, signaling, game browser, TURN credentials)
After=network-online.target
Wants=network-online.target

[Service]
User=tiletrigger
Group=tiletrigger
WorkingDirectory=$APP
Environment=PORT=8080 HOST=127.0.0.1 TRUST_PROXY=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_ENV=production
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/corepack pnpm --filter @tiletrigger/server hub
KillSignal=SIGTERM
TimeoutStopSec=15
# Hardening: the hub needs nothing but its own folder and the network.
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectHome=yes
ProtectSystem=full
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
RestrictNamespaces=yes
LockPersonality=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
MemoryMax=768M
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

# ---------------------------------------------------------------- Caddy
{
  printf '{\n\tadmin localhost:2019\n}\n\n'
  printf '%s {\n' "$DOMAIN"
  printf '\tencode zstd gzip\n'
  printf '\trequest_body {\n\t\tmax_size 1MB\n\t}\n'
  printf '\theader {\n'
  printf '\t\tStrict-Transport-Security "max-age=31536000"\n'
  printf '\t\tX-Content-Type-Options "nosniff"\n'
  printf '\t\tReferrer-Policy "strict-origin-when-cross-origin"\n'
  printf '\t\tX-Frame-Options "SAMEORIGIN"\n'
  printf '\t\tPermissions-Policy "camera=(), microphone=(), geolocation=()"\n'
  printf '\t\t-Server\n'
  printf '\t}\n'
  printf '\treverse_proxy 127.0.0.1:8080\n'
  printf '}\n'
  if [ -n "$ROOT_DOMAIN" ]; then
    printf '\n%s {\n\tredir https://%s{uri} 302\n}\n' "$ROOT_DOMAIN" "$DOMAIN"
  fi
} > /etc/caddy/Caddyfile.new
caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile >/dev/null 2>&1 || { echo "Caddyfile invalid"; caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile; exit 1; }
mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile

# ---------------------------------------------------------------- host firewall (defence in depth)
if [ "$HOST_FIREWALL" = 1 ]; then
  ufw --force default deny incoming >/dev/null
  ufw --force default allow outgoing >/dev/null
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 3478/tcp >/dev/null
  ufw allow 3478/udp >/dev/null
  ufw allow 49160:49200/udp >/dev/null
  ufw --force enable >/dev/null
fi

# ---------------------------------------------------------------- start everything
systemctl daemon-reload
systemctl enable -q caddy tiletrigger-hub
if [ -f /etc/tiletrigger-relay-off ]; then
  log "Relay was switched off (tiletrigger-relay off): leaving coturn stopped"
else
  systemctl enable -q coturn
  systemctl restart coturn
fi
systemctl restart tiletrigger-hub
systemctl reload-or-restart caddy

# One-line code updates later (secrets/config only change through the deploy script).
cat > /usr/local/bin/tiletrigger-update <<UPD
#!/usr/bin/env bash
set -euo pipefail
sudo -u tiletrigger -H env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 bash -c "cd $APP && git fetch -q origin $BRANCH && git reset -q --hard origin/$BRANCH && corepack pnpm install --frozen-lockfile && VITE_HUB=self corepack pnpm build"
systemctl restart tiletrigger-hub
echo "Tile Trigger updated to \$(sudo -u tiletrigger git -C $APP log -1 --format='%h %s')"
UPD
chmod 755 /usr/local/bin/tiletrigger-update

# Relay kill switch for abuse or a cost spike: `sudo tiletrigger-relay off` (on, status).
# Direct connections keep working; players behind strict NATs can't join until it is back on.
cat > /usr/local/bin/tiletrigger-relay <<'RELAY'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-status}" in
  off) systemctl disable --now coturn && echo "relay OFF (coturn stopped; stays off across reboots and deploys until 'on')" && touch /etc/tiletrigger-relay-off ;;
  on) rm -f /etc/tiletrigger-relay-off && systemctl enable --now coturn && echo "relay ON" ;;
  status) echo "coturn: $(systemctl is-active coturn || true)"; journalctl -u coturn --since today -o cat | grep -c 'session.*closed' | xargs echo "sessions closed today:" ;;
  *) echo "usage: tiletrigger-relay on|off|status"; exit 2 ;;
esac
RELAY
chmod 755 /usr/local/bin/tiletrigger-relay

# ---------------------------------------------------------------- local health
up=no
for _ in $(seq 1 60); do curl -fsS http://127.0.0.1:8080/lobby/health >/dev/null 2>&1 && { up=yes; break; }; sleep 1; done
for svc in coturn caddy tiletrigger-hub; do
  printf '   %-16s %s\n' "$svc" "$(systemctl is-active "$svc" || true)"
done
if [ "$up" != yes ]; then
  echo "Hub did not answer on 127.0.0.1:8080/lobby/health. Logs: journalctl -u tiletrigger-hub -n 80"
  exit 1
fi
log "Hub healthy: $(curl -fsS http://127.0.0.1:8080/lobby/health)"
log "Deployed $(as_app 'git log -1 --format="%h %s"')"
