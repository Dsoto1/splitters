# Changelog

Tile Trigger uses [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
Until the public launch (1.0.0), a minor bump marks a release with new features
and a patch bump a fix-only release. The version shows on the main menu
(`packages/client/package.json`). Each release is a git tag `vX.Y.Z` on `main`,
made only on a commit that passed CI on a check branch.

## 0.2.0 (2026-10-27)

**Gunplay**
- Arcade feel pass on the seven benchmark weapons (pistol, heavy revolver, SMG, rifle, shotgun, precision rifle, rockets); shotgun pellet fix; lighter movement spread; bullets slowed by water.
- The Training Range is now the gunplay test arena.

**Big matches (up to 48v48)**
- The match runs in a Web Worker; bot AI is cheaper in clumps.
- Characters draw as 2 meshes; destructibles, pickups, props and foliage are batched; far characters animate at a lower rate and cast no shadows in crowds.
- Snapshot catch-up merging and non-blocking texture reads cut warm-up stalls.

**Look and feel**
- Smoother running and strafing (planted feet, blended gaits), smooth remote movement, even frame pacing.
- Glass that reflects, cracks and shatters (breakable and bulletproof); new water with waves, shoreline foam and splashes.
- Menu rifle grip and first-load flicker fixes.

**Content**
- Match setup screen: 2–8 teams of any size, saved setups, Host button.
- Map pictures and plans for every map; Set thumbnail in MapMaker.
- MapMaker palette: colour-coded tabs, picture atlases, search, favourites.
- Wild West, dungeon and fence packs; fence and wall borders; Mercy Ward and Dustwater redressed.
- New characters: Goblin, Wealthy Otter, Boglurker, Salamander Warlord, Hyena Warrior, Elder Tomo, The Visitor, Biscuit, Flt. Lt. Ember, Cap'n Barnacle, Big Bogdan.
- New models: Ironclad revolver, Spin Gun, arc-cannon turret; oak, birch, fir, banana plant, shrub, fern, eelgrass, rock spires, rock pile, control cabinet, burnt-out car, dinosaur statue.
- Map review: 10 maps removed, 9 retired.

**Online**
- Multiplayer direction, review, security and protocol docs; CloudFormation template and CloudShell deploy script for the Lightsail hub and relay.

## 0.1.0

Everything before versioning started.
