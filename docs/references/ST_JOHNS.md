# St. John's: reference notes

The map `maps/st_johns.json` (built by
`packages/server/src/tools/maps/st_johns.ts`) is a look-alike of the
St. John's Northwestern Military Academy campus (St. John's Military Academy
until 1995, later St. John's Northwestern Academies, "SJN" since 2026) at
1101 N. Genesee Street (County Highway C), Delafield, Waukesha County,
Wisconsin, just north of downtown Delafield and across Genesee Street from
Lake Nagawicka. The historic campus is on the National Register as
"St. John's Military Academy" (NRHP 77000059, 1977; State Register 1989).

No photos are stored in the repository: everything below is a link.

## How this was researched

- Web searches (October 2026). Direct page fetches, the Overpass API and the
  OpenStreetMap API were all refused by the build session's network policy,
  so **OSM footprints could not be downloaded**. The layout stays on the
  school's own campus map (source 31, traced at 0.2 m per pixel, north up),
  which the earlier build already used; it agrees with every position the
  inventory records give (Smythe on the west side of Farrand Lane between
  St. John's Road and Church Street; the Argonne Gate on Exeter Street
  between the Knight (classroom) block and Welles Hall; the church marker on
  Exeter Street just west of Genesee Street; the lake across Genesee).
- Next time the network allows it, query Overpass for
  `way["building"](43.056,-88.410,43.068,-88.392)` and swap the traced
  rectangles for real footprints.

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

## Campus layout (map metres: x east, z north; flagpole at -58, -5)

- The drill (parade) field lies west of the halls, between Spanjer Street and
  the flagpole; the halls make a U round it: Hazelwood / Scott Johnston on
  the south, Memorial and the Knight (Stangeland Cord) block and the
  Welles-DeKoven range on the east, the chapel and Smythe on the north.
- Genesee Street (Cty C) runs north-south on the east edge; Lake Nagawicka
  is across it to the east. Church Street runs east from the halls to
  Genesee past Farrand Gymnasium; Exeter Street is the south edge;
  Wisconsin Avenue the north edge with private houses; St. John's Road
  crosses north of the chapel; Farrand Lane runs north-south past Smythe.
- Ground: the drill field and halls are level; the land falls gently east
  across Genesee to the lakeshore. Mature deciduous trees line the streets
  and lawns; lots by Exeter Street and along Farrand Lane.

## Buildings

| Building | Date / architect | Footprint (map, m) | Storeys | Roof, towers | Materials, colour | Windows, entrances | Where |
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

- True OSM footprints (see above); the halls are traced rectangles.
- Real pointed-arch heads and tracery: doorways are square cuts with dressed
  surrounds; gothic arches use the ruins kit's arch prop as a frame.
- Stained glass: coloured glow panels set into the stone, not see-through glass.
- Conical caps and gables are stepped blocks, not smooth slopes.
- The campus is level; the real fall toward the lake is only modelled east
  of Genesee Street.
