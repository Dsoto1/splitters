#!/usr/bin/env bash
# Tile Trigger on one AWS Lightsail instance (Ubuntu 24.04): the site, the hub
# (broker + game browser), its own relay (coturn) and HTTPS (Caddy).
# Matches run in players' browsers, so a $5 instance is plenty.
#
# For trigger.toshiroplay.com this is superseded by the CloudFormation flow in
# infra/ (infra/deploy-multiplayer.sh from AWS CloudShell; docs/HOSTING.md),
# which adds SSM-held secrets, 1 h relay credentials, relay caps, alarms and a
# budget. This script still works for a hand-made instance or another domain.
#
# In the Lightsail console: create an Ubuntu 24.04 instance, attach a static IP,
# point your domain's A record at it, open the firewall ports listed at the end,
# then in the browser SSH window:
#   curl -fsSL https://raw.githubusercontent.com/Dsoto1/splitters/main/deploy/aws-lightsail-setup.sh | sudo bash -s -- trigger.toshiroplay.com
# (Another branch: put its name in the URL instead of main, and run `sudo BRANCH=<name> bash -s -- …`.)
# Re-running it is safe (it updates). Later updates: sudo tiletrigger-update
set -euo pipefail

DOMAIN="${1:-}"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/Dsoto1/splitters.git}"
APP=/opt/tiletrigger
ENV_FILE=/etc/tiletrigger.env

[ "$(id -u)" = 0 ] || { echo "run with sudo"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
# Corepack fetches pnpm on first use: don't stop to ask.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
echo "== Tile Trigger setup ${DOMAIN:+for $DOMAIN} (branch $BRANCH)"

# Building the game needs more memory than the smallest instances have: add swap once.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https coturn >/dev/null

# Node 22 (NodeSource) and pnpm (corepack).
if ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
corepack enable

# Caddy: HTTPS certificates are fetched and renewed automatically.
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

# The game.
id tiletrigger >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin tiletrigger
mkdir -p "$APP" && chown tiletrigger:tiletrigger "$APP"
# Everything in the app folder is done as its own user (git refuses folders owned by someone else).
as_app() { sudo -u tiletrigger -H env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 bash -c "cd $APP && $1"; }
if [ -d "$APP/.git" ]; then
  as_app "git fetch -q origin '$BRANCH' && git checkout -q -B '$BRANCH' 'origin/$BRANCH'"
else
  as_app "git clone -q --branch '$BRANCH' '$REPO' ."
fi
echo "== Building the game (a few minutes)…"
as_app "corepack pnpm install --frozen-lockfile && VITE_HUB=self corepack pnpm build"

# The relay (coturn), with time-limited passwords the hub hands out.
PUBLIC_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')"
PRIVATE_IP="$(hostname -I | awk '{print $1}')"
TURN_HOST="${DOMAIN:-$PUBLIC_IP}"
if [ ! -f "$ENV_FILE" ]; then
  SECRET="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<ENV
TURN_SECRET=$SECRET
TURN_URLS=turn:$TURN_HOST:3478 turn:$TURN_HOST:3478?transport=tcp
ENV
  chmod 640 "$ENV_FILE" && chgrp tiletrigger "$ENV_FILE"
fi
SECRET="$(grep '^TURN_SECRET=' "$ENV_FILE" | cut -d= -f2)"
cat > /etc/turnserver.conf <<TURN
listening-port=3478
external-ip=$PUBLIC_IP/$PRIVATE_IP
min-port=49160
max-port=49200
use-auth-secret
static-auth-secret=$SECRET
realm=${DOMAIN:-tiletrigger}
fingerprint
no-cli
no-multicast-peers
no-tlsv1
no-tlsv1_1
# Relay only to the internet, never into this machine or private networks.
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
total-quota=200
TURN
sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true
systemctl enable -q coturn && systemctl restart coturn

# The hub (site + broker + game browser), restarted if it ever stops.
cat > /etc/systemd/system/tiletrigger-hub.service <<UNIT
[Unit]
Description=Tile Trigger hub (site, broker, game browser)
After=network-online.target
Wants=network-online.target

[Service]
User=tiletrigger
WorkingDirectory=$APP
Environment=PORT=8080 HOST=127.0.0.1 TRUST_PROXY=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/corepack pnpm --filter @tiletrigger/server hub
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable -q tiletrigger-hub && systemctl restart tiletrigger-hub

# HTTPS in front (or plain HTTP on the IP until a domain is given).
if [ -n "$DOMAIN" ]; then
  printf '%s {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:8080\n}\n' "$DOMAIN" > /etc/caddy/Caddyfile
else
  printf ':80 {\n\treverse_proxy 127.0.0.1:8080\n}\n' > /etc/caddy/Caddyfile
fi
systemctl enable -q caddy && systemctl reload-or-restart caddy

# One-line updates later.
cat > /usr/local/bin/tiletrigger-update <<UPD
#!/usr/bin/env bash
set -euo pipefail
sudo -u tiletrigger -H env COREPACK_ENABLE_DOWNLOAD_PROMPT=0 bash -c "cd $APP && git fetch -q origin $BRANCH && git reset -q --hard origin/$BRANCH && corepack pnpm install --frozen-lockfile && VITE_HUB=self corepack pnpm build"
systemctl restart tiletrigger-hub
echo "Tile Trigger updated to \$(sudo -u tiletrigger git -C $APP log -1 --format='%h %s')"
UPD
chmod +x /usr/local/bin/tiletrigger-update

up=no
for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:8080/lobby/health >/dev/null 2>&1 && { up=yes; break; }; sleep 1; done
if [ "$up" = yes ]; then echo "== Hub is running."; else echo "== Hub didn't answer yet: sudo journalctl -u tiletrigger-hub -n 50"; fi
cat <<DONE

Tile Trigger is set up. Open: ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://$PUBLIC_IP}

In the Lightsail console → your instance → Networking → IPv4 firewall, make sure these are open:
  TCP 80, TCP 443          (the site; HTTPS certificate)
  TCP 3478, UDP 3478       (relay)
  UDP 49160-49200          (relay traffic)

Updates: sudo tiletrigger-update    Logs: sudo journalctl -u tiletrigger-hub -f
DONE
