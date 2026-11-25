# St. Jasper's Military Academy: real → fictional names

The map `maps/st_johns.json` began as a look-alike of a real campus (docs/references/ST_JOHNS.md). The owner had it
made fictional (2026-11-24): first the school's own name, then every hall, street and gate the game shows. The map's
id and file stay `st_johns`. The notes, plans and step lists in this folder, HANDOFF and CHANGELOG history keep the
real names they were written with; this table turns them into the names the game uses now.

| Real name (in older notes) | Fictional name (in the game) | What it is |
|---|---|---|
| St. John's (Northwestern) Military Academy | St. Jasper's Military Academy | the school (renamed 2026-11-24, `wip/stjohns-12`) |
| St. John's Road | St. Jasper's Road | the street on the north edge |
| Hazelwood Hall | Ravelstone Hall | barracks, west of the drill field (the west team's side) |
| Scott Johnston Hall | Harlan Pryce Hall | barracks beside it |
| Exeter Street | Tamarack Street | the street along the south side |
| Knight Hall (the Knight block) | Brennock Hall (the Brennock block) | the classrooms |
| Argonne Gate | Coldbrook Gate | the gatehouse and its passage (the Carriageway, `setpiece.carriageway_1`) |
| Welles Hall | Wexcombe Hall | the refectory (mess hall) and dorm hall under the clock tower |
| DeKoven Hall | DeVarne Hall | the four-storey offices and dorms (sniper rifle on its roof) |
| Memorial Hall | Lantern Hall | the library across the quad |
| Victory Memorial Chapel | Sentinel Chapel | the chapel (rockets) |
| Smythe Hall | Aldergrove Hall | the hall by the road (railgun upstairs) |
| Farrand gym | Marchbank gym | the sports hall (the east team's side) |
| Gerber pool | Tolland pool | the pool (damage boost) |
| the old red church (St. John Chrysostom) | the old parish church | the church on the knoll and its churchyard |

The new names are made up for the map: none is a hall of the real school, and none is named after a real person.
They are also kept apart from the bot and character names (`packages/shared/src/content/botNames.ts`).

Names that appear only in older notes and never in the game (no change needed): Stangeland / Cord (the classroom
block of step 5), Mouso Hall, Kemper Road, Genesee Street, Lake Nagawicka, the Bark River, Delafield.

Kept as they are: the layout and ground credits in the map's description (map data © OpenStreetMap contributors,
ODbL; USGS 3D Elevation Program, public domain).

Where the names show: only in the map's description (MapMaker → Map properties → Description; Match Setup's map
card). No sign, set piece, prop or label on the map carries a name or lettering (the crest, plaques and honours boards
are our own designs with no words).
