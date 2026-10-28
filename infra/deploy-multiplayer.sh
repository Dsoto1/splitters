#!/usr/bin/env bash
# Tile Trigger multiplayer control plane: deploy / update from AWS CloudShell.
#
#   git clone https://github.com/Dsoto1/splitters.git && cd splitters
#   infra/deploy-multiplayer.sh --email you@example.com --dns skip      # first run, new box beside the old one
#   infra/deploy-multiplayer.sh --dns replace                           # cut trigger.toshiroplay.com over to it
#   infra/deploy-multiplayer.sh                                         # later: update (same settings, latest green main build)
#   infra/deploy-multiplayer.sh --release v0.3.0                        # a release
#
# What one run does (idempotent; re-run any time):
#   1. checks prerequisites (aws, python3, curl, ssh/scp; credentials; stack state)
#   2. validates infra/toshiro-trigger-multiplayer.yaml (CloudFormation; cfn-lint if installed)
#   3. creates the SSM SecureStrings <prefix>/turn-secret and <prefix>/hub-signing-secret if missing
#      (random, 32 bytes; never printed; CloudFormation cannot create SecureStrings)
#   4. sets up the Lightsail email contact for alarms (verify it once from the email)
#   5. deploys/updates the stack (instance, static IP, firewall, DNS, alarms, budget)
#   6. bootstraps the instance over SSH with Lightsail's temporary SSH credentials:
#      SSH is opened to this shell's IP for the run only and closed again afterwards
#      (infra/host-setup.sh: Caddy, hub, coturn, restart policies, ufw, journald limits; then
#      infra/tiletrigger-update.sh installs the site build CI made and tested for the chosen commit,
#      downloaded from GitHub Releases and verified: SHA-256 + Sigstore build provenance. The box never
#      builds the site unless --build-here; docs/HOSTING.md, "Updates")
#   7. verifies the hub health endpoint (on the box and over the internet),
#      that /lobby/ice hands out relay credentials, and that TURN is NOT an open relay
#      (infra/turn-check.py, from here and on the box)
#   8. prints the endpoints
#
# Options (all optional except --email on the first run; unset options keep the stack's current values):
#   --email ADDR            budget + alarm email
#   --dns skip|manage|replace
#                           skip: this stack manages no DNS (use while the old box still serves the name)
#                           manage: the stack owns the A record(s); stops if a hand-made record exists
#                           replace: deletes hand-made A record(s) of the same name first, then manage
#                           (required on the first run; later runs keep the current setting)
#   --root                  also point the zone apex (toshiroplay.com) here (Caddy redirects it to the hub host)
#   --no-root               stop managing the apex record
#   --turn-record           also create turn.<hub host> -> static IP
#   --stack NAME            CloudFormation stack (toshiro-trigger-multiplayer)
#   --region REGION         (us-east-1)
#   --instance NAME         Lightsail instance name (toshiro-trigger-hub)
#   --az ZONE               availability zone (us-east-1a)
#   --bundle ID             micro_3_0 | small_3_0 (2 GB, default) | medium_3_0  (changing it replaces the box)
#   --zone DOMAIN           hosted zone (toshiroplay.com)
#   --hostname HOST         site + hub hostname (trigger.toshiroplay.com)
#   Which build (default: the latest green build of main, release main-latest):
#   --channel main|stable   main: latest green main build; stable: the newest release vX.Y.Z
#   --release vX.Y.Z        a release
#   --ref SHA               a commit CI published (main-latest or check-builds)
#   --branch NAME           testing: the head of a check/** branch, from its green CI build (check-builds);
#                           with --build-here, any branch
#   --build-here            build the site on the box instead (slow: ~5 min at full CPU on the 2 GB box;
#                           drains its CPU burst credits). Never done without this flag.
#   --auto-update on|off    hourly check for a new green main build on the box (default: off; later runs keep it)
#   --no-provenance         skip the Sigstore build-provenance check (emergencies; SHA-256 is still checked)
#   --repo URL              the repository (https://github.com/Dsoto1/splitters.git)
#   --app-client-id ID      Cognito app client ID for Trigger (pool us-east-1_VdMsuDJ59; default 2lrej6nsacfag8a7taeu3u6sc2, the public "trigger" SPA client)
#   --admin-ssh-cidr CIDR   keep SSH open to this CIDR permanently (default: Lightsail console only)
#   --budget-warn USD       first budget alert (15);  --budget-limit USD  budget (25)
#   --infra-only            stop after the stack (no SSH bootstrap, no checks)
#   --yes                   don't ask before deleting hand-made DNS records (--dns replace)
#   --owner SUB             the account that may publish maps from MapMaker (its Cognito user ID; MapMaker's
#                           Publish shows it to a signed-in account that isn't one yet). Kept in SSM
#                           (<prefix>/owner-subs, comma-separated); --owner '' removes everyone
#
# No secrets are stored in this repository: the TURN and hub secrets live in SSM
# Parameter Store (SecureString, default aws/ssm key) and reach the instance over
# SSH into root-only files. The instance itself holds no AWS credentials.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/toshiro-trigger-multiplayer.yaml"

STACK=toshiro-trigger-multiplayer
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ZONE=toshiroplay.com
HOSTNAME_=trigger.toshiroplay.com
SSM_PREFIX=/toshiro/trigger
PROJECT=toshiro-trigger
BRANCH=main
REF=''
CHANNEL=main
RELEASE=''
BUILD_HERE=0
AUTO_UPDATE=''
PROVENANCE=required
REPO=https://github.com/Dsoto1/splitters.git
ICE_TTL=3600
INFRA_ONLY=0
YES=0
OWNER_SET=0 OWNER_SUBS_NEW=''
# Explicitly set options (empty = keep the stack's value, or the template default on create).
EMAIL='' DNS_MODE='' ROOT='' TURN_RECORD='' INSTANCE='' AZ='' BUNDLE='' APP_CLIENT='2lrej6nsacfag8a7taeu3u6sc2' ADMIN_SSH='' BUDGET_WARN='' BUDGET_LIMIT=''

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '\n== %s\n' "$*"; }
note() { printf '   %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:?}"; shift ;;
    --owner) OWNER_SET=1; OWNER_SUBS_NEW="${2-}"; shift ;;
    --dns) DNS_MODE="${2:?}"; shift ;;
    --root) ROOT=true ;;
    --no-root) ROOT=false ;;
    --turn-record) TURN_RECORD=true ;;
    --stack) STACK="${2:?}"; shift ;;
    --region) REGION="${2:?}"; shift ;;
    --instance) INSTANCE="${2:?}"; shift ;;
    --az) AZ="${2:?}"; shift ;;
    --bundle) BUNDLE="${2:?}"; shift ;;
    --zone) ZONE="${2:?}"; shift ;;
    --hostname) HOSTNAME_="${2:?}"; shift ;;
    --branch) BRANCH="${2:?}"; shift ;;
    --ref) REF="${2:?}"; shift ;;
    --repo) REPO="${2:?}"; shift ;;
    --channel) CHANNEL="${2:?}"; shift ;;
    --release) RELEASE="${2:?}"; shift ;;
    --build-here) BUILD_HERE=1 ;;
    --auto-update) AUTO_UPDATE="${2:?}"; shift ;;
    --no-provenance) PROVENANCE=off ;;
    --app-client-id) APP_CLIENT="${2:?}"; shift ;;
    --admin-ssh-cidr) ADMIN_SSH="${2:?}"; shift ;;
    --budget-warn) BUDGET_WARN="${2:?}"; shift ;;
    --budget-limit) BUDGET_LIMIT="${2:?}"; shift ;;
    --infra-only) INFRA_ONLY=1 ;;
    --yes) YES=1 ;;
    -h|--help) sed -n '2,64p' "$0"; exit 0 ;;
    *) die "unknown option $1 (see --help)" ;;
  esac
  shift
done
case "$DNS_MODE" in ''|skip|manage|replace) ;; *) die "--dns must be skip, manage or replace" ;; esac
case "$CHANNEL" in main|stable) ;; *) die "--channel must be main or stable" ;; esac
case "$AUTO_UPDATE" in ''|on|off) ;; *) die "--auto-update must be on or off" ;; esac
[ -z "$RELEASE" ] || [[ "$RELEASE" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]] || die "--release takes a version tag (vX.Y.Z)"
[ -z "$REF" ] || [[ "$REF" =~ ^[0-9a-f]{40}$ ]] || die "--ref takes a full commit SHA (40 hex characters)"

export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION" AWS_PAGER=''
WORK="$(mktemp -d)"
chmod 700 "$WORK"
SSH_OPENED=0
PREV_ADMIN_SSH=''

cleanup() {
  local rc=$?
  if [ "$SSH_OPENED" = 1 ] && stack_exists; then
    printf '\n== Closing SSH to this shell again (AdminSshCidr=%s)\n' "${PREV_ADMIN_SSH:-<console only>}"
    aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" \
      --parameter-overrides "AdminSshCidr=$PREV_ADMIN_SSH" --no-fail-on-empty-changeset >/dev/null \
      || printf 'WARNING: could not close SSH; re-run, or set AdminSshCidr back in the console\n' >&2
  fi
  rm -rf "$WORK"
  exit "$rc"
}
trap cleanup EXIT

# ------------------------------------------------------------------ 1. prerequisites
log "Checking prerequisites"
for cmd in aws python3 curl; do command -v "$cmd" >/dev/null || die "$cmd is not installed"; done
if [ "$INFRA_ONLY" = 0 ]; then for cmd in ssh scp; do command -v "$cmd" >/dev/null || die "$cmd is not installed"; done; fi
[ -f "$TEMPLATE" ] || die "template not found: $TEMPLATE"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)" || die "no AWS credentials (run this in CloudShell)"
note "account $ACCOUNT, region $REGION, stack $STACK"

# The site build to install: check it is published before touching anything (the box checks it again,
# with its SHA-256 sums and build provenance).
SLUG="$(sed -E 's#^(https://|git@)github\.com[:/]##; s#\.git$##' <<<"$REPO")"
RELEASES_URL="https://github.com/$SLUG/releases"
published() { curl -fsSL -r 0-0 -o /dev/null --max-time 20 "$1"; } # a 1-byte GET (signed redirects may refuse HEAD)
if [ "$INFRA_ONLY" = 0 ]; then
  if [ "$BUILD_HERE" = 1 ]; then
    note "site: built on the box from ${REF:-branch $BRANCH} (--build-here: slow, uses the CPU burst credits)"
  elif [ -n "$RELEASE" ]; then
    published "$RELEASES_URL/download/$RELEASE/build.json" || die "release $RELEASE has no site build ($RELEASES_URL/tag/$RELEASE)"
    note "site: release $RELEASE"
  elif [ -n "$REF" ]; then
    published "$RELEASES_URL/download/main-latest/tiletrigger-client-$REF.tar.gz" || published "$RELEASES_URL/download/check-builds/tiletrigger-client-$REF.tar.gz" \
      || die "no CI build of $REF is published (main-latest keeps the last 20 main commits; check-builds the last 8 check/** ones). Pick a published one, or add --build-here"
    note "site: CI build of $REF"
  elif [ "$BRANCH" != main ]; then
    command -v git >/dev/null || die "git is not installed"
    head="$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)"
    [ -n "$head" ] || die "no branch $BRANCH in $REPO"
    published "$RELEASES_URL/download/check-builds/tiletrigger-client-$head.tar.gz" \
      || die "no CI build of $BRANCH's head ($head). Push it to a check/** branch and wait for green CI (CI publishes check/** builds to the check-builds release), or add --build-here"
    note "site: CI build of $BRANCH @ ${head:0:12}"
  else
    rel=main-latest; [ "$CHANNEL" = stable ] && rel=latest
    url="$RELEASES_URL/download/$rel/build.json"; [ "$rel" = latest ] && url="$RELEASES_URL/latest/download/build.json"
    info="$(curl -fsSL --max-time 20 "$url" 2>/dev/null)" || die "no site build published on $CHANNEL yet ($url). CI publishes one after a green run on main (or a v* tag); or add --build-here"
    note "site: $CHANNEL, $(python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(d["sha"][:12], "version", d.get("version","?"), "committed", d.get("commitTime","?"))' "$info")"
  fi
fi

stack_exists() { aws cloudformation describe-stacks --stack-name "$STACK" >/dev/null 2>&1; }
stack_param() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Parameters[?ParameterKey=='$1'].ParameterValue" --output text 2>/dev/null | sed 's/^None$//'; }
stack_output() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text | sed 's/^None$//'; }
stack_owns() { aws cloudformation describe-stack-resources --stack-name "$STACK" --logical-resource-id "$1" >/dev/null 2>&1; }

EXISTS=0
if stack_exists; then
  EXISTS=1
  STATUS="$(aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text)"
  case "$STATUS" in *_IN_PROGRESS) die "stack is busy ($STATUS); wait and re-run" ;; ROLLBACK_COMPLETE) die "stack is in ROLLBACK_COMPLETE (a failed create): delete it (aws cloudformation delete-stack --stack-name $STACK) and re-run" ;; esac
  note "stack exists ($STATUS): updating"
  [ -n "$EMAIL" ] || EMAIL="$(stack_param AlertEmail)"
  PREV_ADMIN_SSH="$(stack_param AdminSshCidr)"
else
  note "stack does not exist yet: creating"
  [ -n "$EMAIL" ] || die "--email is required on the first run (budget and alarm alerts)"
  [ -n "$DNS_MODE" ] || die "--dns is required on the first run: skip (new box beside the live one), manage, or replace (see docs/HOSTING.md)"
fi
[ -n "$ADMIN_SSH" ] && PREV_ADMIN_SSH="$ADMIN_SSH"
# Later runs without --dns keep what the stack does now.
if [ -z "$DNS_MODE" ]; then
  if [ -n "$(stack_param HostedZoneId)" ]; then DNS_MODE=manage; else DNS_MODE=skip; fi
  note "DNS: keeping current setting ($DNS_MODE)"
fi
if [ "$DNS_MODE" = skip ] && { [ "$ROOT" = true ] || [ "$TURN_RECORD" = true ]; }; then die "--root/--turn-record need --dns manage or replace"; fi

# ------------------------------------------------------------------ 2. template
log "Validating the template"
aws cloudformation validate-template --template-body "file://$TEMPLATE" >/dev/null
note "CloudFormation: valid"
if command -v cfn-lint >/dev/null; then cfn-lint --regions "$REGION" -- "$TEMPLATE" && note "cfn-lint: clean"; else note "cfn-lint not installed (optional: pip3 install --user cfn-lint)"; fi

# ------------------------------------------------------------------ DNS lookups
ZONE_ID=''
if [ "$DNS_MODE" != skip ]; then
  read -r ZONE_ID ZONE_NAME ZONE_PRIVATE < <(aws route53 list-hosted-zones-by-name --dns-name "$ZONE" --max-items 1 \
    --query 'HostedZones[0].[Id,Name,Config.PrivateZone]' --output text)
  [ "$ZONE_NAME" = "$ZONE." ] && [ "$ZONE_PRIVATE" = False ] || die "no public hosted zone $ZONE in this account"
  ZONE_ID="${ZONE_ID##*/}"
  note "hosted zone $ZONE = $ZONE_ID"
fi

# Prints the A record set named $1 as JSON, or nothing.
record_json() {
  aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" --start-record-name "$1" --start-record-type A --max-items 1 --output json \
    | python3 -c 'import json,sys; n=sys.argv[1].rstrip(".")+"."; r=json.load(sys.stdin)["ResourceRecordSets"]; r=[x for x in r if x["Name"]==n and x["Type"]=="A"]; print(json.dumps(r[0]) if r else "")' "$1"
}
record_values() { python3 -c 'import json,sys; r=json.loads(sys.argv[1]); print(" ".join(v["Value"] for v in r.get("ResourceRecords",[])) or ("alias " + r.get("AliasTarget",{}).get("DNSName","")))' "$1"; }

# A record that exists but this stack doesn't own: stop (manage) or delete it (replace).
# Phase "check" runs before anything changes (and asks before a replace); phase "apply"
# deletes, right before the stack deploy creates the stack's own record.
TO_DELETE=()
claim_record() { # phase name logicalId
  local phase="$1" name="$2" logical="$3" rec
  if [ "$phase" = apply ]; then
    rec="$(record_json "$name")"
    [ -n "$rec" ] || return 0
    python3 -c 'import json,sys; print(json.dumps({"Comment":"handed over to CloudFormation","Changes":[{"Action":"DELETE","ResourceRecordSet":json.loads(sys.argv[1])}]}))' "$rec" > "$WORK/delete.json"
    aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch "file://$WORK/delete.json" >/dev/null
    note "$name: old record deleted (the stack creates its own now)"
    return 0
  fi
  if [ "$EXISTS" = 1 ] && stack_owns "$logical"; then note "$name: managed by this stack"; return 0; fi
  rec="$(record_json "$name")"
  [ -n "$rec" ] || { note "$name: no record yet (the stack creates it)"; return 0; }
  if [ "$DNS_MODE" != replace ]; then
    die "$name already has an A record made outside this stack ($(record_values "$rec")). CloudFormation can't adopt it: re-run with --dns replace (deletes it just before the stack creates its own; a minute of DNS change) or --dns skip"
  fi
  if [ "$YES" != 1 ]; then
    printf 'Replace the existing A record %s -> %s with one managed by the stack? [y/N] ' "$name" "$(record_values "$rec")"
    read -r answer; [ "$answer" = y ] || [ "$answer" = Y ] || die "stopped; nothing changed"
  fi
  note "$name: currently $(record_values "$rec"); will be replaced"
  TO_DELETE+=("$name")
}
if [ "$DNS_MODE" != skip ]; then
  claim_record check "$HOSTNAME_" HubRecord
  [ "$ROOT" = true ] && claim_record check "$ZONE" RootRecord
  [ "$TURN_RECORD" = true ] && claim_record check "turn.$HOSTNAME_" TurnRecord
fi

# ------------------------------------------------------------------ 3. secrets (SSM SecureString)
log "Secrets in SSM Parameter Store ($SSM_PREFIX)"
ensure_secret() { # name
  local name="$SSM_PREFIX/$1"
  if aws ssm get-parameter --name "$name" --query Parameter.Name --output text >/dev/null 2>&1; then
    note "$name: exists (kept)"
  else
    python3 -c 'import json,secrets,sys; print(json.dumps({"Name":sys.argv[1],"Type":"SecureString","Tier":"Standard","Value":secrets.token_hex(32),"Description":sys.argv[2],"Tags":[{"Key":"Project","Value":sys.argv[3]}]}))' \
      "$name" "Tile Trigger $1 (created by infra/deploy-multiplayer.sh)" "$PROJECT" > "$WORK/param.json"
    aws ssm put-parameter --cli-input-json "file://$WORK/param.json" >/dev/null
    rm -f "$WORK/param.json"
    note "$name: created (random 32 bytes)"
  fi
}
ensure_secret turn-secret
ensure_secret hub-signing-secret
aws ssm get-parameter --name "$SSM_PREFIX/turn-secret" --with-decryption --query Parameter.Value --output text > "$WORK/turn-secret"
aws ssm get-parameter --name "$SSM_PREFIX/hub-signing-secret" --with-decryption --query Parameter.Value --output text > "$WORK/hub-signing-secret"
# Owner accounts (map publishing): not a secret, a plain String parameter.
if [ "$OWNER_SET" = 1 ]; then
  [[ "$OWNER_SUBS_NEW" =~ ^[A-Za-z0-9,_-]*$ ]] || die "--owner: Cognito user IDs only (letters, digits, - and _, comma-separated)"
  aws ssm put-parameter --name "$SSM_PREFIX/owner-subs" --type String --overwrite --value "${OWNER_SUBS_NEW:- }" >/dev/null
  note "owner accounts for map publishing: ${OWNER_SUBS_NEW:-none}"
fi
OWNER_SUBS="$(aws ssm get-parameter --name "$SSM_PREFIX/owner-subs" --query Parameter.Value --output text 2>/dev/null | tr -d ' ' || true)"
chmod 600 "$WORK"/*-secret

# ------------------------------------------------------------------ 4. alarm contact
log "Lightsail alarm contact"
CONTACT="$(aws lightsail get-contact-methods --protocols Email --query 'contactMethods[0].[contactEndpoint,status]' --output text 2>/dev/null || true)"
if [ -z "$CONTACT" ] || [ "$CONTACT" = None ]; then
  aws lightsail create-contact-method --protocol Email --contact-endpoint "$EMAIL" >/dev/null
  note "created for $EMAIL: open the verification email Lightsail sends, or alarms stay silent"
else
  note "existing: $CONTACT"
fi

# ------------------------------------------------------------------ 5. stack
OVERRIDES=()
add() { OVERRIDES+=("$1=$2"); }
[ -n "$EMAIL" ] && add AlertEmail "$EMAIL"
[ -n "$INSTANCE" ] && add InstanceName "$INSTANCE"
[ -n "$AZ" ] && add AvailabilityZone "$AZ"
[ -n "$BUNDLE" ] && add BundleId "$BUNDLE"
[ -n "$APP_CLIENT" ] && add CognitoAppClientId "$APP_CLIENT"
[ -n "$BUDGET_WARN" ] && add BudgetWarnUsd "$BUDGET_WARN"
[ -n "$BUDGET_LIMIT" ] && add BudgetLimitUsd "$BUDGET_LIMIT"
add ZoneName "$ZONE"
add HubHostname "$HOSTNAME_"
add SsmPrefix "$SSM_PREFIX"
add ProjectTag "$PROJECT"
case "$DNS_MODE" in
  skip) add HostedZoneId ''; add ManageHubRecord false; add ManageRootRecord false; add ManageTurnRecord false ;;
  manage|replace)
    add HostedZoneId "$ZONE_ID"; add ManageHubRecord true
    [ -n "$ROOT" ] && add ManageRootRecord "$ROOT"
    [ -n "$TURN_RECORD" ] && add ManageTurnRecord "$TURN_RECORD"
    [ "$TURN_RECORD" = true ] && add TurnHostname "turn.$HOSTNAME_"
    ;;
esac

MY_IP=''
if [ "$INFRA_ONLY" = 0 ]; then
  MY_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')"
  [[ "$MY_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "could not find this shell's public IP"
  if [ -z "$ADMIN_SSH" ]; then add AdminSshCidr "$MY_IP/32"; SSH_OPENED=1; else add AdminSshCidr "$ADMIN_SSH"; fi
fi

for name in "${TO_DELETE[@]}"; do claim_record apply "$name" -; done
log "Deploying stack $STACK (a few minutes on create)"
aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" \
  --parameter-overrides "${OVERRIDES[@]}" \
  --tags "Project=$PROJECT" Environment=prod ManagedBy=cloudformation \
  --no-fail-on-empty-changeset

STATIC_IP="$(stack_output StaticIp)"
INSTANCE_NAME="$(stack_output InstanceName)"
HUB_HOST="$(stack_output HubHostname)"
TURN_HOST="$(stack_output TurnHostname)"
DNS_MANAGED="$(stack_output DnsManaged)"
ROOT_DOMAIN=''
[ "$(stack_param ManageRootRecord)" = true ] && [ -n "$(stack_param HostedZoneId)" ] && ROOT_DOMAIN="$(stack_param ZoneName)"
note "instance $INSTANCE_NAME, static IP $STATIC_IP, DNS: $DNS_MANAGED"

if [ "$INFRA_ONLY" = 1 ]; then
  log "Infrastructure only: done (bootstrap with a run without --infra-only)"
  exit 0
fi

# ------------------------------------------------------------------ 6. bootstrap over SSH
log "Waiting for the instance"
for _ in $(seq 1 60); do
  [ "$(aws lightsail get-instance-state --instance-name "$INSTANCE_NAME" --query state.name --output text)" = running ] && break
  sleep 5
done
aws lightsail get-instance-access-details --instance-name "$INSTANCE_NAME" --protocol ssh --output json > "$WORK/access.json"
python3 - "$WORK" "$STATIC_IP" <<'PY'
import json, os, sys
work, ip = sys.argv[1], sys.argv[2]
d = json.load(open(os.path.join(work, 'access.json')))['accessDetails']
def write(name, text, mode=0o600):
    p = os.path.join(work, name)
    with open(p, 'w') as f: f.write(text if text.endswith('\n') else text + '\n')
    os.chmod(p, mode)
write('key', d['privateKey'])
write('key-cert.pub', d['certKey'])
write('user', d.get('username') or 'ubuntu')
hosts = [f"{ip} {k['algorithm']} {k['publicKey']}" for k in d.get('hostKeys') or [] if k.get('publicKey')]
write('known_hosts', '\n'.join(hosts))
PY
rm -f "$WORK/access.json"
SSH_USER="$(cat "$WORK/user")"
HOSTKEY_OPT=(-o StrictHostKeyChecking=yes)
[ -s "$WORK/known_hosts" ] && [ "$(wc -w < "$WORK/known_hosts")" -gt 0 ] || { HOSTKEY_OPT=(-o StrictHostKeyChecking=accept-new); note "Lightsail returned no host keys yet: trusting the first one seen"; }
SSH_OPTS=(-i "$WORK/key" -o "CertificateFile=$WORK/key-cert.pub" -o "UserKnownHostsFile=$WORK/known_hosts" "${HOSTKEY_OPT[@]}" -o ConnectTimeout=10 -o BatchMode=yes -o LogLevel=ERROR)
# shellcheck disable=SC2029  # the remote command is built here on purpose (paths only, no secrets)
rssh() { ssh "${SSH_OPTS[@]}" "$SSH_USER@$STATIC_IP" "$@"; }

log "Connecting over SSH (open to $MY_IP for this run only)"
for i in $(seq 1 30); do rssh true 2>/dev/null && break; [ "$i" = 30 ] && die "SSH to $STATIC_IP failed"; sleep 10; done

# Settings + secrets for host-setup.sh: a root-only file, removed after use.
{
  printf '%s=%q\n' DOMAIN "$HUB_HOST" ROOT_DOMAIN "$ROOT_DOMAIN" TURN_HOST "$TURN_HOST" STATIC_IP "$STATIC_IP" \
    REPO "$REPO" BRANCH "$BRANCH" REF "$REF" CHANNEL "$CHANNEL" RELEASE "$RELEASE" BUILD_HERE "$BUILD_HERE" \
    AUTO_UPDATE "$AUTO_UPDATE" PROVENANCE "$PROVENANCE" ICE_TTL "$ICE_TTL" \
    TURN_SECRET "$(cat "$WORK/turn-secret")" HUB_SIGNING_SECRET "$(cat "$WORK/hub-signing-secret")" \
    COGNITO_REGION "$(stack_param CognitoRegion)" COGNITO_USER_POOL_ID "$(stack_param CognitoUserPoolId)" \
    COGNITO_APP_CLIENT_ID "$(stack_param CognitoAppClientId)" COGNITO_DOMAIN "$(stack_param CognitoDomain)" HOST_FIREWALL 1 \
    OWNER_SUBS "$OWNER_SUBS"
} > "$WORK/bootstrap.env"
chmod 600 "$WORK/bootstrap.env"

REMOTE="$(rssh 'umask 077; mktemp -d')"
scp -q "${SSH_OPTS[@]}" "$HERE/host-setup.sh" "$HERE/tiletrigger-update.sh" "$HERE/turn-check.py" "$WORK/bootstrap.env" "$WORK/turn-secret" "$SSH_USER@$STATIC_IP:$REMOTE/"
rm -f "$WORK/bootstrap.env"

log "Bootstrapping the instance (packages, Caddy, hub, coturn, the site build; a few minutes the first time, under a minute later)"
rssh "sudo bash $REMOTE/host-setup.sh $REMOTE/bootstrap.env; rc=\$?; if [ -f /etc/tiletrigger-relay-off ]; then echo '== Relay switched off (tiletrigger-relay off): TURN check skipped'; elif [ \$rc = 0 ]; then echo; echo '== TURN check on the box (config)'; sudo python3 $REMOTE/turn-check.py --host 127.0.0.1 --secret-file $REMOTE/turn-secret || rc=\$?; fi; sudo rm -rf $REMOTE; exit \$rc" \
  || die "bootstrap or on-box TURN check failed (see above); SSH: Lightsail console → Connect, then sudo journalctl -u tiletrigger-hub -n 80"

# ------------------------------------------------------------------ 7. checks from outside
log "Checking from the internet"
FAIL=0
RESOLVED="$(python3 -c 'import socket,sys; print(socket.gethostbyname(sys.argv[1]))' "$HUB_HOST" 2>/dev/null || true)"
if [ "$RESOLVED" = "$STATIC_IP" ]; then
  ok=no
  for _ in $(seq 1 24); do  # Caddy may still be fetching the certificate
    curl -fsS --max-time 10 "https://$HUB_HOST/lobby/health" >/dev/null 2>&1 && { ok=yes; break; }; sleep 5
  done
  if [ "$ok" = yes ]; then note "https://$HUB_HOST/lobby/health: $(curl -fsS "https://$HUB_HOST/lobby/health")"; else note "FAIL https://$HUB_HOST/lobby/health (certificate or hub)"; FAIL=1; fi
  # The hub hands TURN credentials only to a live game (/lobby/ice?session=<CODE>, lobby.ts): check that the
  # relay is configured (health) and that a request without a live game gets none.
  if curl -fsS --max-time 10 "https://$HUB_HOST/lobby/health" | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("relay") else 1)'; then
    note "hub relay configured (TURN credentials go to live games only)"
  else note "FAIL the hub has no relay configured (TURN_SECRET/TURN_URLS)"; FAIL=1; fi
  if curl -fsS --max-time 10 "https://$HUB_HOST/lobby/ice" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if not d.get("relay") and not any(s.get("username") for s in d.get("iceServers",[])) else 1)'; then
    note "/lobby/ice without a live game hands out no TURN credentials"
  else note "FAIL /lobby/ice gave TURN credentials without a live game"; FAIL=1; fi
  headers="$(curl -fsSI --max-time 10 "https://$HUB_HOST/")"
  if grep -qi '^strict-transport-security' <<<"$headers"; then note "security headers present"; else note "FAIL no HSTS header"; FAIL=1; fi
else
  note "$HUB_HOST resolves to ${RESOLVED:-nothing}, not $STATIC_IP (DNS not cut over: --dns skip, or still propagating)"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $HUB_HOST" "http://$STATIC_IP/" || true)"
  note "Caddy on http://$STATIC_IP answers $code for $HUB_HOST (308 = redirect to HTTPS: up)"
fi

rc=0
python3 "$HERE/turn-check.py" --host "$STATIC_IP" --secret-file "$WORK/turn-secret" || rc=$?
case "$rc" in
  0) note "TURN is not an open relay (checked from here)" ;;
  2) note "TURN not reachable over UDP from this shell (inconclusive here; the on-box check above passed)" ;;
  *) note "FAIL TURN check from outside"; FAIL=1 ;;
esac
nc_ok="$(python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(3); print("open" if s.connect_ex((sys.argv[1],8080))==0 else "closed")' "$STATIC_IP")"
if [ "$nc_ok" = closed ]; then note "hub port 8080 not reachable from outside (Caddy only)"; else note "FAIL port 8080 is reachable from outside"; FAIL=1; fi

# ------------------------------------------------------------------ 8. summary
log "Endpoints"
cat <<DONE
   Site            https://$HUB_HOST
   Health          https://$HUB_HOST/lobby/health
   Game browser    https://$HUB_HOST/lobby/games
   Signaling       wss://$HUB_HOST/broker
   TURN            turn:$TURN_HOST:3478 (udp, tcp)  credentials: GET /lobby/ice, ${ICE_TTL}s
   Static IP       $STATIC_IP   (instance $INSTANCE_NAME, region $REGION)
   DNS             $DNS_MANAGED
   Secrets         SSM $SSM_PREFIX/turn-secret, $SSM_PREFIX/hub-signing-secret (SecureString)
   Budget          $(stack_output BudgetName), alerts to $EMAIL
   Code updates    Lightsail console → Connect → sudo tiletrigger-update (latest green main build;
                   --release vX.Y.Z, --rollback, --status), or re-run this script
DONE
[ "$FAIL" = 0 ] || die "some checks failed (above)"
log "All checks passed"
