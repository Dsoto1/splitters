# St. John's: reference notes

The map `maps/st_johns.json` is a look-alike of the
St. John's Northwestern Military Academy campus (St. John's Military Academy
until 1995, later St. John's Northwestern Academies, "SJN" since 2026) at
1101 N. Genesee Street (County Highway C), Delafield, Waukesha County,
Wisconsin, just north of downtown Delafield and across Genesee Street from
Lake Nagawicka. The historic campus is on the National Register as
"St. John's Military Academy" (NRHP 77000059, 1977; State Register 1989).
It is an ordinary MapMaker map: edit it there (Open → St. John's), not with a
script (the first pass was built by a script that no longer exists).

No photos are stored in the repository: everything below is a link.

## Real layout and ground (2026-10-30)

The halls, streets and ground follow the real place, from two public sources
(credited in the map's description and in docs/ASSET_SOURCES.md):

- **OpenStreetMap** (map data © OpenStreetMap contributors, ODbL): the API's
  `map` call for small boxes round the campus (Overpass was not reachable).
  The school's polygon (way 489206015, "St. John's Northwestern Military
  Academy") covers the whole 110-acre grounds; the halls are mapped as a few
  merged outlines (way 974696764 is Knight, the Argonne Gate, Welles and
  DeKoven in one), not by name. Also used: the drill field's two L-shaped
  outlines (ways 1312099828/9, tagged as flagpole rows), St. John Chrysostom
  (way 974677582, 1111 Genesee St), the sports hall and pool (974677581), the
  cemetery, the post office, Mouso Hall's L (990215783), the tennis courts and
  every street and walk in the box.
- **USGS 3DEP** (public domain): a 1 m lidar elevation grid from the National
  Map's elevation service (`3DEPElevation/ImageServer/exportImage`, checked
  against point queries to the centimetre). The campus sits on a terrace at
  277-281 m; St. John Chrysostom stands on a knoll at its south-east corner,
  and a bluff falls about 8 m to the Bark River flats (270-272 m) south of
  Exeter Street and east of the church.

**Region.** The real campus is far bigger than a match wants (the school's
grounds run 800 m across, the lake is 450 m east of the drill field), so the
map is the 400 × 300 m round the drill field and the halls, at true scale:
from Kemper Road on the west to the churchyard and the Farrand gym on the
east (Genesee Street and the lake are just past the east edge), from the
houses on St. John's Road on the north to the tennis courts and Mouso Hall
south of Exeter Street. Map frame: map x = metres east of the school
polygon's centroid (43.065474 N, 88.408018 W) − 106, map z = metres north of
it + 125; the terrain is 161 × 121 heights at 2.5 m (MAP_BUDGETS: fine for
open ground); y 0 is 279.0 m above sea level.

**How it was made, in MapMaker.** No map script: MapMaker's owner tools,
Environment → Terrain → Real places (BUILDING_KIT.md, Terrain), and its own
edit commands.
1. A 1 m height grid of the region in map metres (ESRI ASCII, 401 × 301
   heights) went in through **Heights from a height grid file** with ground
   level 279; an OSM render of the same box went over it as the **Trace
   image**.
2. Each hall's pieces moved as a whole onto its OSM footprint: centred on
   it, turned to its angle (0-2.4°), stretched along each side to its length
   with the end 6 m (towers, end walls) kept as they were, and never squeezed
   below 0.9 (narrower than the real footprint the halls stay a little wider:
   doorways and stairwells close up otherwise and bots can't climb). Walls
   stretched past 64 m became two blocks. Each hall stands at the median
   ground height of its footprint, on ground levelled under it (1.5 m round,
   blended over 6 m).
3. The rest of the old map's pieces (trees, benches, lamps, spawns, pickups,
   vehicles) followed the halls they stood near; the churchyard's
   headstones and railings went to the real cemetery; the old streets,
   lakefront boathouse and pier and eleven of the sixteen houses went; five
   houses stand on real houses on St. John's Road.
4. The streets and walks are MapMaker paths from the OSM lines (asphalt
   streets with lines, concrete campus drives, flagstone walks; laid into the
   ground), with trees along the streets.
5. "Settle all props on ground", then the map was saved as MapMaker saves
   it. MapMaker, the navigation check and the validator report nothing.
6. (2026-10-31) The ground was a little jagged: step 1 point-sampled the
   1 m grid to 2.5 m, which aliases lidar's small bumps. Terrain → **Smooth
   all**, Medium (2.5 m), with "Keep the ground under blocks" on (the halls'
   levelled pads stay exactly as they were), then "Settle all props on
   ground". The import itself now averages when it thins and has a
   Smoothing amount, so a fresh import is smooth too (BUILDING_KIT.md,
   Terrain).

The throwaway scripts that fetched, converted and computed this lived
outside the repository; the map is edited from here on in MapMaker like any
other.

**What's where now** (map metres, x east, z north): drill field (-156, -2)
and its flagpole (-128, -2) (west team: spawns, flag); Hazelwood and Scott Johnston
(-108, -78) along Exeter Street (z ≈ -97); Knight block (-24, -80); Argonne
Gate (9, -78); Welles (47, -81) and its clock tower; DeKoven (47, -45);
Memorial Hall (-47, -52); Victory Memorial Chapel (-9, 56) on St. John's
Road (z ≈ 87); Smythe (45, 22); Farrand gym and pool (154, 32) (east team);
St. John Chrysostom (113, -59) and its churchyard (148, -48); rectory
(184, -80) and post office (148, -130) down on the flats; Mouso Hall
(-83, -130); the Nave Gateway over Church Street at the east edge (196, -16).

## Sources

| # | URL | What it shows / says |
|---|---|---|
| 1 | https://en.wikipedia.org/wiki/St._John's_Northwestern_Military_Academy | History; buildings "with towers and battlements in a style that suggests a medieval castle, most arranged in a U around the drill field"; DeKoven (1906, four storeys, corner towers), Welles (1906, dining hall and barracks, large square clock tower), Hazelwood (1927, two storeys), Smythe (1929), Scott Johnston (1930, corner turret), Memorial Hall (1893, Shingle style, "two caps"), Victory Memorial Chapel (1921-26, lannonstone, after the West Point chapel); infobox photo |
| 2 | https://en.wikipedia.org/wiki/Thomas_Van_Alyea | Architect of most halls |
| 3 | https://en.wikipedia.org/wiki/St._John_Chrysostom_Church_(Delafield,_Wisconsin) | The 1851-53 Carpenter Gothic church in the district, with photo |
| 4 | https://commons.wikimedia.org/wiki/Category:St._John's_Northwestern_Military_Academy | Commons photo category (Smythe Hall file among others) |
| 5 | https://www.wikidata.org/wiki/Q4412537 | Identifiers, NRHP 77000059, coordinates |
| 6 | https://npgallery.nps.gov/NRHP/GetAsset/NRHP/77000059_text | NRHP nomination: "massive Neo-English Gothic buildings with towers and castellated battlements"; "a flagpole in the drill field is the visual focus of the school ... most of the major sites form a U around it" |
| 7 | https://npgallery.nps.gov/NRHP/GetAsset/NRHP/77000059_photos | Nomination photographs (incl. Victory Memorial Chapel) |
| 8 | https://npgallery.nps.gov/AssetDetail/NRIS/77000059 | NPS asset page for the district |
| 9 | https://www.wisconsinhistory.org/Records/NationalRegister/NR697 | State listing: church (1851), cemetery, rectory (1857), Memorial Hall (1893), chapel (1921) and halls; architects Moller and Van Alyea |
| 10 | https://www.wisconsinhistory.org/Records/Property/HI7820 | DeKoven Hall: 1906, limestone, Late Gothic Revival, octagonal corner towers, crenellated cornice, wide pointed-arch doorways, rebuilt 1940 to Van Alyea's plans |
| 11 | https://www.wisconsinhistory.org/Records/Property/HI7819 | Smythe Hall: 1929, Late Gothic Revival, Farrand Lane west side between St. John's Rd and Church St |
| 12 | https://www.wisconsinhistory.org/record/property/HI7942/genessee-st | Cyril W. Nave Gateway (1968): two rectangular lannonstone towers carrying a metal arch with the school's name and arms over the main entrance on Genesee St |
| 13 | https://wisconsinhistory.org/record/property/HI7929/exeter-st | Argonne Gate (1940): castellated lannonstone Gothic gate on Exeter St between Knight and Welles Halls |
| 14 | https://legacy.wisconsinhistory.org/Records/Property/HI7943 | Lannonstone classroom building the size of Knight Hall with a large rectangular entrance tower at one corner |
| 15 | https://wisconsinhistory.org/Records/Property/HI7946 | Scott Johnston Hall (Exeter St, 1930, Late Gothic Revival, stone, Van Alyea) |
| 16 | https://legacy.wisconsinhistory.org/Records/Property/HI7949 | Classroom building of 1902 (Knight Hall), three storeys of Delafield fieldstone, builder William Jacobson, windows remodelled 1966 |
| 17 | https://www.wisconsinhistory.org/Records/Property/HI7947 | Hazelwood Hall (1927 dormitory, Van Alyea) |
| 18 | https://www.wisconsinhistory.org/Records/Property/HI7816 | Welles Hall (1906, additions c. 1940, "Thomas Alyea") |
| 19 | https://wisconsinhistory.org/Records/Property/HI7826 | St. John Chrysostom: board and batten, early Gothic Revival, detached original board-and-batten bell tower with a small gable over the open belfry |
| 20 | https://wisconsinhistory.org/Records/Property/HI7817 | Companion record in the church/academy group |
| 21 | https://www.wisconsinhistory.org/Records/Image/IM111790 | Postcard, "Wells-DeKoven Hall" (1950): the two halls as one long range |
| 22 | https://www.wisconsinhistory.org/Records/Image/IM111801 | Postcard of the chapel, c. 1910 |
| 23 | https://www.wisconsinhistory.org/record/image/W013R2K | Photo, academy entrance on Genesee St |
| 24 | https://www.wisconsinhistory.org/Records/Image/IM144841 | Edward Beyler photo of the clock tower (before 1960) |
| 25 | https://wisconsinhistory.org/Records/Image/IM30347 | Postcard c. 1905: buildings, trees, drives |
| 26 | https://wisconsinhistory.org/Records/Image/IM111777 | Coloured postcard c. 1910 (Munger, Oconomowoc): a hall and grounds |
| 27 | https://wisconsinhistory.org/Records/Image/IM118348 | 1939 photo, Governor Heil greeting cadets on the grounds |
| 28 | https://www.wisconsinhistory.org/Records/Article/CS13273 | Essay: English Gothic halls "with serrated roofs, towers and battlements of stone" |
| 29 | https://www.hmdb.org/m.asp?m=254391 | Church marker: Exeter St, west of N. Genesee St; founding families buried in the churchyard |
| 30 | https://www.hmdb.org/m.asp?m=31473 | St. John's Military Academy state marker |
| 31 | https://stjohnsnorthwestern.org/wp-content/uploads/2021/08/SJNA-Campus-Map_parking-4.pdf | **Campus map** (layout source): Genesee St, Church St, Exeter St, Wisconsin Ave, St. John's Rd, Farrand Ln; every hall, chapel, church and cemetery, lots, visitor parking by the main gate |
| 32 | https://sjnacademies.org/rental-facilities/ | Smythe (2 floors, 84 beds), DeKoven (2 housing floors, 142), Scott Johnston (3 floors, 152); Farrand Gymnasium 500+, dining hall 200, chapel 350 |
| 33 | https://stjohnsnorthwestern.org/noble-victory-chapel/ | The chapel page |
| 34 | https://sjnacademies.org/student-life/campus-life | Welles Dining Hall "an English Gothic style refectory"; Mouso Hall Student Center (study area, games) |
| 35 | https://sjnacademies.org/residence-hall-campaign/ | 2019 refurbishment of DeKoven, Smythe and Scott Johnston halls |
| 36 | https://sjnacademies.org/wp-content/uploads/2021/06/School-Profile.pdf | 110-acre campus: chapel, gym, pool, fields, nine-hole golf course |
| 37 | https://sjnacademies.org/summer/ | Summer camp "on our private island" in Lake Nagawicka |
| 38 | https://www.zola.com/wedding-vendors/wedding-venues/st-john-s-northwestern-academy | Chapel: vaulted ceiling, "towering double turrets", stained glass on every wall, balcony overflow |
| 39 | https://www.herecomestheguide.com/wedding-venues/wisconsin/st-johns-northwestern-academies | Chapel photos and description |
| 40 | https://twigandolive.com/fall-wedding-ceremony-at-noble-victory-memorial-chapel-delafield-wi/ | Interior photos: stained glass light over the pews |
| 41 | https://www.ebay.com/itm/276697062096 | 1910 postcard of the gymnasium (Memorial Hall era) |
| 42 | https://livinghistoryregistry.com/item.php?pasco=7576 | Bronze 6-pounder M1841 field gun on static display at the school |
| 43 | https://www.travelwisconsin.com/outdoors/on-the-water/clear-water-outdoor-delafield | St. Johns Park on Nagawicka Lake, across Genesee St |
| 44 | https://cityofdelafieldwi.gov/DocumentCenter/View/1958/Planning-Area---Lakes-and-Rivers | Lake/river planning map: St. Johns Park, the dam and Genesee St bridge |
| 45 | https://www.militaryschools.com/directory/st-johns-northwestern-academy | "Lakefront on Nagawicka Lake", sailing |
| 46 | https://www.gmtoday.com/oconomowoc_enterprise/news/lookback-in-history/article_527865b4-2058-5789-abcc-06e99abc313b.html | 1919 temporary dormitory (125 x 50 ft) on the Scott Johnston site |
| 47 | https://sah-archipedia.org/node/21853 | SAH Archipedia: St. John Chrysostom, pierced bargeboard tracery, Upjohn pattern |
| 48 | https://homepages.bluffton.edu/~SULLIVANM/wisconsin/delafield/upjohn/upjohn.html | Photo set of the church and churchyard |
| 49 | https://www.npr.org/transcripts/758415691 | "a small, red church ... of wood" |
| 50 | https://usheritage.com/project/st-johns-military-academy-johnson-hall/ | Masonry restoration photos (grey stone, dressed trim) |
| 51 | https://sjnacademies.org/news/st-johns-northwestern-military-academy-to-pay-tribute-to-nations-veterans/ | Veterans ceremony on the parade field, 21-gun salute |

## Campus layout

- The drill (parade) field lies west of the halls with the flagpole on its
  east side; the halls make a U round the lawns east of it: Hazelwood /
  Scott Johnston, the Knight block, the Argonne Gate and Welles along Exeter
  Street on the south, DeKoven's long wing north from Welles on the east,
  Memorial Hall in the middle, the chapel and Smythe on the north.
- Genesee Street (Cty C) runs north-south just past the east edge; Lake
  Nagawicka is beyond it. Church Street runs east past the Farrand gym;
  Exeter Street is the south edge of the halls; St. John's Road the north,
  with private houses past it; Smyth Lane runs north-south between the drill
  field and the halls, Farrand Street past Smythe.
- Ground (3DEP): the drill field and halls sit on a level terrace; the church
  stands on a knoll and the ground falls about 8 m to the Bark River flats in
  the south-east. Trees line the streets.

## Buildings

Footprints in this table are the first pass's (traced from the school's
campus map at about 0.6 of real size); the halls now stand on their OSM
footprints (above).

| Building | Date / architect | Footprint (first pass, m) | Storeys | Roof, towers | Materials, colour | Windows, entrances | Where |
|---|---|---|---|---|---|---|---|
| DeKoven Hall | 1906, rebuilt 1940, Van Alyea | 17 x 39 | 4 (2 used as barracks) | flat behind crenellated parapet; octagonal towers at the four corners | grey lannonstone (dolomite), dressed limestone trim | paired rectangular sash windows; wide pointed-arch doorways | east side of the U, joined to Welles at its south end |
| Welles Hall | 1906, c. 1940, Van Alyea | 24 x 17 | 2-3 | battlements; large square clock tower | lannonstone | tall refectory windows; doors to the drill field and the Argonne Gate | south end of DeKoven, on Exeter St |
| Knight Hall / Stangeland Cord (academic) | 1902 (Jacobson), later wing | 31 x 17 | 3 | flat, battlements; rectangular entrance tower at a corner | Delafield fieldstone | 1966 replacement windows | Exeter St, west of the Argonne Gate |
| Argonne Gate | 1940 | 5 m passage | - | castellated gatehouse | lannonstone | Tudor arch | between Knight and Welles on Exeter St |
| Hazelwood Hall | 1927, Van Alyea | 24 x 17 | 2 | battlements | lannonstone | regular sash windows | south side of the drill field |
| Scott Johnston Hall | 1930, Van Alyea | 19 x 17 | 3 | battlements; corner turret | lannonstone | - | east end of Hazelwood |
| Memorial Hall | 1893, John A. Moller | 16 x 20 | 1 tall + roof | Shingle style, two capped (conical) towers | wood shingle on a stone base | - | between the chapel and Knight Hall |
| Victory Memorial Chapel | 1921-26, Van Alyea | 30 x 18 | nave about 9 m | steep roof; west tower and twin turrets; vaulted inside | lannonstone | stained glass on every wall; balcony; 350 seats | north of the flagpole, on St. John's Rd |
| Smythe Hall | 1929, Van Alyea | L, 23 x 11 + 16 x 30 | 2 | battlements; corner turret | lannonstone | - | west side of Farrand Ln between St. John's Rd and Church St |
| Farrand Gymnasium and pool | - | 53 x 24 | 1 tall | flat, parapet | brick and stone | high windows | south of Church St, east of Farrand Ln |
| Mouso Hall Student Center | - | L, 20 x 10 + 7 x 13 | 1 | battlements | stone | - | south of Exeter St |
| St. John Chrysostom Church | 1851-53, Upjohn pattern (Cox) | 37 x 16 | 1 | steep gable, pierced bargeboards; detached bell tower with a small gable over the open belfry | red-painted board and batten | lancet windows | east of DeKoven, north of Exeter St, west of Genesee St |
| Old cemetery | 1840s on | - | - | - | headstones, iron railings | - | round the church |
| Cyril W. Nave Gateway | 1968 | - | - | two rectangular stone towers, metal arch with name and arms | lannonstone, black iron | - | main entrance off Genesee St |
| Flagpole and field gun | - | - | - | flagpole on the drill field; bronze 6-pounder M1841 | - | - | heart of the U |

## What the map can't show

- The halls' insides are the first pass's rooms, stretched to the real
  footprints (wider rooms and windows than the real ones); where OSM's
  outline is narrower than a hall, the hall is a little wider than it.
- OSM has the halls as merged outlines, so where one hall ends and the next
  begins inside them is the first pass's guess.
- Lake Nagawicka, Genesee Street and St. Johns Park are past the map's east
  edge; only one of the tennis courts is built.
- Real pointed-arch heads and tracery: doorways are square cuts with dressed
  surrounds; gothic arches use the ruins kit's arch prop as a frame.
- Stained glass: coloured glow panels set into the stone, not see-through glass.
- Conical caps and gables are stepped blocks, not smooth slopes.
- The ground is 3DEP's at 2.5 m, smoothed over about 2.5 m: kerbs, steps and anything smaller are gone.
