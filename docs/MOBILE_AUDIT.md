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
  - **Next:** proposal 1.

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

## Proposals, ranked (impact / size)

| # | Proposal | Impact | Size |
|---|---|---|---|
| 1 | **Find the dark-block cause on the owner's phone.** Ask which Graphics setting and phone. Ship a Display option "Room lights" (on/off), or a `?roomlights=0` test switch, so the owner can see whether the block goes with the lamps. If it does: (a) pick the lamps-per-layer from the map's lamp count and the device's texture limit (1 for ≤ 64 lamps, more only where the mask must fit); or (b) on Low, drop the clustered lamps and raise the sky light indoors to compensate. Either also cuts a phone's per-pixel light work (Flatpack's 138 lamps are 18 layers). | High | S-M |
| 2 | **Map cards on phones.** The map name in Match Setup opens a full-screen picker reusing the desktop grid (pictures, mode tags, search, favourites), not a `<select>`. Also a "Pick a map" card in Quick Play. | High | M |
| 3 | **Touch layout options.** Options → Controls: button size (S/M/L), opacity, left-handed swap, and Aim as hold or toggle. Later, drag-to-place. | High | M |
| 4 | **Character Select as a phone layout.** A full-height grid with the details as a slide-up sheet on tap. Add search and favourites, and arrows instead of Q/E caps on touch. | High | M |
| 5 | **Ammo by the fire cluster on touch** (above Reload, smaller), clearing the lower centre; the weapon name as an icon. | Med | S |
| 6 | **Scores on touch:** tap the scorebar to show the scoreboard (hold or toggle). | Med | S |
| 7 | **Phone Options in one column:** setting name and control on one line, the description behind an (i). Tabs as chips at the top. The panel uses the full height. | Med | S-M |
| 8 | **Textured sci-fi guns.** A material pass for the Quaternius sci-fi pack (metal and paint maps through the existing held-copy tiers), or swap the bulkiest (Flak, Swarm, Laser Rifle) for textured models. | Med | M (content) |
| 9 | **Speckled floors:** Terrazzo013 finer (scale 1-1.25 m) and lower contrast, or another terrazzo; check gravel and carpet the same way. | Low-Med | S |
| 10 | **Text floor on touch:** HUD and menu text at least 12 px on phones (button labels, mode label, Match Setup's chips), and the pad's "hold: crouch" readable or dropped after the tutorial. | Med | S |
| 11 | **Match Setup on phones:** a sticky header (map, mode), "Not on this map" folded away, 40 px steppers. | Med | S-M |
| 12 | **Kill feed lines on short phones:** at most 3, so it never reaches the Weapons button (4-5 lines can). | Low | XS |
