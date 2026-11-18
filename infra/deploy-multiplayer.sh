#!/usr/bin/env bash
# Tile Trigger multiplayer control plane: deploy / update from AWS CloudShell.
#
#   git clone https://github.com/Dsoto1/splitters.git && cd splitters
#   infra/deploy-multiplayer.sh --email you@example.com --dns skip      # first run, new box beside the old one
#   infra/deploy-multiplayer.sh --dns replace                           # cut trigger.toshiroplay.com over to it
#   infra/deploy-multiplayer.sh                                         # later: update (same settings, latest green main build)
#   infra/deploy-multiplayer.sh --release v0.3.0                        # a release
#   infra/deploy-multiplayer.sh --cdn on                                # CloudFront in front of the site (once)
#   infra/deploy-multiplayer.sh --resume                                # after the cost guard stopped the box
#
# What one run does (idempotent; re-run any time):
#   1. checks prerequisites (aws, python3, curl, ssh/scp; credentials; stack state)
#   2. validates infra/toshiro-trigger-multiplayer.yaml (CloudFormation; cfn-lint if installed)
#   3. creates the SSM SecureStrings <prefix>/turn-secret and <prefix>/hub-signing-secret if missing
#      (random, 32 bytes; never printed; CloudFormation cannot create SecureStrings), and <prefix>/edge-key
#      (a String: the header value that marks requests from CloudFront)
#   4. sets up the Lightsail email contact for alarms (verify it once from the email)
#   5. deploys/updates the stack (instance, static IP, firewall, DNS, alarms, budget, the cost guard that
#      stops the box at the spend cap, CloudFront, the backup bucket); then the backup key: an access key for
#      the stack's put-only backup user, kept in SSM (SecureString <prefix>/backup-key), made once
#   5b. a fresh box (empty /var/lib/tiletrigger) gets the latest backup, copied over SSH, before the hub starts
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
#   Sign-in: the shared ToshiroPlay Cognito pool and Trigger's app client are looked up every run (nothing hardcoded):
#   --cognito-domain HOST   the pool's managed login domain (login.toshiroplay.com): finds the pool
#   --cognito-region REGION the pool's region (us-east-1)
#   --app-client-name NAME  Trigger's app client in that pool, by name (trigger)
#   --app-client-id ID      that app client by ID instead of by name
#   --admin-ssh-cidr CIDR   keep SSH open to this CIDR permanently (default: Lightsail console only)
#   --budget-warn USD       first budget alert (15);  --budget-limit USD  budget (25)
#   --budget-scope S        project (default): count only costs tagged with the project (activate the tag as a cost
#                           allocation tag in Billing first); account: the whole AWS account
#   --budget-tag KEY        the tag the project budget filters on: Project (default, =toshiro-trigger) or AppName (=TileTrigger); both are set
#   --stop-at USD           hard cap: the WHOLE ACCOUNT's actual spend this month that stops the box and the CDN (30; 0 = off)
#   --resume                start the box and re-enable the CDN after the cost guard stopped them, then check; nothing else
#   --cdn off|prepare|on    CloudFront in front of the site (docs/HOSTING.md, "CDN"; needs us-east-1 and --dns manage).
#                           on from off: the run deploys "prepare" first (the CDN beside the live name), checks the box
#                           and the CDN, then points the name at CloudFront. Later runs keep the current setting
#   --restore latest|KEY    put a backup (the newest, or backups/tiletrigger-<time>.tar.gz) over the box's state (the hub
#                           is stopped, the old state moved aside on the box). Without it, only an empty box is restored
#   --no-restore            don't restore even an empty box
#   --infra-only            stop after the stack (no SSH bootstrap, no checks)
#   --yes                   don't ask before deleting hand-made DNS records (--dns replace)
#   --owner SUB             the account that may publish maps from MapMaker (its Cognito user ID; MapMaker's
#                           Publish shows it to a signed-in account that isn't one yet). Kept in SSM
#                           (<prefix>/owner-subs, comma-separated); --owner '' removes everyone
#
# No secrets are stored in this repository: the TURN and hub secrets and the backup key live in SSM
# Parameter Store (SecureString, default aws/ssm key) and reach the instance over SSH into root-only
# files. The instance's only AWS credential is the backup key: put-only, one bucket prefix.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/toshiro-trigger-multiplayer.yaml"

STACK=toshiro-trigger-multiplayer
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ZONE=toshiroplay.com
HOSTNAME_=trigger.toshiroplay.com
SSM_PREFIX=/toshiro/trigger
PROJECT=toshiro-trigger
# The AppName tag: the owner's tag across all their apps.
APP_NAME=TileTrigger
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
EMAIL='' DNS_MODE='' ROOT='' TURN_RECORD='' INSTANCE='' AZ='' BUNDLE='' APP_CLIENT='' ADMIN_SSH='' BUDGET_WARN='' BUDGET_LIMIT='' BUDGET_SCOPE='' BUDGET_TAG=''
STOP_AT='' CDN='' RESUME=0 RESTORE=''
COG_DOMAIN='login.toshiroplay.com' COG_REGION='us-east-1' APP_CLIENT_NAME='trigger'

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
    --app-client-name) APP_CLIENT_NAME="${2:?}"; shift ;;
    --cognito-domain) COG_DOMAIN="${2:?}"; shift ;;
    --cognito-region) COG_REGION="${2:?}"; shift ;;
    --budget-scope) BUDGET_SCOPE="${2:?}"; shift ;;
    --budget-tag) BUDGET_TAG="${2:?}"; shift ;;
    --admin-ssh-cidr) ADMIN_SSH="${2:?}"; shift ;;
    --budget-warn) BUDGET_WARN="${2:?}"; shift ;;
    --budget-limit) BUDGET_LIMIT="${2:?}"; shift ;;
    --infra-only) INFRA_ONLY=1 ;;
    --stop-at) STOP_AT="${2:?}"; shift ;;
    --cdn) CDN="${2:?}"; shift ;;
    --resume) RESUME=1 ;;
    --restore) RESTORE="${2:?}"; shift ;;
    --no-restore) RESTORE=none ;;
    --yes) YES=1 ;;
    -h|--help) sed -n '2,84p' "$0"; exit 0 ;;
    *) die "unknown option $1 (see --help)" ;;
  esac
  shift
done
case "$DNS_MODE" in ''|skip|manage|replace) ;; *) die "--dns must be skip, manage or replace" ;; esac
case "$CHANNEL" in main|stable) ;; *) die "--channel must be main or stable" ;; esac
case "$BUDGET_SCOPE" in ''|project|account) ;; *) die "--budget-scope must be project or account" ;; esac
case "$BUDGET_TAG" in ''|Project|AppName) ;; *) die "--budget-tag must be Project or AppName" ;; esac
case "$AUTO_UPDATE" in ''|on|off) ;; *) die "--auto-update must be on or off" ;; esac
case "$CDN" in ''|off|prepare|on) ;; *) die "--cdn must be off, prepare or on" ;; esac
[ -z "$STOP_AT" ] || [[ "$STOP_AT" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "--stop-at takes a number of USD (0 = off)"
[ -z "$RESTORE" ] || [ "$RESTORE" = none ] || [ "$RESTORE" = latest ] || [[ "$RESTORE" =~ ^backups/tiletrigger-[0-9TZ]+\.tar\.gz$ ]] \
  || die "--restore takes latest or a backup's key (backups/tiletrigger-<time>.tar.gz)"

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
    aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" --capabilities CAPABILITY_IAM \
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

stack_exists() { aws cloudformation describe-stacks --stack-name "$STACK" >/dev/null 2>&1; }
stack_param() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Parameters[?ParameterKey=='$1'].ParameterValue" --output text 2>/dev/null | sed 's/^None$//'; }
stack_output() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text | sed 's/^None$//'; }
stack_owns() { aws cloudformation describe-stack-resources --stack-name "$STACK" --logical-resource-id "$1" >/dev/null 2>&1; }

# Sets CloudFront distribution $1's Enabled to $2 (true/false); it reaches every edge in a few minutes.
cdn_enable() {
  local id="$1" want="$2" etag
  aws cloudfront get-distribution-config --id "$id" --output json > "$WORK/dist.json"
  etag="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["ETag"])' "$WORK/dist.json")"
  if python3 -c 'import json,sys; c=json.load(open(sys.argv[1]))["DistributionConfig"]; want=sys.argv[3]=="true"; sys.exit(0) if c["Enabled"]==want else json.dump(dict(c, Enabled=want), open(sys.argv[2], "w")); sys.exit(1)' \
    "$WORK/dist.json" "$WORK/dist-config.json" "$want"; then
    note "CloudFront $id: already enabled=$want"
  else
    aws cloudfront update-distribution --id "$id" --if-match "$etag" --distribution-config "file://$WORK/dist-config.json" >/dev/null
    note "CloudFront $id: enabled=$want (a few minutes to reach every edge)"
  fi
}

# ------------------------------------------------------------------ --resume: after the cost guard stopped it
if [ "$RESUME" = 1 ]; then
  stack_exists || die "no stack $STACK"
  INSTANCE_NAME="$(stack_output InstanceName)"
  DIST_ID="$(stack_output CdnDistributionId)"
  CAP_BUDGET="$(stack_output SpendCapBudgetName)"
  HUB_HOST="$(stack_output HubHostname)"
  log "Resuming $INSTANCE_NAME"
  if [ -n "$CAP_BUDGET" ]; then
    read -r SPENT CAP < <(aws budgets describe-budget --account-id "$ACCOUNT" --budget-name "$CAP_BUDGET" \
      --query 'Budget.[CalculatedSpend.ActualSpend.Amount,BudgetLimit.Amount]' --output text 2>/dev/null || echo "? ?")
    note "this month's account spend: $SPENT USD of the $CAP USD cap"
    if python3 -c 'import sys; sys.exit(0 if float(sys.argv[1]) >= float(sys.argv[2]) else 1)' "$SPENT" "$CAP" 2>/dev/null; then
      die "still at or over the cap: the cost guard would stop it again within the hour. Check Billing, then raise the cap (infra/deploy-multiplayer.sh --stop-at <USD>, a normal run) and resume"
    fi
  fi
  aws lightsail start-instance --instance-name "$INSTANCE_NAME" >/dev/null 2>&1 || note "start-instance: already running or starting"
  [ -z "$DIST_ID" ] || cdn_enable "$DIST_ID" true
  for _ in $(seq 1 60); do
    [ "$(aws lightsail get-instance-state --instance-name "$INSTANCE_NAME" --query state.name --output text)" = running ] && break
    sleep 5
  done
  note "instance: $(aws lightsail get-instance-state --instance-name "$INSTANCE_NAME" --query state.name --output text)"
  ok=no
  for _ in $(seq 1 60); do curl -fsS --max-time 10 "https://$HUB_HOST/lobby/health" >/dev/null 2>&1 && { ok=yes; break; }; sleep 5; done
  [ "$ok" = yes ] || die "https://$HUB_HOST/lobby/health did not answer within 5 minutes (the CDN may still be enabling: try the address again in a few minutes; logs: Lightsail console -> Connect -> sudo journalctl -u tiletrigger-hub -n 80)"
  log "Back up: https://$HUB_HOST/lobby/health answers"
  exit 0
fi

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
# CloudFront: the run's target, and what the stack deploys now (on from not-on: prepare first, then cut over).
CDN_NOW=off
[ "$EXISTS" = 0 ] || CDN_NOW="$(stack_output SiteCdn)"
CDN_NOW="${CDN_NOW:-off}"
[ -n "$CDN" ] || CDN="$CDN_NOW"
STACK_CDN="$CDN" CUTOVER=0
if [ "$CDN" = on ] && [ "$CDN_NOW" != on ]; then
  STACK_CDN=prepare CUTOVER=1
  [ "$INFRA_ONLY" = 0 ] || die "--cdn on from $CDN_NOW checks the box and the CDN before the cut-over: run it without --infra-only (or use --cdn prepare)"
fi
if [ "$CDN" != off ]; then
  [ "$REGION" = us-east-1 ] || die "--cdn needs the stack in us-east-1 (CloudFront certificates and metrics live there)"
  [ "$DNS_MODE" != skip ] || die "--cdn needs --dns manage (the certificate is validated and the alias made in the zone)"
  if [ "$CUTOVER" = 1 ]; then note "CDN: $CDN_NOW -> on (prepare, check, then cut over)"; else note "CDN: $CDN"; fi
fi

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
    python3 -c 'import json,secrets,sys; print(json.dumps({"Name":sys.argv[1],"Type":"SecureString","Tier":"Standard","Value":secrets.token_hex(32),"Description":sys.argv[2],"Tags":[{"Key":"Project","Value":sys.argv[3]},{"Key":"AppName","Value":sys.argv[4]}]}))' \
      "$name" "Tile Trigger $1 (created by infra/deploy-multiplayer.sh)" "$PROJECT" "$APP_NAME" > "$WORK/param.json"
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
# The CloudFront edge key: a plain String (the template reads it with {{resolve:ssm:...}}, which takes no
# SecureString there); it only marks requests that came through CloudFront (docs/MULTIPLAYER_SECURITY.md).
if ! aws ssm get-parameter --name "$SSM_PREFIX/edge-key" --query Parameter.Name --output text >/dev/null 2>&1; then
  python3 -c 'import json,secrets,sys; print(json.dumps({"Name":sys.argv[1],"Type":"String","Tier":"Standard","Value":secrets.token_hex(24),"Description":"Tile Trigger: header value marking requests from CloudFront (created by infra/deploy-multiplayer.sh)","Tags":[{"Key":"Project","Value":sys.argv[2]},{"Key":"AppName","Value":sys.argv[3]}]}))' \
    "$SSM_PREFIX/edge-key" "$PROJECT" "$APP_NAME" > "$WORK/param.json"
  aws ssm put-parameter --cli-input-json "file://$WORK/param.json" >/dev/null
  rm -f "$WORK/param.json"
  note "$SSM_PREFIX/edge-key: created"
fi
aws ssm get-parameter --name "$SSM_PREFIX/edge-key" --query Parameter.Value --output text > "$WORK/edge-key"
EDGE_KEY_VERSION="$(aws ssm get-parameter --name "$SSM_PREFIX/edge-key" --query Parameter.Version --output text)"
chmod 600 "$WORK/edge-key"

# ------------------------------------------------------------------ 4. alarm contact
log "Lightsail alarm contact"
CONTACT="$(aws lightsail get-contact-methods --protocols Email --query 'contactMethods[0].[contactEndpoint,status]' --output text 2>/dev/null || true)"
if [ -z "$CONTACT" ] || [ "$CONTACT" = None ]; then
  aws lightsail create-contact-method --protocol Email --contact-endpoint "$EMAIL" >/dev/null
  note "created for $EMAIL: open the verification email Lightsail sends, or alarms stay silent"
else
  note "existing: $CONTACT"
fi

# ------------------------------------------------------------------ sign-in (Cognito), looked up
# The pool from its managed login domain, Trigger's app client by name in it; if a lookup fails (no
# permission, renamed), the stack keeps the values it has.
log "Sign-in: the ToshiroPlay Cognito pool"
POOL_ID="$(aws cognito-idp describe-user-pool-domain --region "$COG_REGION" --domain "$COG_DOMAIN" --query DomainDescription.UserPoolId --output text 2>/dev/null | sed 's/^None$//' || true)"
[ -n "$POOL_ID" ] || POOL_ID="$(stack_param CognitoUserPoolId)"
if [ -n "$POOL_ID" ] && [ -z "$APP_CLIENT" ]; then
  APP_CLIENT="$(aws cognito-idp list-user-pool-clients --region "$COG_REGION" --user-pool-id "$POOL_ID" --max-results 60 --query "UserPoolClients[?ClientName=='$APP_CLIENT_NAME'].ClientId" --output text 2>/dev/null | sed 's/^None$//' || true)"
  [ "$(wc -w <<<"$APP_CLIENT")" -le 1 ] || die "more than one app client named $APP_CLIENT_NAME in $POOL_ID: pass --app-client-id"
  [ -n "$APP_CLIENT" ] || APP_CLIENT="$(stack_param CognitoAppClientId)"
fi
if [ -n "$POOL_ID" ] && [ -n "$APP_CLIENT" ]; then note "pool $POOL_ID ($COG_DOMAIN), app client $APP_CLIENT"
else note "not found (domain $COG_DOMAIN, client $APP_CLIENT_NAME): sign-in stays off. Pass --cognito-domain / --app-client-id."; fi

# ------------------------------------------------------------------ 5. stack
OVERRIDES=()
add() { OVERRIDES+=("$1=$2"); }
[ -n "$EMAIL" ] && add AlertEmail "$EMAIL"
[ -n "$INSTANCE" ] && add InstanceName "$INSTANCE"
[ -n "$AZ" ] && add AvailabilityZone "$AZ"
[ -n "$BUNDLE" ] && add BundleId "$BUNDLE"
add CognitoRegion "$COG_REGION"
add CognitoDomain "$COG_DOMAIN"
add CognitoUserPoolId "$POOL_ID"
add CognitoAppClientId "$APP_CLIENT"
[ -n "$BUDGET_SCOPE" ] && add BudgetScope "$BUDGET_SCOPE"
[ -n "$BUDGET_TAG" ] && add CostTagKey "$BUDGET_TAG"
[ -n "$BUDGET_WARN" ] && add BudgetWarnUsd "$BUDGET_WARN"
[ -n "$BUDGET_LIMIT" ] && add BudgetLimitUsd "$BUDGET_LIMIT"
[ -n "$STOP_AT" ] && add StopAtUsd "$STOP_AT"
add SiteCdn "$STACK_CDN"
add EdgeKeyVersion "$EDGE_KEY_VERSION"
add OriginHostname "origin.$HOSTNAME_"
add ZoneName "$ZONE"
add HubHostname "$HOSTNAME_"
add SsmPrefix "$SSM_PREFIX"
add ProjectTag "$PROJECT"
add AppNameTag "$APP_NAME"
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
aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" --capabilities CAPABILITY_IAM \
  --parameter-overrides "${OVERRIDES[@]}" \
  --tags "Project=$PROJECT" "AppName=$APP_NAME" Environment=prod ManagedBy=cloudformation \
  --no-fail-on-empty-changeset

STATIC_IP="$(stack_output StaticIp)"
INSTANCE_NAME="$(stack_output InstanceName)"
HUB_HOST="$(stack_output HubHostname)"
TURN_HOST="$(stack_output TurnHostname)"
DNS_MANAGED="$(stack_output DnsManaged)"
ROOT_DOMAIN=''
[ "$(stack_param ManageRootRecord)" = true ] && [ -n "$(stack_param HostedZoneId)" ] && ROOT_DOMAIN="$(stack_param ZoneName)"
ORIGIN_HOST="$(stack_output OriginHostname)"
CDN_DOMAIN="$(stack_output CdnDomain)"
DIST_ID="$(stack_output CdnDistributionId)"
BACKUP_BUCKET="$(stack_output BackupBucket)"
note "instance $INSTANCE_NAME, static IP $STATIC_IP, DNS: $DNS_MANAGED"
[ -z "$CDN_DOMAIN" ] || note "CDN $DIST_ID ($CDN_DOMAIN), origin $ORIGIN_HOST, TURN at $TURN_HOST"

# ------------------------------------------------------------------ backup key (SSM SecureString)
# The stack's backup user may only add objects under backups/ in the backup bucket. Its access key is made
# here once (CloudFormation would have to keep the secret in the stack) and kept in SSM; the user's older
# keys are deleted first (without the SSM copy nobody can use them). Never printed.
log "Backup key ($SSM_PREFIX/backup-key)"
BACKUP_USER="$(stack_output BackupWriterUser)"
have_user="$(aws ssm get-parameter --name "$SSM_PREFIX/backup-key" --with-decryption --query Parameter.Value --output text 2>/dev/null \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("user",""))' 2>/dev/null || true)"
if [ -n "$have_user" ] && [ "$have_user" = "$BACKUP_USER" ]; then
  note "exists for $BACKUP_USER (kept)"
else
  for k in $(aws iam list-access-keys --user-name "$BACKUP_USER" --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
    aws iam delete-access-key --user-name "$BACKUP_USER" --access-key-id "$k"
  done
  aws iam create-access-key --user-name "$BACKUP_USER" --output json > "$WORK/access-key.json"
  python3 -c 'import json,sys; k=json.load(open(sys.argv[1]))["AccessKey"]; print(json.dumps({"Name":sys.argv[2],"Type":"SecureString","Tier":"Standard","Overwrite":True,"Value":json.dumps({"user":k["UserName"],"id":k["AccessKeyId"],"secret":k["SecretAccessKey"]}),"Description":"Tile Trigger backup writer key (put-only; created by infra/deploy-multiplayer.sh)"}))' \
    "$WORK/access-key.json" "$SSM_PREFIX/backup-key" > "$WORK/param.json"
  rm -f "$WORK/access-key.json"
  aws ssm put-parameter --cli-input-json "file://$WORK/param.json" >/dev/null
  rm -f "$WORK/param.json"
  note "created for $BACKUP_USER (the first backup runs tonight; sudo tiletrigger-backup on the box runs one now)"
fi
aws ssm get-parameter --name "$SSM_PREFIX/backup-key" --with-decryption --query Parameter.Value --output text > "$WORK/backup-key"
chmod 600 "$WORK/backup-key"

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

# ------------------------------------------------------------------ 5b. restore (a fresh box, or --restore)
# The box's key can't read the bucket: the backup comes from here (the owner's credentials) over SSH.
REMOTE="$(rssh 'umask 077; mktemp -d')"
RESTORE_FILE='' RESTORE_FORCE=0 RESTORE_KEY=''
if [ "$RESTORE" != none ]; then
  if [ -n "$RESTORE" ]; then
    RESTORE_FORCE=1 RESTORE_KEY="$RESTORE"
  elif [ -z "$(rssh 'sudo ls -A /var/lib/tiletrigger 2>/dev/null | head -n 1' || true)" ]; then
    RESTORE_KEY=latest
  fi
  if [ "$RESTORE_KEY" = latest ]; then
    RESTORE_KEY="$(aws s3api list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix backups/ --query 'sort_by(Contents, &LastModified)[-1].Key' --output text 2>/dev/null | sed 's/^None$//' || true)"
    if [ -z "$RESTORE_KEY" ]; then
      [ "$RESTORE_FORCE" = 0 ] || die "--restore latest: no backup in s3://$BACKUP_BUCKET/backups/"
      note "fresh box and no backup in s3://$BACKUP_BUCKET yet: it starts empty"
    fi
  fi
  if [ -n "$RESTORE_KEY" ]; then
    if [ "$RESTORE_FORCE" = 1 ]; then log "Restoring s3://$BACKUP_BUCKET/$RESTORE_KEY over the box's state (the old one is moved aside on the box)"
    else log "Fresh box: restoring the latest backup, s3://$BACKUP_BUCKET/$RESTORE_KEY"; fi
    aws s3 cp "s3://$BACKUP_BUCKET/$RESTORE_KEY" "$WORK/restore.tar.gz" --only-show-errors
    scp -q "${SSH_OPTS[@]}" "$WORK/restore.tar.gz" "$SSH_USER@$STATIC_IP:$REMOTE/restore.tar.gz"
    rm -f "$WORK/restore.tar.gz"
    RESTORE_FILE="$REMOTE/restore.tar.gz"
  fi
fi

# Settings + secrets for host-setup.sh: a root-only file, removed after use.
{
  printf '%s=%q\n' DOMAIN "$HUB_HOST" ROOT_DOMAIN "$ROOT_DOMAIN" TURN_HOST "$TURN_HOST" STATIC_IP "$STATIC_IP" \
    REPO "$REPO" BRANCH "$BRANCH" REF "$REF" CHANNEL "$CHANNEL" RELEASE "$RELEASE" BUILD_HERE "$BUILD_HERE" \
    AUTO_UPDATE "$AUTO_UPDATE" PROVENANCE "$PROVENANCE" ICE_TTL "$ICE_TTL" \
    TURN_SECRET "$(cat "$WORK/turn-secret")" HUB_SIGNING_SECRET "$(cat "$WORK/hub-signing-secret")" \
    COGNITO_REGION "$(stack_param CognitoRegion)" COGNITO_USER_POOL_ID "$(stack_param CognitoUserPoolId)" \
    COGNITO_APP_CLIENT_ID "$(stack_param CognitoAppClientId)" COGNITO_DOMAIN "$(stack_param CognitoDomain)" HOST_FIREWALL 1 \
    OWNER_SUBS "$OWNER_SUBS" CDN "$STACK_CDN" ORIGIN_HOST "$ORIGIN_HOST" EDGE_KEY "$(cat "$WORK/edge-key")" \
    BACKUP_BUCKET "$BACKUP_BUCKET" BACKUP_REGION "$REGION" RESTORE_FILE "$RESTORE_FILE" RESTORE_FORCE "$RESTORE_FORCE"
  python3 -c 'import json,shlex,sys; k=json.load(open(sys.argv[1])); print("BACKUP_KEY_ID=" + shlex.quote(k["id"])); print("BACKUP_SECRET=" + shlex.quote(k["secret"]))' "$WORK/backup-key"
} > "$WORK/bootstrap.env"
chmod 600 "$WORK/bootstrap.env"

scp -q "${SSH_OPTS[@]}" "$HERE/host-setup.sh" "$HERE/tiletrigger-update.sh" "$HERE/tiletrigger-backup.py" "$HERE/turn-check.py" "$WORK/bootstrap.env" "$WORK/turn-secret" "$SSH_USER@$STATIC_IP:$REMOTE/"
rm -f "$WORK/bootstrap.env"

log "Bootstrapping the instance (packages, Caddy, hub, coturn, the site build; a few minutes the first time, under a minute later)"
rssh "sudo bash $REMOTE/host-setup.sh $REMOTE/bootstrap.env; rc=\$?; if [ -f /etc/tiletrigger-relay-off ]; then echo '== Relay switched off (tiletrigger-relay off): TURN check skipped'; elif [ \$rc = 0 ]; then echo; echo '== TURN check on the box (config)'; sudo python3 $REMOTE/turn-check.py --host 127.0.0.1 --secret-file $REMOTE/turn-secret || rc=\$?; fi; sudo rm -rf $REMOTE; exit \$rc" \
  || die "bootstrap or on-box TURN check failed (see above); SSH: Lightsail console → Connect, then sudo journalctl -u tiletrigger-hub -n 80"

# ------------------------------------------------------------------ 7. checks from outside
log "Checking from the internet"
FAIL=0
# The hub through one address: $1 the URL base, $2 a label; the rest are extra curl options (--connect-to).
check_hub() {
  local base="$1" label="$2"; shift 2
  local ok=no headers
  for _ in $(seq 1 24); do  # Caddy may still be fetching a certificate, CloudFront still deploying
    curl -fsS --max-time 10 "$@" "$base/lobby/health" >/dev/null 2>&1 && { ok=yes; break; }; sleep 5
  done
  if [ "$ok" = yes ]; then note "$label: /lobby/health $(curl -fsS --max-time 10 "$@" "$base/lobby/health")"; else note "FAIL $label: $base/lobby/health (certificate, CDN or hub)"; FAIL=1; return; fi
  # The hub hands TURN credentials only to a live game (/lobby/ice?session=<CODE>, lobby.ts): check that the
  # relay is configured (health) and that a request without a live game gets none.
  if curl -fsS --max-time 10 "$@" "$base/lobby/health" | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("relay") else 1)'; then
    note "$label: hub relay configured (TURN credentials go to live games only)"
  else note "FAIL $label: the hub has no relay configured (TURN_SECRET/TURN_URLS)"; FAIL=1; fi
  if curl -fsS --max-time 10 "$@" "$base/lobby/ice" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if not d.get("relay") and not any(s.get("username") for s in d.get("iceServers",[])) else 1)'; then
    note "$label: /lobby/ice without a live game hands out no TURN credentials"
  else note "FAIL $label: /lobby/ice gave TURN credentials without a live game"; FAIL=1; fi
  headers="$(curl -fsSI --max-time 10 "$@" "$base/")"
  if grep -qi '^strict-transport-security' <<<"$headers"; then note "$label: security headers present"; else note "FAIL $label: no HSTS header"; FAIL=1; fi
}
# Through CloudFront: the page is never cached, a hashed script is cached for a year and served from the edge
# the second time, the hub's paths are not cached.
check_cdn() {
  local base="$1"; shift
  local page script h1 h2
  page="$(curl -fsS --max-time 15 "$@" "$base/")" || { note "FAIL CDN: no page from $base"; FAIL=1; return; }
  script="$(grep -o '/assets/[A-Za-z0-9._-]*\.js' <<<"$page" | head -n 1)"
  [ -n "$script" ] || { note "FAIL CDN: no /assets/ script in the page"; FAIL=1; return; }
  h1="$(curl -fsS -o /dev/null -D - --max-time 30 "$@" "$base$script")"
  for _ in 1 2 3; do h2="$(curl -fsS -o /dev/null -D - --max-time 30 "$@" "$base$script")"; grep -qi '^x-cache: hit from cloudfront' <<<"$h2" && break; sleep 2; done
  if grep -qi '^cache-control: public, max-age=31536000, immutable' <<<"$h2" && grep -qi '^x-cache: hit from cloudfront' <<<"$h2"; then
    note "CDN: hashed files cached a year, served from the edge ($script: $(grep -i '^x-cache' <<<"$h1" | tr -d '\r' | cut -d' ' -f2-) then hit)"
  else note "FAIL CDN: $script not cached as expected ($(grep -i '^x-cache\|^cache-control' <<<"$h2" | tr -d '\r' | paste -sd ' '))"; FAIL=1; fi
  if curl -fsSI --max-time 15 "$@" "$base/" | grep -qi '^cache-control: no-cache'; then note "CDN: the page is revalidated every time (no-cache)"
  else note "FAIL CDN: the page is not no-cache"; FAIL=1; fi
  if curl -fsS -o /dev/null -D - --max-time 15 "$@" "$base/lobby/health" | grep -qi '^x-cache: miss from cloudfront'; then note "CDN: /lobby goes to the box uncached"
  else note "FAIL CDN: /lobby/health looks cached"; FAIL=1; fi
}
resolves_here() { [ "$(python3 -c 'import socket,sys; print(socket.gethostbyname(sys.argv[1]))' "$1" 2>/dev/null || true)" = "$STATIC_IP" ]; }

if [ "$STACK_CDN" = on ]; then
  # The name is CloudFront's; the box answers as the origin.
  if resolves_here "$ORIGIN_HOST"; then check_hub "https://$ORIGIN_HOST" "origin $ORIGIN_HOST"; else note "$ORIGIN_HOST doesn't resolve to $STATIC_IP yet (DNS propagating)"; fi
  check_hub "https://$HUB_HOST" "CDN $HUB_HOST" --connect-to "$HUB_HOST:443:$CDN_DOMAIN:443"
  check_cdn "https://$HUB_HOST" --connect-to "$HUB_HOST:443:$CDN_DOMAIN:443"
elif resolves_here "$HUB_HOST"; then
  check_hub "https://$HUB_HOST" "$HUB_HOST"
  if [ "$STACK_CDN" = prepare ]; then
    if resolves_here "$ORIGIN_HOST"; then check_hub "https://$ORIGIN_HOST" "origin $ORIGIN_HOST"; else note "FAIL $ORIGIN_HOST doesn't resolve to $STATIC_IP yet"; FAIL=1; fi
    # The distribution answers for the site's name before the name points at it (SNI = the site's name).
    check_hub "https://$HUB_HOST" "CDN (before the cut-over)" --connect-to "$HUB_HOST:443:$CDN_DOMAIN:443"
    check_cdn "https://$HUB_HOST" --connect-to "$HUB_HOST:443:$CDN_DOMAIN:443"
  fi
else
  note "$HUB_HOST resolves to something else than $STATIC_IP (DNS not cut over: --dns skip, or still propagating)"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $HUB_HOST" "http://$STATIC_IP/" || true)"
  note "Caddy on http://$STATIC_IP answers $code for $HUB_HOST (308 = redirect to HTTPS: up)"
  [ "$CUTOVER" = 0 ] || { note "FAIL the CDN cut-over needs $HUB_HOST at this box first"; FAIL=1; }
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

# ------------------------------------------------------------------ 7b. CDN cut-over (--cdn on from off/prepare)
if [ "$CUTOVER" = 1 ]; then
  [ "$FAIL" = 0 ] || die "checks failed (above): $HUB_HOST stays at the box, the CDN prepared beside it. Fix, then re-run with --cdn on"
  log "Pointing $HUB_HOST at CloudFront"
  aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" --capabilities CAPABILITY_IAM \
    --parameter-overrides SiteCdn=on --no-fail-on-empty-changeset
  STACK_CDN=on
  note "done: $HUB_HOST is an alias of $CDN_DOMAIN (IPv4 and IPv6). Browsers with the old DNS answer (up to"
  note "the record's TTL, 5 minutes) still reach the box, which keeps answering for the name until the next deploy run drops it."
  check_hub "https://$HUB_HOST" "CDN $HUB_HOST" --connect-to "$HUB_HOST:443:$CDN_DOMAIN:443"
fi

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
   Spend cap       $(stack_output SpendCap) USD/month for the whole account ($(stack_output SpendCapBudgetName)): stops the box
                   and the CDN, emails $EMAIL (confirm the SNS subscription email once); restart: --resume
   CDN             $( [ -n "$CDN_DOMAIN" ] && echo "$STACK_CDN: $CDN_DOMAIN ($DIST_ID), origin $ORIGIN_HOST" || echo off)
   Backups         nightly to s3://$BACKUP_BUCKET/backups/ (kept $(stack_param BackupRetentionDays) days; sudo tiletrigger-backup runs one now)
   Code updates    Lightsail console → Connect → sudo tiletrigger-update (latest green main build;
                   --release vX.Y.Z, --rollback, --status), or re-run this script
DONE
[ "$FAIL" = 0 ] || die "some checks failed (above)"
log "All checks passed"
