# Mobile audit (2026-11-09/10)

The owner on Android (2026-11-09): "still seeing graphical issues and the UI/UX leaves much to be desired, could be more
intuitive and have better display of information and ability to select options such as characters and maps".

This audit was made with Playwright's phone profiles, sideways:
- **Pixel 7:** 839 × 412 CSS px, touch and a mobile user agent.
- **Galaxy S9+:** 658 × 320.

The pages ran the game's own phone defaults: `html.touch`, Low graphics and the Performance render scale. Desktop at
1400 × 640 is the comparison. SwiftShader stands in for the GPU, so faults that belong to one GPU (see "Dark blocks")
can't be reproduced here.

The screenshots are in the agent session's scratchpad, not in the repo. The e2e `mobile` flow saves
`mobile-characters.png` with its artifacts. The owner's two screenshots are annotated as A1 and A2.

Screenshots (annotated A1-A7; folder `/tmp/claude-0/-home-user/99559628-4a1b-594f-bb6f-7638c8757e80/scratchpad/mobile/`):

| File | What it shows |
|---|---|
| `A1-owner-flak.png` | The owner's Flatpack Depot shot: the Flak Cannon, the terrazzo, the right-hand buttons, the ammo panel. |
| `A2-owner-darkblock.png` | The owner's Bottling Plant shot: the dark block. |
| `A3-hud-s9-before.png` / `hud-s9-after.png` | The HUD on a Galaxy S9+, before and after. |
| `A4-chars-s9-before.png` / `s9-characters-after.png` | Character Select on the S9+, before and after. |
| `px-characters-before2.png` / `px-characters-after.png` | Character Select on the Pixel 7, before and after. |
| `A5-setup-px.png` / `desk-setup.png` | Match Setup on the phone and on desktop. |
| `A6-options-px.png` | Options on the phone. |
| `A7-pause-px-before.png` / `pause-px-after.png` | The pause menu on the phone, before and after. |
| `flak-before-after.png` | The Flak Cannon on the phone, before and after. |

## Fixed in this job (`wip/mobile-audit`)

| What | Before → after | Check |
|---|---|---|
| **Bulky first-person guns.** The Quaternius sci-fi guns are tall, solid blocks. At the rifle's place they covered 12-17 % of a 16:9 screen (Flak Cannon 13.8, Laser Rifle 17.1, Singularity 14.0, rockets 12.4; the rifle 5.0). On a phone the touch buttons also sit there. | `viewOffset` lowered (and the Singularity set 3 cm forward), within the reach the other long guns use (support hand ≤ 0.85 m, grip ≤ 0.6 m). Every carried gun now covers ≤ 11 %: Flak 10.5, Laser Rifle 10.8. | `shared/test/viewmodelCover.test.ts` draws each carried gun's triangles from the eye at the game's field of view. Fails on main with 8 guns over. |
| **Character Select on a phone sideways.** The info panel (8 stacked stat rows) took the height. | Grid: one row, 109 px, names cut off, panel wider than itself → two rows, 179 px, names readable (Pixel 7). On the S9+: 17 px → 87 px. Stats in two columns, no second portrait (the 3D model shows the character). On ~320 px tall screens, numbers only and no tags. | e2e `mobile` → `mobileCharacterSelect`. |
| **Kill feed over the scorebar** (phones under ~760 px wide). | The scorebar is 80 % size there, and each feed line keeps to the room right of it (long names end in "…"). | Screenshots A3 / after. |
| **"WEAPONS" spilled out of its ring** (in the owner's shot too). | 10 px, no letter spacing: fits the 64 px ring. | Screenshot. |
| **Vitals over the move pad** (~320 px tall). | Minimap 88 px and vitals at 64 %: they end above the pad. | Screenshot. |
| **Pause menu showed Esc / Q E / F11 key caps on a phone.** The rule hid `.hint`, but the foot is `.hintbar.pause-hints`. | Key caps hidden on touch; the buttons keep their words (Fullscreen is useful on a phone). | Screenshot A7. |

Not changed:
- **Desktop, and phones taller or wider than these breakpoints** (they look the same).
- **Visual baselines:** the visual flow runs at desktop size.

## Graphics on phone tiers: findings

- **Flak Cannon flat grey:** it is not a missing texture. The whole Quaternius "Modular Sci-Fi Guns" pack is
  untextured flat colours (Flak, Swarm, Railgun, Launcher, Laser Rifle and others). Low draws the same model as
  everyone; the sharper held copies exist only for the textured guns. The low-poly flat look against textured
  maps is an art choice, listed as proposal 8.
- **Texture filtering on phones is already handled.** Level textures are trilinear with 8× anisotropy. On a phone at
  Performance the merged level gets a full mip level of bias (`levelMipBias`), against shimmer. The terrazzo's
  coarse look is the texture itself: Terrazzo013 at 2 m a repeat, large high-contrast specks (proposal 9).
- **Dark blocks on lit walls (owner's Bottling Plant shot, A2; the map has since been retired, but any lamp-lit map
  can show it): diagnosed, not fixed.**
  - **The evidence:** the block's edges are exactly horizontal and vertical on screen while the wall runs off at an
    angle, so it's screen space, not a shadow or a mesh. The tiles inside are still drawn, just without the lamp
    light their neighbours get.
  - **Why it isn't the shadow map:** phones start on Low, which has no shadow map at all.
  - **What fits:** Babylon's clustered map lights (`scenarioVisuals.ts container()`). They mark which lamps reach each
    of 64 × 64 screen tiles by adding one bit per lamp into a float render target, 8 lamps to a layer on phones.
    Babylon's own source notes some phones (Samsung Galaxy) report a 32-bit float target and make a less precise one.
    A tile that loses bits drops its lamps.
  - **What was tried:** SwiftShader draws Bottling Plant's tiled rooms correctly on the phone profile, Low and Medium.
    One lamp per layer (exact on any target) was tried and reverted: Flatpack Depot has 138 lamps, a 64 × 8,832 mask,
    past the texture limit (8,192 here, often 4,096 on phones), and every lamp went out.
  - **Next:** proposal 1 (done in `wip/mobile-fixes`; see "Proposals 1, 5, 6, 10 and 12: done" below).

## Menus and HUD on a phone: findings

**In a match (A1, A3).**
- **Layout:** seven buttons in the right third (Weapons, Reload, Throw, Melee, Use, Aim, Fire), the pad bottom left, and
  the minimap with vitals top left. The centre is clear apart from the ammo panel, which sits low in the middle
  (x 352-487 of 839) over where targets' feet are.
- **Readability:** button labels are 11 px. The pad's "hold: crouch" is 13 px scaled to half (about 6.5 px). The mode
  label under the timer is 10 px.
- **Scores:** there's no way to see the scoreboard on touch except pausing.

**Quick Play.** Fine: two big cards (TDM, DM), Tutorial, and "Choose map and rules". It always picks the map for you;
there's no "play this map" from the home screen.

**Match Setup (A5).**
- **The map:** a plain `<select>` on phones. Desktop gets a searchable grid of map cards with pictures, modes and
  favourites; the code hides the list on small screens.
- **Space:** the scroll body is 236 of 412 px. 32 text items are under 12 px: mode buttons, struck-out "Not on this
  map" modes, variant chips. The steppers are 30 px wide.

**Character Select.** Fixed above for the height.
- **Navigation:** 116 characters in 5 tabs. The tabs scroll sideways and the prev/next buttons are shown as Q/E key caps.
- **Missing:** search and favourites.

**Options (A6).**
- **Width:** a tab rail takes a quarter of the width, and each setting has its description in a narrow column. Controls
  is a 2,772 px page in a 320 px window.
- **Height:** the panel ends 90 px above the bottom of the screen.

## Proposals 1, 5, 6, 10 and 12: done (`wip/mobile-fixes`, 2026-11-10)

The owner picked these. Their phone is a Samsung Galaxy S25+, on Graphics Low (the default) or maybe Medium.

| # | What changed | Check |
|---|---|---|
| 1 | **Lamps on phones** (`game/clusteredLights.ts`). **Low:** no lamp light at all. The fixtures still glow, so no lamp mask exists to lose a lamp. Under a roof the sky light rises to twice its strength instead, easing in and out over about a second (`game/indoorFill.ts`). Flatpack Depot's showroom then has a mean brightness of 78, against 86 with lamps and 43 without. **Medium and High:** 4 lamps to a mask layer instead of Babylon's 8, so a tile's sum is at most 15. That is exact in any float target down to 10-bit floats (8 lamps' 255 needs 8 bits of mantissa). The mask is sized to the map's lamp count and the device's texture limit: rows of tiles drop where layers × 64 would pass it, so no map can overflow (Neon Galleria's 202 lamps at 2,048: 40 rows). **Room lights** switch (Options → Display, pause → Settings; `game/roomLights.ts`): off, lamps glow but light nothing. | `client/test/mobileLights.test.ts` (mask sizing on 2,048-16,384 limits, 0-300 lamps, the fill's easing); e2e `mobile` → `mobileLamps` (Flatpack Depot: Medium 4 a layer within the limit, lamps lighting the room and Room lights off darkening it; Low no lamp light and the fill under the roof). |
| 5 | **Ammo by the fire buttons:** above Reload and Throw, with the weapon name kept and no scaling (12 px+). On ~320 px tall phones it drops the name and sits just above Reload. | e2e `mobileHudChecks`: right of 60 % of the width, above Reload, over no button. |
| 6 | **Tap the scorebar** to show the scoreboard, and tap again to hide it: an invisible tap target over the scorebar (`touchControls.ts` `tc-scores`, Tab on a keyboard). Pausing closes it. | e2e: the target covers the scorebar; tap shows `#scoreboard` with rows, tap hides it. |
| 10 | **12 px text floor on touch:** button labels 11 → 12 px (Weapons ring 64 → 68 px to fit), the mode label and the scorebar's names (15 px under the narrow 80 % scorebar), the kill feed (11 px drawn → 12), the pad's Jump and "hold: crouch" (6.5 → 12 px; the circle is no longer drawn at half size), and Match Setup's mode tiles, "Not on this map", variants, size chips, field names, fit chip and "~15 min". | e2e: no text in `#hud` / `#touch-ui` drawn under 12 px on 915 × 412, 832 × 384 and 658 × 320. |
| 12 | **Kill feed 3 lines** on a touch screen at most 480 px tall (5 elsewhere; `game/feedLimit.ts`). On ~320 px tall phones its lines are a little tighter, so the ammo panel fits under it. | Unit test; e2e: 5 lines in, 3 shown, clear of the ammo panel and Weapons. |

Desktop is unchanged: every rule is under `html.touch`, and the lamps change only on a phone's WebGL 2.

**Costs measured** (SwiftShader, Flatpack Depot, 832 × 384, frames a second; relative only):
- **Low:** Babylon's 8 a layer 1.3-1.7; no lamps 1.3-3.2 (load varied); 1 a layer 0.2-0.4. One lamp a layer is
  exact even in an 8-bit target, but a pixel reads a layer for every lamp near its depth, so it isn't the default
  (`?lampbatch=1` tries it).
- **Medium:** 8 a layer 0.40-0.45; 4 a layer 0.39.

**How the owner checks it on the S25+:**
1. Update the page (the version on the menu), then open a lamp-lit map: Flatpack Depot, Neon Galleria or Cormorant
   Isle. Go where the block showed (a lit wall indoors).
2. **On Low:** the block should be gone, since no lamp light is drawn. Rooms are a little brighter under a roof than
   before.
3. **Options → Display → Graphics: Medium**, then start a match again. Lamps light the rooms, 4 to a layer. If the
   block is gone, precision was the cause and this fixes it.
4. **If it shows on Medium:** pause → Settings → Room lights off. If the block goes with the lamps, the lamp mask is
   to blame: open the page with `?lampbatch=1` added (one lamp a layer, slower) and say whether it goes. If the block
   stays with Room lights off, it isn't the lamps: send a screenshot and Pause → Settings → Copy performance report.
5. To see the old behaviour for comparison: `?lampbatch=8` (Babylon's 8 a layer, also on Low).

## Proposals 7, 9 and 11: done (`wip/mobile-bugs-1114`, 2026-11-14)

| # | What changed | Check |
|---|---|---|
| 7 | **Options in one column on a phone** (`html.touch`, at most 600 px tall or 760 px wide; style.css, `frontEnd.ts` `row`): the sections are chips along the top, the panel takes the whole height, a setting is one line (name left, control right), and its description sits behind an (i) beside the name (the menus' tooltip card, shown on a tap). Desktop unchanged: the (i) is hidden there. | Phone pictures (Pixel 7 839 × 412, S9+ 658 × 320); e2e `mobile` opens Options and its tabs. |
| 9 | **Terrazzo:** `core.pbr_terrazzo` scale 2 → 1.25 m (finer specks), and its colour map's contrast lowered to 0.55 (`adjust` in `content/textures.json`, applied by `prepare-textures.mjs`, recorded in provenance as a modification): the luminance spread 56 → 31 of 255. Gravel and carpet not changed. | Flatpack Depot's showroom on the phone, before and after. |
| 11 | **Match Setup:** the header (it stays while the setup body scrolls) names the mode (`.fact-mode`, phones only); every stepper's − and + are 40 × 40 px on touch (were 30 × 40). "Not on this map" was already gone (only the modes a map plays are shown, owner 2026-11-11). | Phone pictures; steppers measured 40 × 40. |

## Proposals 2, 3 and 4: done (`wip/mobile-2`, 2026-11-17)

Checked at 360 × 780, 412 × 915 and an S25+-like 384 × 832, each upright and sideways (pictures at device scale 2 in the
helper's scratchpad `mobile2/`, before and after, not kept).

| # | What changed | Check |
|---|---|---|
| 2 | (done) **Map cards on phones.** Under 900 px wide, Match Setup's header has a map button (`#arcade-map-pick`: the name, "Change map ▸") instead of the plain `<select>` (still in the page, hidden). It opens the desktop map list full screen (`.screen.play.picking`: tabs, Filter maps, search, sort, favourites, small cards without the plan tile, names on two lines); a card picks and closes it, ✕ or Esc (controller B) closes it. Sideways the title gives way and the bar is one row, so two rows of cards show. **Quick Play** has a third card, **Pick a map** (`#qp-pick`): Match Setup with the picker open (on a wide screen the list is already beside the setup). Upright under 520 px the main menu drops the featured map card (it covered Quick Play). | e2e `mobile` → `mobileMenus` (each size both ways): Quick Play's three cards inside the screen, the picker full screen with ≥ 2 cards a row, a pick closes it and names the map, reopen and Close; no sideways spill. |
| 3 | **Touch layout** (`game/touchLayout.ts`, Options → Controls → Touch on a touch device): **Button size** Small 0.85 / Medium 1 / Large 1.2 (the pad and a new `.tc-cluster` of the buttons, scaled from their corner; Large held back so the cluster leaves 90 px above it: 1.0 at 320 px tall), **Button opacity** 30-100 % (a pressed button at full), **Left-handed** (`html.tc-left`: pad right, buttons and look left; minimap and vitals top right, kill feed and ammo panel left). The ammo panel's height follows the size (`--tc-scale`). **Aim**: the touch Aim button now holds X while pressed and the input's `AimLatch` makes it a toggle when Aim is Toggle, so it follows Accessibility → Aim (also offered in the Touch rows, kept in step); a touch device defaults to Toggle (`TOUCH_COMBAT_DEFAULTS`), and a toggled aim now lets go on a weapon change, vehicle or death on touch too. | `client/test/touchLayout.test.ts` (saving, damaged values, Large held back by height, the root's properties, the touch Aim default); `combatPrefs.test.ts` (touch Aim follows Hold and Toggle); e2e `mobile`: the Touch rows (Toggle on a phone), Aim tap on / tap off, and `mobileTouchLayout` (Large, 50 %, left-handed at 915 × 412, 832 × 384 and 658 × 320: sides, size, opacity, the ammo panel over no button, no two buttons touching; Aim set to Hold). |
| 4 | **Character Select on a phone** (`html.touch`, at most 600 px tall or 760 px wide): the grid takes the height; the details panel is a sheet fixed along the bottom, down a strip (handle, name, Choose), up on a tap on a portrait or the handle (bio, tags, stats with bars, loadout, Choose and Customise; scrolls inside itself). Upright the grid and sheet take the width, the sheet shows the portrait, and the turning model's drag area is off (it isn't in view); sideways the portraits are smaller (two rows and more) and the drag area starts right of the grid (it covered the strip's end). **Every screen:** a search box and a ★ Favourites-only switch in the jump strip (sections and chips with no match hide; "No characters match" when none), a star on each portrait (`tiletrigger.charFavs`); on touch the strip's ends are ◀ ▶ instead of Q / E key caps. | e2e `mobileMenus`: the strip ≤ 66 px under a grid of more than a row and a half, arrows shown and caps hidden, a tap shows the character and pulls the sheet up inside the screen, the handle lets it down, a star and Favourites only list just that one, a search with no match says so and clearing it brings everyone back; the existing `mobileCharacterSelect` and the desktop character checks. |

Also fixed on the way: at 832 × 384 (S25+ sideways) the main menu's Options button sat under the news bar (now every
button clears it under 420 px tall; e2e checks each button is clear to tap at every phone size), and Quick Play's panel
is solid on a touch screen (the featured map's words showed through).

Not changed: the pause menu (Aim is already there), drag-to-place for the touch buttons (later, as the proposal said),
desktop layouts (the search, favourites and stars apart).

## Round 3: iPhone (`wip/phones-3`, 2026-11-27)

The owner's report (2026-11-27): a tester on an iPhone in Safari saw the browser bars and tabs, the touch buttons over
half her screen, and every double tap zoomed in, so she refreshed and lost her match.

Checked with Playwright at the sizes Safari leaves with its bars showing (the visible viewport, not the screen), touch
and an iPhone user agent, the notch and home bar as safe-area insets (CDP `Emulation.setSafeAreaInsetsOverride`):
iPhone 13/14 750 × 340 sideways and 390 × 664 upright, the SE 375 × 548 upright and 667 × 331 sideways, and the full
844 × 390 a Home Screen launch gets. Pictures (device scale 2, before and after) in the helper's scratchpad `phones3/`,
not kept; the e2e `iphone` flow saves its own (`iphone-*.png`).

| What | Change | Check |
|---|---|---|
| **The whole screen** | A web app manifest (`public/manifest.webmanifest`: `display: fullscreen`, `standalone` as the fallback, landscape, the navy theme, 192/512/maskable icons in `public/icons/`), linked from index.html with `theme-color`, `apple-mobile-web-app-capable`, a `black-translucent` status bar and a touch icon: Add to Home Screen opens the game full screen, the only full screen an iPhone gives. The hub serves `.webmanifest` as `application/manifest+json`. | e2e `iphone`: the manifest and every icon are served, the tags are there. |
| **Add to Home Screen line** | On an iPhone in its browser (not from the Home Screen), the menu shows "For full screen: Share → Add to Home Screen" once, calm, above the news bar; × dismisses it for good (`phone.ts`, localStorage). iPads and Android don't get it: their browsers have Fullscreen, entered on the first tap into a match as before. | e2e: shown, dismissed, still gone after a reload. |
| **Safe areas** | `viewport-fit=cover`, so the 16 `env(safe-area-inset-*)` rules apply; the menu's screens and footer keep clear of the notch and home bar; the move pad sits at least the home bar's height up. | e2e: with 47 px insets, the menu's screens start 47 px in; pad and Fire clear of the notch. |
| **Turn sideways** | The existing "Turn your phone sideways" screen in a match, checked at the iPhone sizes. | e2e: 390 × 664 and 375 × 548. |
| **No zoom** | `maximum-scale=1, user-scalable=no`; `touch-action: manipulation` on every element (`:where()`, so each element's own `none` or scrolling wins); Safari's `gesturestart`/`gesturechange`/`gestureend`, `dblclick` and two-finger moves stopped; in play a second quick tap's default too (`phone.ts`, loaded on touch devices after the menu's first JS). Text boxes and lists keep theirs. | e2e: a double tap on the menu and in play leaves the page at scale 1. |
| **"Leave this game?"** | A `beforeunload` prompt while in a match (not MapMaker's Test). Browser tests only with `&leaveprompt=1`. iPhone Safari ignores such prompts: rejoin is the answer there. | e2e: a reload in a match asks first. |
| **Small buttons by default** | Until a player picks a size, a phone (screen's short side ≤ 540 px) gets Small and a tablet Medium (`touchLayout.ts defaultTouchSize`); the size is saved only once picked. Small keeps the 12 px text floor (labels drawn at 12 / scale) and the ammo panel clears the smaller Weapons ring (`html.tc-small`). | Unit tests; e2e `mobile` and `iphone`: Small at phone sizes, text ≥ 12 px, ammo over no button. |
| **Buttons only when they matter** | Use shows with something to use in reach (the use prompt's own test: a door or button, a vehicle seat, an ammo box or Supply Buggy, a zipline, or getting out), Reload when the gun isn't full and has rounds (or is reloading), Throw with a grenade. They fade in and out over a quarter second (no flash, the same with Reduce flashing), stay while held, and linger 0.6 s so a door's edge doesn't blink them. Their places don't move. | e2e `iphone`: all three away at first; firing brings Reload, a grenade Throw, the buggy Use; away from it and out of grenades they go. |
| **Look on all the free screen** | The look area is the whole screen under the pad and buttons (was the right half). | e2e: a drag on the left half turns the view. |
| **The first match's line** | "Buttons too big or small? Options → Controls → Touch", once, under the scorebar for 7 s (only where first-time tips show). | Not pictured: first-time tips are off in browser tests. |
| **Rejoin after a refresh** | The tab remembers its live online match in sessionStorage (`liveMatch.ts`: the server's URL or the join code and party; the place itself comes back by the browser's player key, already in localStorage). A reload or a return to the site in the same tab goes straight to "Rejoining your match…" with Cancel; in, it's the same place and score (the server's or the browser host's reclaim); if the match is gone or the place was given up (away over a minute), the menu says so. A solo match or one hosted in this tab can't be rejoined: the menu says so plainly. | Unit tests; e2e: after `page.reload()` on the plain address, "Rejoining your match…", then the same slot, name and score; a solo match's reload says it can't be rejoined. |

Not changed:
- **Aim stays its own button.** Folding it into Fire (aim while Fire is held, or a double tap) would make every shot an
  aimed one or slow the first shot; it's an owner question (see HANDOFF).
- **Desktop:** nothing changes there (the manifest and tags are inert; every rule is under `html.touch` or reads 0
  insets).
- **Later:** drag-to-place buttons, a first-match touch tutorial, saved solo matches.

## Proposals, ranked (impact / size)

| # | Proposal | Impact | Size |
|---|---|---|---|
| 1 | (done) **Find the dark-block cause on the owner's phone.** Ask which Graphics setting and phone. Ship a Display option "Room lights" (on/off), or a `?roomlights=0` test switch, so the owner can see whether the block goes with the lamps. If it does: (a) pick the lamps-per-layer from the map's lamp count and the device's texture limit (1 for ≤ 64 lamps, more only where the mask must fit); or (b) on Low, drop the clustered lamps and raise the sky light indoors to compensate. Either also cuts a phone's per-pixel light work (Flatpack's 138 lamps are 18 layers). | High | S-M |
| 2 | **Map cards on phones.** The map name in Match Setup opens a full-screen picker reusing the desktop grid (pictures, mode tags, search, favourites), not a `<select>`. Also a "Pick a map" card in Quick Play. | High | M |
| 3 | (done) **Touch layout options.** Options → Controls: button size (S/M/L), opacity, left-handed swap, and Aim as hold or toggle. Later, drag-to-place. | High | M |
| 4 | (done) **Character Select as a phone layout.** A full-height grid with the details as a slide-up sheet on tap. Add search and favourites, and arrows instead of Q/E caps on touch. | High | M |
| 5 | (done) **Ammo by the fire cluster on touch** (above Reload, smaller), clearing the lower centre; the weapon name as an icon. | Med | S |
| 6 | (done) **Scores on touch:** tap the scorebar to show the scoreboard (hold or toggle). | Med | S |
| 7 | (done) **Phone Options in one column:** setting name and control on one line, the description behind an (i). Tabs as chips at the top. The panel uses the full height. | Med | S-M |
| 8 | **Textured sci-fi guns.** A material pass for the Quaternius sci-fi pack (metal and paint maps through the existing held-copy tiers), or swap the bulkiest (Flak, Swarm, Laser Rifle) for textured models. | Med | M (content) |
| 9 | (done) **Speckled floors:** Terrazzo013 finer (scale 1-1.25 m) and lower contrast, or another terrazzo; check gravel and carpet the same way. | Low-Med | S |
| 10 | (done) **Text floor on touch:** HUD and menu text at least 12 px on phones (button labels, mode label, Match Setup's chips), and the pad's "hold: crouch" readable or dropped after the tutorial. | Med | S |
| 11 | (done) **Match Setup on phones:** a sticky header (map, mode), "Not on this map" folded away, 40 px steppers. | Med | S-M |
| 12 | (done) **Kill feed lines on short phones:** at most 3, so it never reaches the Weapons button (4-5 lines can). | Low | XS |
