# ToshiroPlay / Trigger --- Multiplayer Hosting, Security & AWS Infrastructure Handoff

**Status:** Architecture direction / implementation requirements\
**Audience:** Development agent\
**Priority:** High --- use this document as the current direction for
multiplayer hosting, persistent community servers, security boundaries,
and AWS infrastructure.\
**Infrastructure goal:** Keep recurring AWS cost low. AWS coordinates
multiplayer; player/community machines provide game simulation compute.

------------------------------------------------------------------------

## 1. Product Direction

Trigger is a **browser-first, just-for-fun multiplayer game and creation
platform**.

There is **no goal for ranked, esports, or serious competitive
matchmaking**. Do not introduce expensive competitive infrastructure,
enterprise anti-cheat, dedicated AWS match fleets, Kubernetes, GameLift,
or similar systems unless explicitly requested later.

The desired player experience is:

-   Open the game in a browser.
-   Play without installing the game.
-   Host casual matches directly from the browser.
-   Join friends by server browser / join code.
-   Browse and play community-created maps/scenarios.
-   Optionally dedicate an unused PC to persistent hosting.
-   Persistent hosting should still be **managed primarily from the
    ToshiroPlay web interface**.
-   Community-hosted compute should keep ToshiroPlay's AWS costs low.

### Core infrastructure philosophy

> **AWS coordinates. Players/community machines compute.**

AWS should provide the small, always-on control plane. It should not
normally run the authoritative game simulations.

------------------------------------------------------------------------

## 2. Supported Hosting Models

The architecture should support two hosting modes.

### 2.1 Instant Browser Host

A player can click **Host Match** from the browser.

The browser becomes the authoritative host for that match.

Use cases:

-   friends playing together;
-   temporary community matches;
-   quick testing;
-   MapMaker playtests;
-   smaller bot/NPC sessions.

Expected behavior:

-   no installation;
-   WebRTC networking;
-   direct peer connectivity preferred;
-   TURN only when direct connectivity fails;
-   if the host browser closes/crashes/reloads, the match may end unless
    host migration is implemented later.

This limitation is acceptable for Instant Browser Host.

### 2.2 Persistent Community Host

Persistent hosting must **not depend on keeping a browser tab alive**.

Provide an optional lightweight local component, referred to in this
document as:

**Toshiro Host Service**

The normal management interface remains:

`trigger.toshiroplay.com/host`

The Host Service runs in the background on the user's computer and
continues hosting if:

-   the management browser is closed;
-   the page is refreshed;
-   the user navigates away;
-   the browser crashes.

The Host Service should optionally:

-   start with the operating system;
-   automatically restore its server after reboot;
-   restart the game-server process after a crash;
-   reconnect/register with the AWS Hub automatically.

The Host Service is optional. Normal players should never need it to
play the game.

------------------------------------------------------------------------

## 3. Persistent Host User Experience

The intended experience is approximately:

1.  User visits `/host`.
2.  User selects **Persistent Host**.
3.  If Host Service is not installed, the site offers a one-time
    installation.
4.  Host Service is paired with the user's ToshiroPlay account.
5.  User configures the server through the browser.
6.  User clicks **Start Server**.
7.  Host Service starts the authoritative simulation.
8.  Host Service registers with the AWS Hub.
9.  Server appears in the game/server browser.
10. User may close the browser.
11. Server continues running until stopped, the machine shuts down, or
    an unrecoverable failure occurs.
12. Returning to `/host` reconnects to the existing Host Service/server
    and shows current status.

The web dashboard should eventually expose:

-   online/offline status;
-   server name;
-   visibility;
-   player count;
-   map/scenario;
-   map rotation;
-   bots/NPC settings;
-   uptime;
-   CPU usage;
-   RAM usage;
-   network usage;
-   simulation/tick health;
-   stop;
-   restart;
-   stop accepting new matches / drain;
-   shutdown when empty.

Do not require ordinary users to edit configuration files, use Docker,
run command-line commands, understand AWS, or administer Linux.

Advanced CLI/configuration support may exist separately later.

------------------------------------------------------------------------

## 4. Shared Authoritative Simulation

Do **not** create separate gameplay implementations for browser-hosted
and persistent-hosted matches.

The authoritative game simulation must be reusable.

Conceptually:

``` text
                     SHARED GAME CORE
                            |
               Authoritative Simulation
                            |
             +--------------+--------------+
             |                             |
       Browser Host                  Host Service
       Web Worker(s)                 Headless Runtime
             |                             |
             +---------- Transport --------+
                            |
                         Players
```

The shared simulation owns authoritative gameplay including:

-   player state;
-   movement validation;
-   weapons;
-   physical bullets/projectiles;
-   damage;
-   health;
-   inventory;
-   pickups;
-   objectives;
-   scoring;
-   MapMaker triggers;
-   NPC AI;
-   Player Bot AI;
-   vehicles;
-   spawning;
-   factions;
-   destruction/gameplay state;
-   match rules.

Rendering, UI, DOM access, Babylon.js rendering, audio, and
browser-specific APIs must **not** be dependencies of the authoritative
simulation core.

Networking should also be abstracted from game rules.

Prefer an interface conceptually similar to:

``` text
Game Simulation
      |
NetworkTransport
      |
+-----+----------------+
|                      |
WebRTC Transport     Future Transport
```

Do not scatter PeerJS-specific calls throughout gameplay systems.

------------------------------------------------------------------------

## 5. Persistent Host Service Security Boundary

The Host Service is security-sensitive software because it:

-   runs persistently;
-   communicates with the internet;
-   receives management instructions;
-   launches/controls game simulation;
-   downloads game/map data;
-   updates itself.

Therefore:

### SEC-HOST-001 --- No elevated privileges

The Host Service should run as a normal user whenever possible.

It must not require Administrator/root privileges for normal operation.

### SEC-HOST-002 --- No general remote shell

The Host Service must **never become a generic remote-command execution
system**.

Allowed remote commands should be structured and explicitly implemented,
for example:

-   `START_SERVER`
-   `STOP_SERVER`
-   `RESTART_SERVER`
-   `DRAIN_SERVER`
-   `SET_CONFIG`
-   `SET_ROTATION`
-   `UPDATE`
-   `REQUEST_STATUS`

Never implement something equivalent to:

``` text
RUN_COMMAND "<arbitrary shell command>"
```

### SEC-HOST-003 --- Outbound control connection

Prefer the Host Service establishing an authenticated **outbound**
connection to the ToshiroPlay Hub.

Do not expose a general remote-administration port on the user's
computer.

Remote management should conceptually be:

``` text
Browser
   |
ToshiroPlay Hub
   |
authenticated control channel
   |
Host Service
```

### SEC-HOST-004 --- Pairing and ownership

A Host Service installation must be explicitly paired with a ToshiroPlay
account/host identity.

A user must not be able to claim a host merely by discovering its IP
address.

Plan for:

-   host ID;
-   owner account ID;
-   host authentication credentials/key material;
-   pairing/revocation;
-   last heartbeat;
-   version;
-   capabilities;
-   status.

Future delegated administration may use explicit roles such as
Owner/Admin/Moderator rather than shared credentials.

### SEC-HOST-005 --- Crash supervision

If the simulation process crashes:

1.  capture a bounded crash/error record;
2.  stop the failed process;
3.  apply crash-loop protection;
4.  restart when appropriate;
5.  reconnect/register with the Hub.

Never create an uncontrolled infinite restart loop.

------------------------------------------------------------------------

## 6. Browser Clients Are Untrusted

There is no ranked mode, so do **not** overbuild anti-cheat.

However, the protocol must still assume browser clients can be modified
through DevTools or custom clients.

The client should send **intent**, not authoritative results.

Prefer:

``` text
Player attempted to fire weapon X.
```

Do not trust:

``` text
Player dealt 500 damage to target Y.
```

The authoritative host determines important game state.

Validate server-side/host-side:

-   movement;
-   firing;
-   rate of fire;
-   ammunition;
-   damage;
-   inventory;
-   spawning;
-   pickups;
-   objective completion;
-   scoring;
-   teleportation;
-   administrative actions.

Basic sanity validation is sufficient for the product's casual nature.
Do not build heavyweight competitive anti-cheat unless explicitly
requested.

------------------------------------------------------------------------

## 7. Community Content Security

### Critical product rule: NO USER-UPLOADED ASSETS

Community creators are **not allowed to upload arbitrary external
assets**.

All playable visual/audio/content assets must come from the approved
**in-house game asset library**.

This includes, unless explicitly changed later:

-   models;
-   textures;
-   materials;
-   audio;
-   music;
-   images;
-   scripts;
-   executables;
-   DLLs;
-   arbitrary binary files.

MapMaker/community content should reference approved assets by stable
asset IDs.

Example:

``` json
{
  "assetId": "forest/tree/oak_03",
  "position": [10, 0, 25],
  "rotation": [0, 90, 0]
}
```

It should not contain arbitrary filesystem or remote URLs.

### Community maps are declarative data

Community maps/scenarios may define:

-   geometry placement;
-   approved asset references;
-   entities;
-   spawns;
-   factions;
-   objectives;
-   variables;
-   MapMaker WHEN / IF / DO logic;
-   approved gameplay settings;
-   environment settings;
-   NPC configurations;
-   weapon/pickup placement;
-   vehicle placement;
-   approved scenario rules.

Community maps must **never execute arbitrary JavaScript, shell
commands, DLLs, binaries, or other arbitrary code**.

Do not add a generic `script` field to MapMaker content.

------------------------------------------------------------------------

## 8. MapMaker Resource Safety

Community-created maps can cause denial-of-service accidentally or
intentionally even without uploaded code.

The simulation must enforce resource budgets.

Plan hard/configurable limits for:

-   total entities;
-   active NPCs;
-   Player Bots;
-   vehicles;
-   active projectiles;
-   destructibles;
-   trigger nodes;
-   trigger executions per simulation step;
-   spawned entities per interval;
-   particle/effect requests where relevant;
-   map data size;
-   sequence depth;
-   repeated event execution;
-   simultaneous physics objects.

### Trigger loop protection

The WHEN / IF / DO system must prevent uncontrolled loops such as:

``` text
A triggers B
B triggers C
C triggers A
```

Use:

-   execution budgets;
-   cycle detection where practical;
-   maximum operations per tick;
-   deferred execution where appropriate;
-   clear MapMaker validation warnings.

A malicious or broken map must not be able to freeze the host
indefinitely.

------------------------------------------------------------------------

## 9. Map Distribution and Versioning

Because all assets are in-house, community map packages should remain
small and primarily contain structured data.

Each published map/version should have:

-   immutable map ID;
-   immutable version ID;
-   schema version;
-   content hash/checksum;
-   creator ID;
-   required game version;
-   referenced asset IDs;
-   metadata.

Joining should conceptually be:

``` text
Join Server
    |
Required map/version known?
    |
   No
    |
Fetch map data
    |
Validate schema/hash
    |
Confirm required asset IDs exist
    |
Load
    |
Join
```

A host and every client must use the same published map version.

Do not rely on map names as identifiers.

------------------------------------------------------------------------

## 10. WebRTC / Multiplayer Networking

Preferred gameplay path:

``` text
Player Browser
      |
 Direct WebRTC
      |
Authoritative Host
```

Use TURN only as fallback when direct connectivity cannot be
established.

The Hub provides:

-   lobby/server discovery;
-   join codes;
-   session coordination;
-   WebRTC signaling;
-   host registration;
-   host heartbeats;
-   temporary TURN authorization;
-   basic remote host management/control plane.

### TURN security/cost requirements

The TURN service must not become an unrestricted public relay.

Require:

-   temporary/short-lived TURN credentials;
-   session authorization;
-   expiration;
-   bandwidth monitoring;
-   reasonable concurrent-session limits;
-   abuse protection;
-   ability to revoke/disable access.

Track enough usage to identify unexpectedly high relay consumption.

Direct connectivity should always be preferred because TURN traffic
consumes ToshiroPlay infrastructure bandwidth.

------------------------------------------------------------------------

## 11. Home Network Safety

Do not instruct ordinary users to:

-   put their PC in router DMZ mode;
-   expose a generic admin interface;
-   open broad port ranges unnecessarily;
-   disable their firewall;
-   run the Host Service as Administrator/root.

If inbound ports become necessary for optimal direct hosting, expose
only the minimum required gameplay ports and provide guided
instructions.

Hosting should continue to work through fallback networking where
feasible, though relayed hosting may have capacity/bandwidth
restrictions.

------------------------------------------------------------------------

## 12. Secrets and Credentials

Never place reusable secrets in the browser bundle.

Examples that must remain server-side or be temporary:

-   AWS credentials;
-   TURN master/shared secrets;
-   signing keys;
-   host-service signing credentials;
-   administrative tokens;
-   database credentials;
-   deployment credentials.

Browser-facing tokens should be:

-   scoped;
-   short-lived where practical;
-   revocable;
-   limited to required actions.

Do not log reusable authentication secrets.

------------------------------------------------------------------------

## 13. Updates and Supply Chain

Persistent Host Service updates are executable code and therefore
require stronger protection than ordinary web deployment.

Requirements:

-   signed releases;
-   verify signature before applying update;
-   HTTPS transport;
-   version tracking;
-   rollback/recovery strategy;
-   dependency versions locked;
-   dependency/security scanning in CI;
-   no arbitrary update URL supplied by remote users.

Prefer draining active matches before a planned update:

``` text
Update available
      |
Stop accepting new matches
      |
Current match finishes
      |
Apply verified update
      |
Restart
      |
Re-register
```

Emergency security updates may override normal draining behavior if
necessary.

------------------------------------------------------------------------

## 14. Logging and Privacy

Keep logs useful but minimal.

Potential logs:

-   server startup/shutdown;
-   host registration;
-   connection failures;
-   crash reports;
-   simulation health;
-   TURN usage;
-   administrative actions;
-   map/version loaded;
-   abuse/security events.

Avoid unnecessarily retaining:

-   authentication tokens;
-   passwords;
-   private keys;
-   excessive personal information.

If IP addresses are needed operationally, retain only as long as
justified.

------------------------------------------------------------------------

## 15. Player / Community Safety

There will be no chat/comments requirement at this stage, which reduces
moderation surface.

Still design identifiers/data models so future controls are possible:

-   kick player;
-   server-local ban;
-   block player;
-   report player;
-   report map;
-   report server;
-   hide creator;
-   private/unlisted/public visibility;
-   inappropriate server/map name handling.

Do not build a large moderation platform now, but do not make these
controls impossible later.

------------------------------------------------------------------------

# 16. AWS Architecture Direction

A **new AWS CloudFormation template and deployment/setup script are
required**.

Do not simply patch the old infrastructure blindly. Review the current
deployment and create/update infrastructure specifically for this
multiplayer architecture.

The new infrastructure should remain intentionally small.

## AWS responsibilities

AWS should provide the control plane:

``` text
                    AWS
                     |
          +----------+----------+
          |                     |
      Public Web             Multiplayer Hub
      / Static App           / Control Plane
          |                     |
          |             +-------+-------+
          |             |               |
          |          Signaling       Host Registry
          |             |               |
          |          Sessions        Heartbeats
          |             |               |
          |          Join Codes      Host Control
          |             |
          |            TURN
          |
       Players
```

AWS should **not normally run authoritative match simulation**.

Community/player machines provide match compute.

------------------------------------------------------------------------

## 17. Static Game Delivery

Evaluate the existing deployment and prefer using:

-   Amazon S3 for static game/build assets;
-   Amazon CloudFront for CDN/HTTPS delivery where appropriate;
-   Route 53 for DNS.

The game client, approved in-house assets, and static content should not
unnecessarily consume the Lightsail application's bandwidth if
S3/CloudFront is already available and appropriate.

Avoid unnecessary migration if the current static hosting already
satisfies this cleanly.

------------------------------------------------------------------------

## 18. Lightsail Multiplayer Hub

Use a low-cost Lightsail instance for the always-on
multiplayer/control-plane workload unless measured requirements justify
a change.

Expected components may include:

### Caddy or equivalent reverse proxy

Responsibilities:

-   HTTPS;
-   routing;
-   WebSocket upgrade/proxy support where required;
-   security headers;
-   proxying Hub endpoints.

### Node/TypeScript Hub

Responsibilities:

-   server discovery;
-   browser-host registration;
-   persistent-host registration;
-   host heartbeat/expiry;
-   lobby/session creation;
-   join codes;
-   WebRTC signaling;
-   issuing temporary TURN credentials;
-   server metadata;
-   host capability/status reporting;
-   authenticated Host Service control messages;
-   basic abuse/rate limits.

### coturn

Responsibilities:

-   STUN/TURN;
-   fallback relay when direct WebRTC cannot be established.

TURN must use authenticated temporary credentials and must not operate
as an open relay.

------------------------------------------------------------------------

# 19. Required New CloudFormation Template

Create a new CloudFormation template suitable for this architecture.

Suggested filename:

``` text
infra/toshiro-trigger-multiplayer.yaml
```

The agent should inspect the existing repository/infrastructure first
and adapt paths/names as necessary.

The template should provision/configure, where appropriate:

### Networking / instance

-   Lightsail instance;
-   static IP;
-   firewall/network rules limited to required ports;
-   DNS resources if managed in the same stack/process;
-   instance bootstrap/user-data where supported and sensible.

### Required network access

Only expose what the architecture requires.

Likely categories include:

-   HTTP/HTTPS;
-   TURN/STUN ports;
-   TURN relay UDP range;
-   required signaling/API access.

Do **not** expose:

-   database ports publicly;
-   Node internal application ports directly if Caddy proxies them;
-   generic remote admin APIs;
-   broad unnecessary port ranges.

Administrative SSH access should be restricted/managed appropriately
rather than treated as a public game endpoint.

### DNS

Plan clean hostnames.

For example, subject to existing DNS:

``` text
trigger.toshiroplay.com
```

for the game/site and potentially dedicated service subdomains such as:

``` text
hub.trigger.toshiroplay.com
turn.trigger.toshiroplay.com
```

if that produces cleaner routing.

Do not invent conflicting DNS without checking the current Route
53/CloudFront setup.

### Outputs

CloudFormation should provide useful outputs such as:

-   public/static IP;
-   Hub hostname;
-   TURN hostname;
-   instance identifier;
-   relevant DNS names.

------------------------------------------------------------------------

# 20. Required Deployment / Setup Script

Create a new deployment/setup script to accompany the CloudFormation
template.

Suggested location:

``` text
infra/deploy-multiplayer.sh
```

If the project standard is PowerShell or another scripting language,
provide the appropriate equivalent as well.

The script should automate as much as reasonably possible:

1.  validate prerequisites;
2.  validate CloudFormation template;
3.  deploy/update the stack;
4.  capture stack outputs;
5.  configure/bootstrap the Lightsail host;
6.  install/update required packages;
7.  configure Caddy;
8.  deploy the Hub;
9.  configure coturn;
10. configure services to restart after reboot/crash;
11. apply safe firewall rules;
12. verify health endpoints;
13. verify TURN is not an open relay;
14. print the resulting endpoints/status.

Deployment should be repeatable/idempotent where practical.

Do not embed secrets directly in source-controlled scripts/templates.

------------------------------------------------------------------------

## 21. AWS Secrets / Configuration

Use an appropriate AWS-managed mechanism for deployment/runtime secrets
rather than committing them to Git.

Examples include Secrets Manager, SSM Parameter Store, or an
appropriately secured equivalent depending on cost/complexity.

Keep the solution inexpensive.

Potential secret/config categories:

-   TURN shared/master secret;
-   Hub signing/auth secrets;
-   host pairing/signing secrets;
-   deployment configuration.

Do not over-engineer this with expensive infrastructure.

------------------------------------------------------------------------

## 22. AWS Cost Safety

Cost containment is a product requirement.

Implement:

-   AWS Budget(s);
-   billing alerts at intentionally low thresholds;
-   monitoring for unexpected bandwidth;
-   monitoring for excessive TURN usage;
-   log retention limits;
-   resource tagging;
-   ability to disable/restrict relay usage if abuse occurs.

Do not introduce without explicit justification:

-   NAT Gateway;
-   RDS;
-   ElastiCache;
-   EKS/Kubernetes;
-   ECS cluster;
-   GameLift;
-   multi-region active-active;
-   dedicated AWS match-server fleet;
-   unnecessary load balancers.

Start simple.

Scale only from measured need.

------------------------------------------------------------------------

# 23. Hub Security Requirements

The Hub is internet-facing and must include basic defensive controls.

Implement/plan:

-   TLS everywhere;
-   secure WebSocket connections;
-   schema validation for all requests;
-   maximum request/message sizes;
-   rate limiting;
-   authentication where required;
-   authorization for host management;
-   session expiration;
-   heartbeat expiration;
-   join-code entropy;
-   temporary TURN credentials;
-   replay-resistant/expiring sensitive tokens where practical;
-   bounded logs;
-   health endpoint;
-   graceful service restart.

Do not trust metadata supplied by hosts or clients without validation.

------------------------------------------------------------------------

# 24. Host Heartbeat / Lifecycle

Persistent and browser hosts register with the Hub.

Conceptually:

``` text
HOST STARTS
    |
Authenticate/Register
    |
Report capabilities
    |
Heartbeat
    |
Hub lists host
```

If heartbeats stop:

``` text
Heartbeat missed
      |
Grace period
      |
Mark unhealthy
      |
Remove from discovery
```

Do not leave stale hosts permanently visible.

The host should report enough data for discovery/health without exposing
unnecessary machine information.

Potential fields:

-   host ID;
-   display name;
-   game version;
-   region;
-   current players;
-   capacity;
-   current map/mode;
-   available/unavailable;
-   host type;
-   simulation health;
-   heartbeat timestamp.

------------------------------------------------------------------------

# 25. Performance / Abuse Budgets

Every network-facing component needs bounded work.

Set limits for:

### Hub

-   requests per client;
-   WebSocket message frequency;
-   message size;
-   concurrent sessions;
-   registration attempts;
-   join-code attempts.

### TURN

-   credential lifetime;
-   concurrent relays;
-   bandwidth;
-   session duration where appropriate.

### Host

-   incoming packet/message rate;
-   packet/message size;
-   entity creation;
-   trigger execution;
-   NPC counts;
-   projectile counts.

A malformed client/map should degrade or be rejected rather than consume
unbounded resources.

------------------------------------------------------------------------

# 26. Failure Behavior

Design explicit behavior for common failures.

### Browser host closes

Match may terminate.

Later host migration can improve this.

### Persistent host management browser closes

No effect.

### Host Service crashes

Attempt controlled restart.

### Simulation child process crashes

Capture bounded diagnostic information and restart subject to crash-loop
protection.

### Host PC shuts down

Hub expires the host after missed heartbeats.

### Hub temporarily goes offline

Existing direct matches should continue where practical.

Hosts should reconnect/register when Hub returns.

### TURN unavailable

Directly connected sessions should continue.

New strict-network connections may fail gracefully.

### Community map invalid

Reject it before match start with a useful validation error.

------------------------------------------------------------------------

# 27. Development / Testing Requirements

Before calling persistent/community hosting production-ready, test:

### Connectivity

-   normal home NAT;
-   strict NAT;
-   CGNAT where available;
-   TURN fallback;
-   disconnect/reconnect;
-   host heartbeat expiration.

### Browser hosting

-   host tab refresh;
-   host tab close;
-   browser crash;
-   background throttling;
-   machine sleep.

These failures are expected limitations of Instant Browser Host and
should not affect Persistent Host architecture.

### Persistent Host

-   browser closes while match continues;
-   dashboard reconnects;
-   Host Service restart;
-   simulation crash;
-   Windows reboot/startup restore;
-   Hub outage/recovery;
-   network interruption/recovery.

### Security

-   malformed WebSocket messages;
-   oversized messages;
-   invalid map schema;
-   trigger loops;
-   excessive entity spawning;
-   invalid asset IDs;
-   unauthorized host-control request;
-   expired TURN credentials;
-   repeated join-code guesses;
-   attempted arbitrary command execution;
-   attempted filesystem/path traversal.

### Load

Benchmark progressively:

-   8 players;
-   16 players;
-   24 players;
-   32 players;
-   bots;
-   16 NPCs;
-   32 NPCs;
-   64 NPCs;
-   vehicles;
-   projectile-heavy combat.

Do not claim a population target is supported until measured.

------------------------------------------------------------------------

# 28. Implementation Priority

Recommended order:

## Phase 1 --- Secure multiplayer foundation

1.  Separate authoritative simulation from rendering/UI.
2.  Introduce transport abstraction.
3.  Browser-hosted authoritative match.
4.  Hub registration/discovery.
5.  WebRTC signaling.
6.  Direct peer connections.
7.  Authenticated TURN fallback.
8.  Join codes/server browser.
9.  Map schema validation and resource budgets.

## Phase 2 --- Persistent community hosting

1.  Minimal Host Service.
2.  Secure account pairing.
3.  Outbound authenticated Hub connection.
4.  Start/stop authoritative simulation.
5.  Web dashboard management.
6.  Host heartbeat/status.
7.  Crash supervision.
8.  Startup restore.
9.  Signed update pipeline.

## Phase 3 --- Community ecosystem

1.  Published map/version IDs.
2.  Automatic map-data synchronization.
3.  Server rotations.
4.  Persistent server listings.
5.  moderation/reporting primitives;
6.  remote server management;
7.  measured capacity recommendations.

## Phase 4 --- Optimization

Only after measurement:

-   multiple simultaneous matches per host;
-   smarter capacity allocation;
-   host migration;
-   advanced NAT optimization;
-   more sophisticated interest management;
-   additional infrastructure scaling.

------------------------------------------------------------------------

# 29. Non-Negotiable Architecture Rules

1.  **The game remains browser-first.**
2.  **Normal players install nothing.**
3.  **Persistent hosting may use a small optional Host Service.**
4.  **Closing the browser must not terminate a Persistent Host server.**
5.  **AWS is the coordination/control plane, not the normal
    match-compute layer.**
6.  **Community/player machines provide authoritative match compute.**
7.  **Browser clients are untrusted.**
8.  **Community maps are declarative data only.**
9.  **No user-uploaded assets. All playable assets are approved in-house
    assets referenced by ID.**
10. **Community content cannot execute arbitrary code.**
11. **Host Service cannot execute arbitrary remote shell commands.**
12. **Host Service should not require Administrator/root privileges for
    normal operation.**
13. **TURN must be authenticated, temporary, monitored, and bounded.**
14. **Secrets must never be committed or shipped in browser bundles.**
15. **All external data must be schema validated and resource bounded.**
16. **Shared gameplay simulation must not depend on rendering/DOM/UI.**
17. **Networking libraries such as PeerJS must sit behind a transport
    abstraction.**
18. **AWS recurring cost must remain intentionally small.**
19. **Do not add expensive infrastructure without measured
    justification.**
20. **Create a new CloudFormation template and deployment/setup script
    for this architecture.**

------------------------------------------------------------------------

# 30. Immediate Agent Deliverables

Before proceeding deep into multiplayer implementation, provide:

### A. Architecture review

Compare the existing implementation/infrastructure against this
document.

Identify:

-   what already complies;
-   what must change;
-   migration risks;
-   any blockers.

### B. New CloudFormation template

Create/update:

``` text
infra/toshiro-trigger-multiplayer.yaml
```

or the repository's equivalent location.

It should provision the minimal AWS infrastructure required for:

-   multiplayer Hub;
-   signaling;
-   host registry/heartbeat;
-   TURN fallback;
-   DNS/networking;
-   cost-conscious operation.

### C. Deployment/setup script

Create/update:

``` text
infra/deploy-multiplayer.sh
```

or equivalent.

The deployment should be repeatable and should not require manually
reconstructing the environment from undocumented shell history.

### D. Security configuration

Document:

-   exposed ports;
-   firewall rules;
-   TURN authentication method;
-   secret storage;
-   host authentication/pairing approach;
-   Hub authentication;
-   update signing strategy.

### E. Multiplayer protocol boundary

Document the initial message/schema boundaries for:

-   host registration;
-   heartbeat;
-   server discovery;
-   session creation;
-   signaling;
-   join authorization;
-   TURN credential request;
-   persistent-host control messages.

### F. Map security schema

Confirm that published community maps:

-   contain only approved structured data;
-   reference only approved in-house asset IDs;
-   contain no arbitrary executable scripts;
-   are validated before execution;
-   enforce simulation/resource budgets.

### G. Cost estimate

Provide a simple expected monthly AWS cost for the initial architecture
and identify which usage patterns could materially increase cost,
especially TURN bandwidth.

------------------------------------------------------------------------

# 31. Definition of Done for This Infrastructure Pass

This pass is complete when:

-   CloudFormation can create/update the required AWS infrastructure;
-   deployment/setup is documented and repeatable;
-   Hub is reachable over HTTPS/WSS;
-   host can register and heartbeat;
-   stale hosts disappear;
-   browser client can discover/join a host;
-   WebRTC signaling succeeds;
-   TURN fallback uses temporary authenticated credentials;
-   TURN is confirmed not to be an open relay;
-   basic rate/message limits exist;
-   secrets are not committed;
-   AWS cost alerts exist;
-   community maps cannot reference arbitrary external assets;
-   community maps cannot execute arbitrary code;
-   map resource budgets exist or have explicit implementation tasks;
-   persistent Host Service architecture is defined even if
    implementation follows in a subsequent pass;
-   browser-hosted and persistent-hosted simulation use the same shared
    game rules.

------------------------------------------------------------------------

## Final Direction

Do not optimize this project around competitive infrastructure.

Optimize it around:

-   **easy browser play;**
-   **easy friend/community hosting;**
-   **low recurring cost;**
-   **safe community-created maps using in-house assets;**
-   **simple persistent hosting from spare PCs;**
-   **reliable direct WebRTC networking with controlled TURN fallback;**
-   **a small AWS control plane;**
-   **a shared authoritative simulation that can run in a browser or
    persistent Host Service.**

The desired long-term outcome is that a user can create a map in the
browser, publish it, host it for friends immediately, or optionally
dedicate a spare computer as a persistent community server---without
needing to understand server administration or AWS.
