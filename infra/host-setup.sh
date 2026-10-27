#!/usr/bin/env bash
# Tile Trigger hub box: bootstrap/update an Ubuntu 24.04 Lightsail instance.
# Run as root ON THE INSTANCE by infra/deploy-multiplayer.sh (over SSH):
#
#   sudo bash host-setup.sh /path/to/bootstrap.env
#
# tiletrigger-update.sh must sit next to this script (the deploy script copies both).
#
# bootstrap.env (written by the deploy script, mode 0600, deleted after use):
#   DOMAIN=trigger.toshiroplay.com      site + hub hostname (Caddy, HTTPS/WSS)
#   ROOT_DOMAIN=toshiroplay.com         optional: Caddy redirects it to DOMAIN
#   TURN_HOST=trigger.toshiroplay.com   hostname in the TURN URLs players get
#   STATIC_IP=203.0.113.10              the Lightsail static IP (coturn external-ip)
#   REPO=https://github.com/…           the hub's code (git; the hub runs from source)
#   Which site build (the box downloads the one CI built and tested; it never builds it unless asked):
#   RELEASE=vX.Y.Z  REF=<commit>  BRANCH=check/<name>  CHANNEL=main|stable   (first one set wins; default main)
#   BUILD_HERE=1                        build the site on the box instead (slow; explicit only)
#   AUTO_UPDATE=on|off                  hourly `tiletrigger-update --auto` timer (unset: left as it is; new box: off)
#   PROVENANCE=required|off             build-provenance check of downloads (default required)
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
CHANNEL="${CHANNEL:-main}"
RELEASE="${RELEASE:-}"
BRANCH="${BRANCH:-main}"
REF="${REF:-}"
BUILD_HERE="${BUILD_HERE:-0}"
AUTO_UPDATE="${AUTO_UPDATE:-}"
PROVENANCE="${PROVENANCE:-required}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/tiletrigger-update.sh" ] || { echo "tiletrigger-update.sh must be next to host-setup.sh"; exit 1; }
ICE_TTL="${ICE_TTL:-3600}"
HOST_FIREWALL="${HOST_FIREWALL:-1}"
APP=/opt/tiletrigger
SITE_ROOT=/opt/tiletrigger-site
ENV_FILE=/etc/tiletrigger.env

export DEBIAN_FRONTEND=noninteractive
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
log() { printf '== %s\n' "$*"; }
# What tiletrigger-update installs (the first of these that is set).
UPDATE_ARGS=()
if [ -n "$RELEASE" ]; then UPDATE_ARGS=(--release "$RELEASE")
elif [ -n "$REF" ]; then UPDATE_ARGS=(--sha "$REF")
elif [ "$BUILD_HERE" = 1 ] || [ "$BRANCH" != main ]; then UPDATE_ARGS=(--branch "$BRANCH")
else UPDATE_ARGS=(--channel "$CHANNEL"); fi
[ "$BUILD_HERE" = 1 ] && UPDATE_ARGS+=(--build-here)
[ "$PROVENANCE" = off ] && UPDATE_ARGS+=(--no-provenance)
log "Tile Trigger host setup for $DOMAIN (site: ${UPDATE_ARGS[*]})"

# ---------------------------------------------------------------- base system
# Swap as headroom: 2 GB. The box doesn't build the site any more; an explicit on-box build (BUILD_HERE=1)
# needs ~1.5 GB of heap, so then it grows to 4 GB (an existing larger swapfile is kept).
SWAP_GB=2; [ "$BUILD_HERE" = 1 ] && SWAP_GB=4
if swapon --show | grep -q /swapfile && [ "$(stat -c %s /swapfile)" -lt $((SWAP_GB * 1000000000)) ]; then
  swapoff /swapfile && rm -f /swapfile
fi
if ! swapon --show | grep -q /swapfile; then
  fallocate -l "${SWAP_GB}G" /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
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

# Node 22 (NodeSource; it runs the hub) and pnpm (corepack; the hub's production dependencies).
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
# The hub's code: a git checkout owned by the hub's user (tiletrigger-update moves it to the commit of the
# site build it installs). The site builds live apart, root-owned: $SITE_ROOT/releases/<sha>/site, with
# $SITE_ROOT/current pointing at the one served (the hub reads SITE_DIR=$SITE_ROOT/current/site).
id tiletrigger >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin tiletrigger
mkdir -p "$APP" && chown tiletrigger:tiletrigger "$APP"
mkdir -p "$SITE_ROOT" && chmod 755 "$SITE_ROOT"
# As the hub's user, in the checkout (the folder this runs from may not be readable for that user).
# shellcheck disable=SC2016 # expanded by that shell
as_app() { sudo -u tiletrigger -H env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 sh -c 'cd "$0" && exec "$@"' "$APP" "$@"; }
if [ -d "$APP/.git" ]; then
  as_app git -C "$APP" remote set-url origin "$REPO"
else
  as_app git clone -q "$REPO" "$APP"
fi

# The updater and its settings.
install -m 755 "$HERE/tiletrigger-update.sh" /usr/local/bin/tiletrigger-update
cat > /etc/tiletrigger-update.conf <<CONF
# Managed by infra/host-setup.sh (re-run the deploy script to change it).
APP=$APP
SITE_ROOT=$SITE_ROOT
REPO=$REPO
AUTO_CHANNEL=$CHANNEL
PROVENANCE=$PROVENANCE
HEALTH_URL=http://127.0.0.1:8080
KEEP=3
CONF

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

HUB_UNIT_BEFORE="$(cat /etc/systemd/system/tiletrigger-hub.service 2>/dev/null || true)"
cat > /etc/systemd/system/tiletrigger-hub.service <<UNIT
[Unit]
Description=Tile Trigger hub (site, signaling, game browser, TURN credentials)
After=network-online.target
Wants=network-online.target

[Service]
User=tiletrigger
Group=tiletrigger
WorkingDirectory=$APP/packages/server
Environment=PORT=8080 HOST=127.0.0.1 TRUST_PROXY=1 NODE_ENV=production SITE_DIR=$SITE_ROOT/current/site
EnvironmentFile=$ENV_FILE
# One process: Node with tsx's loader (no pnpm or tsx wrapper processes in between).
ExecStart=/usr/bin/node --import tsx src/hub.ts
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
HUB_UNIT_CHANGED=0
[ "$HUB_UNIT_BEFORE" = "$(cat /etc/systemd/system/tiletrigger-hub.service)" ] || HUB_UNIT_CHANGED=1

# Optional hourly auto-update (off unless AUTO_UPDATE=on): installs a new green main build, verified like
# any update (a build that was rolled back from is not retried). Low priority, so it never competes with
# the hub; a check with nothing new is one small HTTPS request.
cat > /etc/systemd/system/tiletrigger-update.service <<UNIT
[Unit]
Description=Tile Trigger: install a new verified site build if one was published
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/tiletrigger-update --auto
Nice=10
IOSchedulingClass=idle
CPUWeight=20
UNIT
cat > /etc/systemd/system/tiletrigger-update.timer <<UNIT
[Unit]
Description=Tile Trigger: hourly check for a new site build

[Timer]
OnCalendar=hourly
RandomizedDelaySec=15min
Persistent=true

[Install]
WantedBy=timers.target
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
case "$AUTO_UPDATE" in
  on) systemctl enable -q --now tiletrigger-update.timer; log "Auto-update: on (hourly, main-latest)" ;;
  off) systemctl disable -q --now tiletrigger-update.timer 2>/dev/null || true ;;
esac
systemctl reload-or-restart caddy

# The site build and the hub's code at its commit: downloaded, verified, switched (restarts the hub only
# if its code changed; health-checked, rolled back on failure). Later code updates: sudo tiletrigger-update.
log "Installing the site build (tiletrigger-update ${UPDATE_ARGS[*]})"
/usr/local/bin/tiletrigger-update "${UPDATE_ARGS[@]}"
# A changed hub unit (or a hub that isn't running) needs a restart of its own.
if [ "$HUB_UNIT_CHANGED" = 1 ] || ! systemctl is-active --quiet tiletrigger-hub; then
  log "Hub service changed: restarting it"
  systemctl restart tiletrigger-hub
fi
# The site the box used to build in its checkout: served from $SITE_ROOT now.
[ "$BUILD_HERE" = 1 ] || rm -rf "$APP/packages/client/dist"

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
log "Deployed $(as_app git -C "$APP" log -1 --format="%h %s")"
/usr/local/bin/tiletrigger-update --status | sed 's/^/   /'
