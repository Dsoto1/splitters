/**
 * Bot names by theme (owner, 2026-11-01: "name and associate the bots after each character"). Every built-in look
 * names the kind of creature it is (`nameTheme`: on the presets in looks.ts, in content/characters/*.json for the
 * whole-body characters, NPC_SKIN_THEMES below for the NPC skins); a Player Bot wearing it takes the look's own
 * name first ("Scamp"), then the next free name of its theme's list ("Coco Bean"), unique within the match. The
 * general list BOT_NAMES is the fallback: designs of yours, looks whose theme has run out.
 *
 * A map can keep its random bots to some groups or themes (MapDocument.botCast, "soldiers only" for a D-Day map),
 * and the host can change it (MatchRules.botCast): bots then wear only those looks, so a new soldier skin joins
 * every soldiers-only map by declaring its group and theme.
 *
 * Every list: at least BOT_THEME_MIN names (a full match of one look never runs out), unique, at most 20
 * characters (BOT_NAME_MAX), no digits, original (no real people, no famous fictional characters). Append only:
 * players get to know the first names.
 */
import { CHARACTER_GROUPS, CORE_LOOKS, RETIRED_LOOKS, type CharacterGroup, type CharacterLook } from './looks.ts';

/** Fewest names in a theme's list: a full match (MAX_PLAYER_SLOTS) of one look never repeats one. */
export const BOT_THEME_MIN = 96;

const list = (s: string): readonly string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Random bots' general names, in the order bots take them: at least 96, so a full match never repeats one (the owner). */
export const BOT_NAMES: readonly string[] = [
  'Brassneck', 'Mildred', 'Captain Pell', 'Wick', 'Doctor Umber', 'Spoke', 'Gloam', 'Tibbs', 'Ferro', 'Lady Ash',
  'Nub', 'Quill', 'Rustbucket', 'Old Saltpeter', 'Pigeon', 'Hollis Crane', 'Madame Thistle', 'Biscotti',
  'Sergeant Gravy', 'Lumen', 'Ratchet', 'Nana Voss', 'Dregs', 'Crumpet', 'Sister Vex', 'Lanternjaw', 'Fennimore',
  'Dazzle', 'Moss', 'Brigadier Fudge', 'Kettle', 'Ivy Strand', 'Gristle', 'Professor Snoot', 'Tumble', 'Ozzie Pike',
  'Cinderbell', 'Wally Hex', 'Pickles', 'Dame Rook', 'Scuttle', 'Barnaby Wren', 'Flint', 'Auntie Sprocket', 'Grub',
  'Major Mulch', 'Velvet', 'Dot', 'Corporal Puddle', 'Splinter', 'Hob', 'Miss Fortescue', 'Sprat', 'Gideon Lark',
  'Mudlark', 'Bellows', 'Countess Cog', 'Zip', 'Tinder', 'Old Hob', 'Wren Kettering', 'Bolt', 'Lady Pincushion',
  'Rumble', 'Juniper', 'Scrap', 'Colonel Custard', 'Fizz', 'Smudge', 'Bramble', 'Inspector Gloat', 'Patch',
  'Marigold', 'Clank', 'Uncle Dredge', 'Pip', 'Tallow', 'Sir Wobble', 'Gravel', 'Mabel Stone', 'Stitch', 'Quirk',
  'Admiral Dunk', 'Sootfoot', 'Hazel Grim', 'Plunk', 'Brisket', 'Captain Mops', 'Ember Wick', 'Dingo', 'Prudence',
  'Rook', 'Nettle', 'Duchess Rust', 'Boomer', 'Sable', 'Ogden', 'Cricket', 'Glimmer', 'Barnacle Bill', 'Pudding',
  'Vesper', 'Hatchet', 'Tuppence', 'Grimsby', 'Slate', 'Mister Mottle', 'Fable',
];

/** Soldier ranks, as written before a surname. */
export const SOLDIER_RANKS = ['Pvt.', 'Pfc.', 'Cpl.', 'Sgt.', 'SSgt.', 'Lt.', 'Capt.', 'Maj.', 'Col.'] as const;
/** The order soldier names take ranks: mostly the ranks that fight, now and then an officer. */
const RANK_ORDER: readonly (typeof SOLDIER_RANKS)[number][] = ['Pvt.', 'Cpl.', 'Pfc.', 'Sgt.', 'Pvt.', 'Lt.', 'Pfc.', 'Cpl.', 'SSgt.', 'Pvt.', 'Capt.', 'Sgt.', 'Pfc.', 'Maj.', 'Cpl.', 'Pvt.', 'Sgt.', 'Col.'];
/** Soldiers' surnames (at most 14 letters, so the longest rank still fits 20). */
export const SOLDIER_SURNAMES = list(`
  Haskett, Mulroy, Pickering, Dunmore, Okafor, Brackley, Tolliver, Vasquez, Kowalczyk, Ferrante, Lindqvist, Nakamura,
  Abernathy, Quarles, Delacroix, Ostrowski, Mbeki, Halloran, Petrakis, Sandoval, Whitlock, Castellano, Brannigan,
  Achterberg, Rooney, Gallardo, Hendricks, Ishikawa, Jablonski, Kilbride, Larkspur, Moncrieff, Nwosu, Oyelaran,
  Pemberton, Quintero, Rasmussen, Szabo, Thackeray, Underhill, Valdivia, Wexley, Yardley, Zielinski, Ambrose,
  Birchall, Cartwright, Dorsey, Ellwood, Fairweather, Grummond, Ingersoll, Jarvie, Kettering, Lomax,
  Mackintyre, Nettleton, Ormsby, Pruett, Ravenhill, Stroud, Tremaine, Upshaw, Varga, Winterbourne, Yancey, Ashdown,
  Bellamy, Coker, Drummond, Eckhart, Fortunato, Gimble, Hargreave, Iwasaki, Jessup, Kincaid, Lowther, Merriweather,
  Nobbs, Ogilvie, Puckett, Shoemaker, Umberton, Vickery, Wainwright, Abiodun, Bolanos, Crabtree,
  Dabrowski, Enright, Flanagan, Gutierrez, Holcombe, Ivanovic, Jorgensen, Kavanagh, Mendoza, Nash,
  Pinkney, Spalding, Trujillo, Vandermeer, Wozniak, Zamora, Bixby, Cobbett, Dimmock,
  Fenwick, Gaskell, Knapp, Ludlow, Mayhew, Nutley, Prendergast, Ruddock, Stubbs, Tatum, Whitcombe,
`);

/** Soldier names in the order bots take them: a rank and a surname, every surname once before any comes back. */
function soldierNames(): readonly string[] {
  const out = new Set<string>();
  const n = SOLDIER_SURNAMES.length;
  // Each pass gives every surname a rank further along the order, so a surname's second time has another rank.
  for (let pass = 0; pass < 4; pass++) for (let i = 0; i < n; i++) out.add(`${RANK_ORDER[(i + pass * 5) % RANK_ORDER.length]} ${SOLDIER_SURNAMES[i]}`);
  return [...out];
}

export interface NameTheme {
  id: string;
  /** Plural, for menus ("Monkeys & Apes"). */
  label: string;
  names: readonly string[];
}

/**
 * Every name theme, by kind of creature. IDs never change (maps and server rules name them); never the same as a
 * CHARACTER_GROUPS id (a bot-characters setting names either).
 */
export const NAME_THEMES: readonly NameTheme[] = [
  { id: 'soldier', label: 'Soldiers (ranks)', names: soldierNames() },
  {
    id: 'monkey',
    label: 'Monkeys & Apes',
    names: list(`
      Coco Bean, Chitter, Mango, Banjo, Nutmeg, Tamarind, Kumquat, Buttons, Fig, Cheeky, Rascal, Squeaks, Bongo,
      Jibber, Jabber, Twiggs, Mischief, Pockets, Noodle, Ruckus, Hootie, Dangle, Lychee, Papaya, Gumdrop, Tumbles,
      Peanut, Cashew, Bounce, Rumpus, Kiki, Loopy, Grabby, Skitter, Dodger, Monty Vine, Tango, Mojo, Chuckles,
      Sir Swings, Captain Fuzz, Grins, Fritter, Doodle, Jinx, Topsy, Wobbles, Treetop, Canopy, Liana, Kapok, Ziggy,
      Pepper, Taffy, Waffles, Nibs, Plantain, Guava, Biscuit Thief, Hollerbelly, Swingtail, Knucklebump,       Pinky, Muddle, Scribble, Rufus Branch, Tiko, Baba Lou, Gogo, Hoopla, Juju, Kukui, Limbo,       Ooki, Puddy, Quibble, Rattan, Slinky, Tinsel, Umbo, Vinnie Vine, Wiggles, Yoyo, Zuzu, Clatter, Fidget,
      Hullabaloo, Nana Peel, Old Silverback, Pip Swinger, Rowdy, Snaffle, Tuft, Uncle Knuckles, Whoopsie, Bramble Tail,
      Coconut, Monsoon, Dewdrop, Kumbo,
    `),
  },
  {
    id: 'bear',
    label: 'Bears',
    names: list(`
      Bumble, Honeypot, Bruno Bramble, Grizwald, Fuzzbert, Cubby, Huckle, Barley, Maple, Clover, Snuffles, Bramblebear,
      Big Bertie, Mossback, Dozer, Ursula Plum, Hibernia, Pawsworth, Nugget, Marmalade, Cinnamon, Butterscotch,
      Kodi, Grumbles, Thimble, Woolly, Toffee, Burlap, Snickerdoodle, Ginger Snap, Tumbleweed, Sir Snores,
      Lady Honeycomb, Mumbles, Crumbs, Pancake, Waffle Paws, Nutkin, Hazel Paw, Dumpling, Muffin, Barnacle Bear,
      Porridge, Oatcake, Fluffernut, Snowcap, Pinecone, Sleepy Jo, Bouldy, Rumbleguts, Scruff, Teaspoon, Haggis,
      Hunnybun, Grumpus, Sir Fluff, Old Gruffy, Buttons Bear, Cuddles, Patchwork, Bobbin, Mittens, Furgus, Bjorn,
      Blackberry, Saskia, Kumo, Taiga, Tundra, Yukon, Cobble, Driftwood, Fudge Ripple, Gingham, Hamish, Iggy Bear,
      Jellyroll, Klondike, Lumberjack, Mocha, Nimbus, Oswald Paws, Pudgy, Quilt, Russet, Sundae, Truffle, Umber,
      Velvet Paw, Whisker Biscuit, Yawn, Zephyr Bear, Bramwell, Custard Cub, Doughnut, Elmwood, Fernley,
      Honeydew, Gruffle, Pawpaw Bear, Snoozles, Bramblepatch, Berrybelly, Hushabye,
    `),
  },
  {
    id: 'wolf',
    label: 'Wolves & Hyenas',
    names: list(`
      Howler, Moonfang, Ashpelt, Snarl, Duskrunner, Frostjaw, Grimtooth, Shadowpaw, Ragged Ear, Nightmuzzle, Cackle,
      Smirk, Giggletooth, Bonecrunch, Ironhide, Scraggle, Sable Fang, Tundra, Hackles, Rimefur, Ember Eye, Thornpelt,
      Wolfram, Brisk, Lupa, Vargo, Fenrick, Lowell, Stormhowl, Gnash, Scruffle, Prowl, Lurk, Skulk, Glint,
      Mangy Mo, Old Greymuzzle, Slinkfoot, Tatter, Bristle, Cinder Paw, Ridgeback, Hollowbark, Blackmoor, Rook Fang,
      Silvertail, Whitewhisker, Coal, Smoke, Slate Wolf, Thicket, Bramblefang, Yowl, Yip, Snicker, Hee Haw, Chortle,
      Guffaw, Titter, Chuckle Fang, Spotty, Scavvy, Bone Bandit, Stripe, Dappled Dan, Rufus Ruff, Grizzleback,
      Hunter Moon, Pale Fang, Starling, Wildroot, Kestrel, Nightshade, Brindle, Copper, Rusty Jaw, Sundown, Thistle,
      Wolfsbane, Yarrow, Zealot, Barker, Chaser, Dingo Dan, Ember Fang, Flurry, Gale, Haze, Inkfang, Jagged, Knave,
      Lope, Murk, Nettle Fang, Outrider,
      Moonsong, Frostbite Fang, Greyrunner, Ashwhisker, Duskhowl, Pinescent, Crag Fang, Rimewalker,
    `),
  },
  {
    id: 'dog',
    label: 'Dogs',
    names: list(`
      Biscuit Bark, Waffles Woof, Pup Pup, Fetch, Sir Barksalot, Rover Grove, Patches, Noodle Nose,       Buster Bean, Sparky, Wiggles Wag, Kibble, Chomper, Barkley, Sniffy, Bandit Pup, Tater Tot, Meatball, Pickle Pup,
      Corndog, Bingo Bongo, Scamper, Rascal Rex, Duke Drool, Lady Floof, Floofington, Toasty, Mochi, Daikon, Soba,
      Udon, Miso, Tofu Pup, Yuzu, Kinako, Azuki, Taro, Sesame, Furikake, Nori, Wasabi Pup, Ponzu, Kombu,
      Shoyu, Tempura, Gyoza, Onigiri, Ramen, Bento, Edamame, Katsu, Mugi, Kuri, Hana Paw, Sora Pup, Ponpon,
      Zoomies, Tail Spin, Good Boy, Sock Thief, Squeaky, Ball Hog, Slobbers, Wagster, Ruff Ruff,
      Bonesy, Nugget Pup, Corky, Dottie, Freckles, Honey Pup, Jellybean, Kipper, Lucky Lou, Mopsy, Nacho,
      Cookie Pup, Poppy, Ruffles, Sprinkles, Tinker, Ziggy Pup, Dash, Echo Pup, Fudge Pup,
      Goober, Hopscotch, Jumbo, Lollipop, Marshmallow, Pretzel,           Wigglebutt, Puddle Paws, Flopsy Ears, Barkington, Snoot Boop, Treat Hound, Pawprint, Tailwind Pup, Chewtoy, Fluffernutter Pup, Snuggle Pup, Zoom Zoom,
    `),
  },
  {
    id: 'cat',
    label: 'Cats',
    names: list(`
      Whiskers, Mittens Mcgee, Purrcy, Sir Pounce, Tabby Tam, Marmalade Max, Smokey Joe, Paws, Furball, Clawdia,
      Purrsephone, Meowington, Kit Kitson, Shadow Puss, Ginger Nut, Tuxedo, Bootsie, Pumpkin Spice,
      Nibbles, Snoozer, Loaf, Scratch, Hiss, Tiddles, Fluffkins, Prowler, Tom Tiddler, Moggy Moe, Slinky Sue,
      Velvet Claw, Purrfect, Catnip, Yarnball, Cream Puff, Sardine, Kipper Cat, Tuna Melt, Pilchard, Saucer, Milky,
      Pepperpot, Nutmeg Puss, Cloudy, Dusty Paws, Fishbone, Knead, Mouser, Napkin, Ottoline, Pawpaw,
      Quaver, Sardinia, Ursa Purr, Vixie, Whiskerton, Yowler, Zuzu Puss, Alleycat Al,
      Biscuit Paws, Calico Kate, Doodle Cat, Earl Grey, Felicity, Gremlin, Hairball Harry, Inkblot, Jasper Purr,
      Kitty Hawk, Lady Whisk, Midnight, Oolong, Purrcival, Queenie, Rascal Cat, Sphinxy, Tigerlily,
      Underfoot, Vole Hunter, Windowsill, Yuki, Zest, Box Lover, Cardboard, Laser Dot, Tail Flick,
      Ninelives, Pounce Pounce, Scruffy Puss,
      Pawsley, Whiskerella, Mister Mews, Lady Purrington, Tuna Breath, Slippers, Biscuit Kneader, Sunbeam, Hissy Fit, Furrari, Catapult, Meowzer, Scritches, Toe Beans, Napsack,
    `),
  },
  {
    id: 'raccoon',
    label: 'Raccoons',
    names: list(`
      Trashcan Tess, Ringtail, Masked Max, Rummage, Scavenger, Bin Diver, Lidlifter, Nightscrounge, Pilfer, Swipe,
      Snatch, Pocketpaws, Grabbit, Scrounger, Moonlighter, Dumpster Dan, Garbage Gus, Rinse, Washbear, Dunk Dunk,
      Rascal Ring, Bandana Bo, Cornerstash, Sly Sal, Stripes, Banded Ben, Sticky Fingers, Klepto, Crumbcatcher,
      Hoarder, Squirrelly, Tinpot, Canopener, Wrapper, Peel, Crust, Leftovers, Rubbish Rita, Scrapheap, Gutterball,
      Alleyway Al, Backyard Bob, Picnic Pete, Cooler Raider, Lunchbox, Tupperware, Nightowl Nell, Shady Sadie,
      Skulker, Rattle Lid, Clatterpaw, Tinfoil, Bottlecap, Corkscrew, Napkin Ned, Crumb, Raisin, Pretzel Paws,
      Midnight Snack, Cheese Puff, Crackers, Muffin Top, Pizza Crust, Taco Tuesday, Popcorn, Cheddar, Sardine Can,
      Fishstick, Ketchup, Mustard, Relish, Gravy Boat, Pickle Jar, Jam Jar, Toast Crumb, Bagel, Donut Hole, Churro,
      Waffle Cone, Ringle Rascal, Masky, Domino, Bandit Jr, Little Mask, Stash, Fence,
      Loot, Pockets Pratt, Nab, Nicks, Rifle Through, Scoundrel, Smuggler, Trickster,
      Lid Rattler, Rummage Rosie, Midnight Mooch, Tin Lid Tom, Moochie, Crumbsnatch, Scraps Mcgee, Binbag Barney, Wheelie Bin,
    `),
  },
  {
    id: 'critter',
    label: 'Otters, Hares & Critters',
    names: list(`
      Sir Splashington, Lady Paddles, Pebble, Riverbank, Driftwood, Slipstream, Whiskerworth, Monocle, Tophat Ted,
      Moneybags, Old Money, Lord Puddle, Baroness Burrow, Count Clover, Hopscotch Hal, Clockwork Cloe,
      Gearspring, Brassbutton, Copperkettle, Sprocket Hare, Bunbun, Fluffytail, Radish,
      Parsnip, Turnip, Buttercup, Dandelion, Daisy Hop, Meadow, Clover Leaf, Burrows, Warren, Nibbler, Nutsy,
      Acorn, Chestnut, Hazelnut, Walnut, Pistachio, Almond, Pecan, Squeak, Scurry, Twitch, Ripple, Babble, Brook,
      Eddy, Torrent, Rapids, Shallows, Kelp, Seaweed, Clam, Shellby, Mussel, Cockle, Winkle, Limpet, Barnacle Bun,
      Pondweed, Lilypad, Reed, Rush, Cattail, Sedge, Willow, Alder, Birch, Rowan, Aspen, Poplar, Hawthorn, Holly,
      Ivy, Fern, Moss Bun, Lichen, Truffle Hunter, Mole Major, Shrew, Vole, Dormouse, Hedgy, Prickles, Quillby,
      Spud, Sprout Bun, Wigglenose, Puddlejump, Splashdown, Bubbles Brook, Fishfinger, Pondsworth,
      Hopsworth, Lord Lettuce, Burrowby, Duchess Dewdrop, Sir Whiskerton, Mudslide, Paddlepaw, Pebblebrook, Nibblesworth,
    `),
  },
  {
    id: 'frog',
    label: 'Frogs & Swamp Things',
    names: list(`
      Ribbit, Croaker, Hoppity, Lilypad Lou, Swampy, Bogwart, Mudpuddle, Bullfrog Bo, Toadstool, Warty, Gloop,
      Slurp, Splosh, Pondscum, Marshmallow Toad, Fen, Mire, Sludge, Muckle, Gumbo, Bayou Bill, Cypress, Spanish Moss,
      Dragonfly, Mayfly, Skeeter, Gnat Snatcher, Tongue Twister, Flycatcher, Leapfrog, Tadpole, Polliwog, Spawn,
      Newt, Eft, Axolotl, Mudskipper, Salamandra, Gecko, Iguana, Skink, Basilisk, Chameleon, Komodo, Monitor,
      Scaly, Coldblood, Sunbask, Bogtrotter, Quagmire, Morass, Slough, Sump, Ooze, Grimy, Slick, Dank, Moldy, Squelch,
      Goober, Bulging Eyes, Puffcheek, Throatsac, Hopscotch Toad, Jumpy, Springer, Bouncer, Lily, Duckweed, Reedy,
      Cattail Cal, Bog Myrtle, Peat, Moor, Heath, Nettle Toad, Hemlock, Bladderwort, Sundew, Pitcher, Venus,
      Wartface, Knobbly, Lumpy, Bumpy, Gnarly, Slimeball, Glop, Splat, Plop, Sploosh, Dribble, Drool, Gurgle, Burble,
      Blub, Bubble, Froglet, Toady,           Bogsworth, Croaksley, Lilyhopper, Murkwater,
    `),
  },
  {
    id: 'pirate',
    label: 'Pirates',
    names: list(`
      Barnaby Bilge, Saltbeard, One Eyed Wren, Peg Leg Pip, Scurvy Sam, Bosun Brine, Cutlass Kate, Mad Mollie,
      Gunwale Gus, Hook Hand Hal, Rumbelly, Plank Walker, Davy Drench, Squid Ink, Kraken Kev, Bilgewater, Driftwood Dan,
      Sea Dog Sid, Mister Mizzen, Captain Keel, First Mate Flint, Powder Monkey, Grog Barrel, Jolly Jim,       Red Molly, Salty Sue, Barnacle Betty, Anchor Annie, Chum Bucket, Ship Rat, Cannonball, Swabbie, Deckhand Dill,
      Crows Nest, Lookout Lou, Mainsail, Topsail, Jib, Spanker, Rudder, Tiller, Bowsprit, Figurehead, Doubloon,
      Piece of Eight, Treasure Tom, Gold Tooth, Silver Earring, Parrot Pete, Polly Cracker, Short Fuse,
      Gunpowder Gail, Blunderbuss, Musket Mo, Flintlock, Scallywag, Bilge Rat, Landlubber, Matey, Shiver, Timbers,
      Avast, Ahoy Annie, Yo Ho, Plunderpuss, Looter, Buccaneer Bea, Corsair Cora, Privateer, Marooner, Castaway,
      Tidewater, Riptide, Undertow, Maelstrom, Squall, Gale Force, Hurricane Hank, Typhoon, Seasalt, Brine Barrel,
      Kelpie, Coral Reef, Shipwreck, Sunken Sal, Davy Down, Cap'n Crab, Crabclaw, Lobster Larry, Eelbite,       Stingray, Starboard, Portside, Hardtack, Weevil, Sea Shanty,
      Barrelhouse Bess, Rope Burn, Seasick Sid, Keelhaul Kit, Bilgebottom, Rum Runner Ron, Gangplank Gil,
    `),
  },
  {
    id: 'knight',
    label: 'Knights & Kings',
    names: list(`
      Sir Brambleton, Sir Oakheart, Dame Ironwood, Sir Tinsley, Lady Gauntlet, Sir Cuthbert Plume, Squire Pip, Sir Wendel,
      Dame Hollin, Sir Fernwick, Lord Ashby, Sir Bertrand, Sir Roderick, Sir Godfrey Hale,
      Dame Rowena, Sir Edmund Vale, Sir Percy Plum, Lady Marigold, Sir Aldous, Sir Barnabus, Dame Beatrix, Sir Cedric,
      Dame Clementine, Sir Dunstan, Dame Edith, Sir Fulke, Dame Gwenna, Sir Humphrey, Dame Ingrid, Sir Jasper,
      Dame Katarina, Dame Mathilda, Sir Neville, Dame Odette, Dame Philippa, Sir Quentin,
      Dame Rosamund, Sir Sigmund, Dame Tamsin, Sir Ulric, Dame Verity, Sir Wilfred, Dame Winifred,       Sir Mortimer, Lord Hawksley, Baron Brackenridge, Duke Dunhollow, Earl Elmstead, Count Crestwood,       Squire Tumbleby, Squire Nettles, Squire Hob, Page Herald Hugo, Lord Longsword, Sir Shieldsworth,
      Sir Helmsley, Sir Visor, Sir Chainmail, Sir Lanceford, Sir Banner, Sir Gallop, Dame Saddle, Sir Joust, Sir Tilt,
      Sir Pennant, Sir Rampart, Sir Portcullis, Sir Turret, Sir Moatsby, Sir Drawbridge, Sir Battlement, King Crumpet,
      Prince Peregrine, Princess Primrose, Lord Thistlewood, Sir Barleycorn, Sir Mead, Sir Pottage,
      Sir Tankard, Sir Trencher, Dame Hearth, Sir Hedge, Sir Furrow, Sir Wheatley, Sir Bracken,
      Sir Gorse, Sir Heather, Sir Thornbury, Sir Redwick, Sir Graymane,
      Sir Puddingstone, Dame Brightshield, Sir Clanksworth, Sir Ironsides, Dame Larkmoor, Sir Ploddington, Sir Beaverbrook, Squire Dimble, Lady Ashcombe, Sir Crumbleton, Dame Featherhelm, Sir Gallantry, Sir Dewberry,
    `),
  },
  {
    id: 'ninja',
    label: 'Ninjas & Samurai',
    names: list(`
      Kage, Hayate, Kaze, Kumori, Yoru, Tsuki, Hoshi, Kasumi, Shizuka, Kiri, Hibana, Tora,       Kitsune, Tanuki, Fukuro, Karasu, Suzume, Tsubame, Hebi, Kumo, Sasori, Kamakiri, Inazuma, Arashi, Fubuki,
      Yuki Kage, Hanabi, Sakura Blade, Momiji, Kaede, Matsu, Take, Ume, Sumi, Ishi, Iwa, Kawa, Umi Kaze, Nami,
      Hotaru, Semi, Kani, Tako, Ika, Saba, Iwashi, Unagi, Masu, Koi, Silent Step, Quiet Fox, Paper Lantern,
      Bamboo Shadow, Folded Crane, Ink Brush, Smoke Bomb, Throwing Star, Rooftop Runner, Night Blossom, Still Water,
      Falling Leaf, Hidden Moon, Swift Reed, Iron Fan, Silk Cord, Grey Heron, Mountain Mist, River Stone, Cold Dawn,
      Red Lantern, Jade Fang, Lotus Edge, Plum Rain, Pine Needle, Tiger Lily, Crane Wing, Old Master Ume,
      Sensei Kobu, Kenji Mura, Taro Kiba, Jiro Sake, Saburo Nobe, Shiro Kuro, Goro Hana, Rokuro, Hachiro,
      Kuro Neko, Shiro Usagi, Midori, Aoi, Akane, Kogane, Gin, Tetsu, Hagane,
      Kaminari, Shinobu Kaze, Yamikawa, Tobikage, Kurokumo, Hisoka, Tsukikage, Mizuhara Ko,
    `),
  },
  {
    id: 'wizard',
    label: 'Wizards & Witches',
    names: list(`
      Wizzlewick, Old Mumblebeard, Mother Cauldron, Granny Toadwort, Professor Pocus, Hocus, Brewster, Sparkleby,
      Fizzlewit, Mystic Mabel, Grimoire, Thaddeus Quill, Morwenna, Eldritch Ed, Spellbinder, Runecaster, Hexley,
      Madame Mandrake, Wartnose, Crookstaff, Starcloak, Moonhat, Sir Sparks, Abracadabra, Prestidigitus, Zappo,
      Cobweb, Nightcap, Wormwood, Henbane, Belladonna, Foxglove, Mugwort, Hyssop, Rue, Sage, Thyme, Rosemary,
      Bramblewitch, Broomstick Betty, Cackling Cass, Old Nell Nettles, Auntie Augury, Crystal Clara, Tea Leaf Tilly,
      Bubble And Toil, Potion Pete, Elixir Ellie, Philtre Phil, Tincture, Draught, Simmer, Stir Stir, Ladle,
      Eye of Newt, Toe of Frog, Batwing, Owl Feather, Raven Quill, Dragon Scale, Unicorn Hair, Phoenix Ash, Moonstone,
      Starglass, Sunpowder, Moondust, Comet Tail, Nebula, Aurora, Twilight, Gloaming, Solstice, Equinox, Zenith,
      Alchemy Al, Brimstone, Cinnabar, Orpiment, Vitriol, Wizbert, Spindleshanks,
      Hobnail, Pointy Hat, Long Sleeves, Robe Trailer, Staff Bearer, Orb Gazer, Scroll Keeper, Tome Hoarder,
      Candle Wax, Wand Waver, Familiar,
      Sparkwhistle, Gloomcap, Wanda Wobblewand, Old Spellsby, Hatpin Hattie, Mistwhisper, Cauldron Kate, Twinkleby, Bramble Hex, Owlbert, Fogwell,
    `),
  },
  {
    id: 'barbarian',
    label: 'Barbarians & Warriors',
    names: list(`
      Grumak, Bonebreaker, Axel Hewn, Skullsplit, Ragnhild, Borga, Hruff, Ironjaw, Stonefist, Bloodmane,
      Wartusk, Gorehowl, Bearhug, Hammerhand, Battlecry, Warpaint, Shieldbiter, Mountainback, Rockjaw, Thunderthighs,
      Boulderbrow, Cragg, Flintface, Grunhilda, Helga Hornhelm, Ingvar, Jorund, Kolbrun, Leif Loudmouth, Magnar,
      Orm, Rolf Redbeard, Sigrid, Torvald, Ulla, Vigdis, Yngvar, Agnar, Brynja, Dagny, Eirik Axe,       Gunnar Gruff, Ketil, Ljot, Mord, Odd, Thorgrim, Ulf, Vali,
      Asha Ember, Kofi Spear, Nala Storm, Zuri Flame, Imani Shield, Tendai, Zola Dust, Baraka, Amara Ash,
      Sefu, Chidi Thunder, Mosi, Kamau, Nia Bright, Femi, Ayo Strong, Kito, Zawadi, Tau Lion, Ndidi, Obi Stone,
      Big Mug, Meat Shield, Loincloth Larry, Shirtless Steve, Furboots, Hornhat, Bonenecklace, Mead Hall, Feast,
      Bellow, Roar, Stomp, Smash, Crush, Bash, Thump, Wallop, Clobber, Pummel, Brute, Brawn, Muscles Mcgee,
      Grimbold, Axehilda, Thundergut, Bonegrinder, Mammoth Mo, Ironbrow, Stonehilda, Wolfhide, Bigsby Brawn, Grogbeard, Tusker,
    `),
  },
  {
    id: 'undead',
    label: 'Zombies & Skeletons',
    names: list(`
      Moaner, Gnawbone, Rotgut, Sir Rattlebones, Mister Marrow, Calcium, Femur, Tibia, Fibula, Ulna, Radius, Patella,
      Clavicle, Sternum, Vertebra, Skully, Jawbone, Knucklebones, Ribcage, Bonita, Boneyard, Grave Dan,
      Tombstone, Headstone, Mausoleum, Ossuary, Catacomb, Coffin Carl, Casket, Shroud, Wormfood,
      Maggot, Grubby, Mouldy, Mildewy, Fester, Pustule, Oozy, Drippy, Stumbles, Lurchy, Slouch, Drag,
      Limp, Hobble, Totter, Teeter, Wobbly, Floppy, Saggy, Droopy, Gloopy, Rot, Decay, Blight, Wither, Wilt, Mortimer,
      Ghastly, Gruesome, Grisly, Gristly, Brainless, Cranium, Noggin, Bonehead, Numbskull,
      Deadeye, Deadbolt, Deadwood, Dead Ned, Late Larry, Former Fred, Ex Ted, Undying Ian, Rising Rita, Gravedigger,
      Spade, Shovel, Pickaxe, Lantern Larry, Midnight Moe, Full Moon Phil, Howl, Groan, Grunt Grunt, Ugh, Urrgh,
      Mrrrh, Arms Out, Shuffle, Sir Shamble,
      Clatterbones, Rotsworth, Graveyard Gus, Sir Crumbleskull, Lady Lurchington, Shufflefoot, Moldersby, Ribsy, Cadaver Cal, Gnasher, Tombsy,
    `),
  },
  {
    id: 'horror',
    label: 'Horrors & Haunts',
    names: list(`
      Jack O Grin, Candlewick, Hollowgourd, Cackles, Mister Grins, Funhouse, Big Top,       Honk Honk, Squeaky Shoes, Greasepaint, Ringmaster Rot, Count Fangsley, Lady Nocturne, Baron Batsworth, Duke Dusk,
      Madame Midnight, Crimson Cape, Coffin Nails, Sanguine, Velvet Fang, Mister Nightly,
      Gloomsbury, Dreadmore, Shiverly, Creepwell, Spookums, Ghostly Gail, Phantom Phil, Wraith, Spectre,
      Poltergeist Pam, Banshee Bea, Ghoul, Goblin Moon, Bogeyman, Night Terror, Bump In Night, Under The Bed,
      In The Closet, Attic Annie, Cellar Sid, Basement Bob, Creaky Floor, Squeaky Door, Cobweb Carl, Dusty Sheet,
      Chandelier, Candelabra, Grandfather Clock, Portrait Eyes, Mirror Mary, Crow, Bat, Spider, Moth, Rat,
      Toad Witch, Hemlock Hank, Nightshade Nell, Mandrake Mo, Gourd, Squash, Turnip Head,       Hayseed, Strawman, Crowbait, Tentacle Ted, Slime Lord, Goo, Glorp, Squelchy, Mutant Mike, Lab Rat,
      Specimen Six, Vat Grown, Formaldehyde, Jar Brain, Stitches, Bolts, Hunchback Hal, Fog, Mist,
      Murk Mire, Gloaming Grin, Witching Hour, Hallows, Trick, Treat,
      Creepers, Shadowgrin, Hollowcackle, Gourdon, Fangsworth, Lady Gloom, Grinsley, Wretch, Nightgrin Ned, Shriek, Gibber, Skulkington, Bonechill, Murkwood Moe, Dreadful Dot,
    `),
  },
  {
    id: 'robot',
    label: 'Robots & Mechs',
    names: list(`
      Clanker, Beep Boop, Gearbox, Servo, Piston, Widget, Gadget, Doohickey, Thingamabob, Gizmotron,
      Rivet, Bolt Bot, Nuts N Bolts, Ratchet Bot, Spanner, Wrench, Torque, Sprocket Bot, Flywheel, Crankshaft,
      Camshaft, Carburetor, Spark Plug, Fuse, Circuit, Diode, Transistor, Capacitor, Resistor, Relay, Solenoid,
      Actuator, Motherboard, Microchip, Byte, Nibble, Kilobyte, Megabyte, Pixel, Vector, Bitmap, Cursor, Mousepad,
      Keyboard, Joystick, Floppy, Cassette, Dial Up, Modem, Router, Toaster, Blender, Vacuum, Dishwasher, Mixer,
      Kettle Bot, Microwave, Fridge, Mopbot, Sweeper, Dustpan, Unit Alpha, Unit Beta,
      Unit Gamma, Unit Delta, Unit Omega, Model Tee, Prototype, Beta Build, Firmware, Patch Notes, Reboot, Shutdown,
      Standby, Low Battery, Overclock, Underclock, Heatsink, Coolant, Oilcan, Rustbelt, Chrome Dome,
      Steel Sally, Iron Ike, Copper Kid, Brass Knuckles, Titanium Ty, Alloy, Magnet, Laser, Sonar, Radar, Lidar,
      Gyro, Rotor, Hydraulic, Pneumatic, Clunk, Whirr, Bleep, Bloop, Zap, Ping,
    `),
  },
  {
    id: 'alien',
    label: 'Aliens & Visitors',
    names: list(`
      Zorbo, Glixx, Xyloth, Quorp, Blinx, Zarnak, Vrell, Ooblek, Krix, Pleeb, Zeeble, Nebbo, Gloonix, Tharx, Zibzab,
      Wubbo, Yorrik, Qwex, Skreel, Vexxo, Bloopus, Gorbix, Ploonk, Zentar, Xibbit, Quazz,       Zip Zop, Meep, Morp, Glorbo, Snarfle, Floob, Gleep, Zorp, Blip Blip, Probe, Abductor, Saucer Sid, Mothership,
      Tractor Beam, Crop Circle, Little Green, Big Grey, Area Fifty, Stargazer, Comet, Asteroid,
      Meteor, Quasar, Pulsar, Nova Nix, Supernova, Galaxy, Cosmo, Astro, Orbit, Lunar, Solar, Stellar, Nebula Ned,
      Void, Wormhole, Warp, Hyperdrive, Parsec, Antenna, Tentacles, Three Eyes, Big Head, Green Gary,
      Purple Pat, Blue Blip, Glowstick, Neon, Plasma Pete, Ray Gun, Zapper, Blaster, Ionizer, Anomaly,
      Specimen, Outsider, Stranger, Newcomer, Earthling Fan, Tourist, Ambassador Zed, Envoy Ix, Observer,
      Scanner, Sample Taker, Mind Reader,
      Zooble, Plixx, Grommox, Quibbix, Xandle, Vorbit, Snorg, Blerp, Ziggorath, Plorx, Yumbo,
    `),
  },
  {
    id: 'goblin',
    label: 'Goblins & Imps',
    names: list(`
      Snaggletooth, Grubnik, Nixit, Skrag, Ratbag, Grizz, Mugwort Gob, Fungus, Mushroom Mo, Toadstool Tim,
      Wartnik, Bogey, Snizzle, Gnarl, Krunk, Zogg, Snik, Nikk, Pikk, Skab, Scab, Scrabble, Gribble, Grizzle,
      Drizzle, Muck, Mucky, Grubby Gob, Sneaky Pete, Pickpocket, Cutpurse, Shiv, Stabby, Pokey, Jabby, Slashy, Hacky,
      Bitey, Nippy, Snappy, Twitchy, Greasy, Grimy Gob, Oily, Stinky, Smelly,
      Whiffy, Reeky, Rancid, Rotten Ron, Mouldy Mo, Crusty, Flaky, Scaly Gob, Lumpy Gob, Knobbly Gob,
      Warty Gob, Bumpy Gob, Gnashy, Toothy, Fangy, Ears, Big Nose, Long Ears, Pointy, Spiky, Prickly, Thorny,
      Bramble Gob, Nettle Gob, Thistle Gob, Burr, Briar, Gorse Gob, Hob Gob, Hobnob, Nobgob, Gobsmack, Gobstopper,
      Gobble, Gobbet, Impy, Puglin Pal, Pug, Snub, Squat, Runt, Tiddler, Nipper, Sprog,
      Grizzletooth, Nibnab, Skulch, Gnashbog, Snickerblade, Mudgob, Greb, Pilchard Gob, Rotnose, Scrump, Fizzgob, Wonkle, Nettlenose,
    `),
  },
  {
    id: 'cowboy',
    label: 'Cowboys & Outlaws',
    names: list(`
      Dusty Boots, Tumbleweed Tex, Sagebrush Sam, Rattlesnake Ray, Lasso Lou, Spurs, Saddlebag, Buckaroo Bill,
      Bronco Bess, Mustang Mae, Stallion, Pinto Pete, Palomino, Appaloosa, Rawhide, Chaps, Stetson Steve, Ten Gallon,
      Bandana Bill, Hitching Post, Water Trough, Prickly Pear, Mesquite, Yucca, Coyote Cal, Jackrabbit,
      Roadrunner Ron, Vulture Vic, Gila Gus, Scorpion Sue, Sidewinder, Diamondback, Desert Rose, Canyon Kate,
      Mesa Mike, Butte, Gulch, Arroyo, Bluff, Ridge Rider, Trail Boss, Cattle Kate, Wrangler, Rustler Ruth, Drover,
      Ranch Hand Hank, Chuckwagon Charlie, Beans N Bacon, Coffee Pot, Campfire, Harmonica Hal, Banjo Bob, Fiddle Fred,
      Saloon Sal, Swinging Doors, Whiskey Wil, Sarsaparilla, Poker Face, Ace High, Full House,       Quickdraw, Sixgun Sadie, Two Gun Tilly, Long Rifle, Buckshot, Iron Horse, Stagecoach,
      Pony Express, Gold Rush, Prospector Pat, Nugget Ned, Panhandler, Sluice, Claim Jumper, Boomtown, Ghost Town,
      High Noon, Sundown Sid, Dust Devil, Dry Gulch, Lonesome Lee, Drifter Dan, Wanted Wes, Bounty, Sheriff Shaw,
      Marshal Mae, Posse, Outlaw Ollie, Bandito, Desperado Dee, Hombre,
      Saddlesore Sam, Dustbowl Dot, Mule Kick, Rope Trick, Canteen Cal, Spittoon, Horseshoe Hank, Prairie Prue, Cattle Drive, Sunrise Sue, Brandin Iron, Tin Star,
    `),
  },
  {
    id: 'gangster',
    label: 'Gangsters & Grifters',
    names: list(`
      Fingers Mulgrew, Two Bits, Knuckles Nolan, Slick Vinnie, Pinstripe Pete, Fedora Fran, Tommy Gunn, Big Sal,
      Little Sal, Lucky Lenny, Sly Sully, Smiles Moretti, Bootleg Bill, Speakeasy Sue, Moonshine Mo,
      Bathtub Gin, Rumrunner, Nickels, Dimes, Quarters, Greenback, Moolah, Dough, Bread, Clams, Lettuce, Cabbage,
      Spondulix, Racketeer, Bookie Bo, Numbers Ned, Ledger Lou, Shakedown, Muscle, Enforcer Ed, Lookout Lucy,
      Wheelman Wally, Getaway Gus, Safecracker Sam, Locksmith Lil, Forger Fred, Counterfeit Carl, Con Man Connie,
      Grifter Greg, Hustler Hank, Shill, Mark, Patsy, Fall Guy, Stoolie, Rat Fink, Canary, Songbird, Snitch,
      Gumshoe, Flatfoot, Bullseye Bert, Stiletto Stella, Velvet Glove, Silk Tie, Spats, Cufflinks,
      Tie Pin, Pocket Watch, Cigar, Smoke Ring, Ashtray, Jazz Hands, Trumpet, Saxophone Sid, Torch Singer,
      Flapper Flo, Charleston, Foxtrot, Tango Tony, Ritzy, Swanky, Glitzy, Ritz, Gilded, Velvet Rope, Back Room,
      Card Shark, High Roller, Low Roller, Big Shot, Hot Shot, Top Hat, Bowler, Boater, Homburg, Trilby, Newsboy,
      Ledger Lenny, Double Cross, Crooked Carl, Pinky Ring, Wiseguy, Tailcoat, Slippery Sal, Backroom Bertie, Velvet Voice, Racket Ricky,
    `),
  },
  {
    id: 'townsfolk',
    label: 'Townsfolk',
    names: list(`
      Uncle Auntie Pearl, Grandma Fig, Grandpa Gus, Milkman Mel, Baker Bea, Butcher Bob,
      Candlestick Carl, Plumber Pete, Janitor Jan, Mechanic Mo, Barista Bo, Cashier Cass, Waiter Walt, Busboy Benny,
      Line Cook Lou, Sous Chef Sid, Dishwasher Di, Delivery Dee, Courier Kit, Paperboy Paul, Crossing Guard,
      Lollipop Lady, Librarian Lin, Teacher Tess, Principal Pam, Coach Carl, Referee Ray, Umpire Ugo, Lifeguard Lu,
      Park Ranger Pip, Gardener Gil, Florist Flo, Grocer Greg, Tailor Tom, Cobbler Cal, Barber Barry, Hairdresser Hal,
      Dentist Dot, Vet Vic, Pharmacist Phil, Optician Opal, Locksmith Len, Electrician Eli, Carpenter Cam, Roofer Rue,
      Painter Pia, Tiler Ty, Glazier Gwen, Welder Wes, Trucker Tex, Cabbie Cole, Bus Driver Bea, Conductor Con,
      Pilot Pru, Sailor Sal, Fisher Finn, Farmer Fen, Shepherd Shay, Beekeeper Bee, Miller Mae, Brewer Bram,
      Vintner Vin, Cheesemaker Ches, Potter Pott, Weaver Wynn, Knitter Nan, Quilter Quinn, Juggler Jo, Mime Mim,
      Busker Buzz, Magician Mags, Clown Around, Accountant Al, Clerk Clem, Notary Ned, Banker Bern, Realtor Rhea,
      Influencer Izzy, Podcaster Pod, Gamer Gail, Streamer Stan, Tourist Tilly, Retiree Rex, Neighbour Ned, Mayor May,
      Town Crier, Night Watch, Dog Walker, Cat Sitter, Snow Shoveller, Leaf Raker, Lawn Mower, Handyman Hap,
      Auntie Agatha, Cousin Clem, Granny Gumdrop, Neighbour Nell, Old Man Oakes, Uncle Ernie, Paper Route Pat, Lunch Lady Lou, Bingo Barb, Allotment Al,
    `),
  },
  {
    id: 'myth',
    label: 'Gods & Legends',
    names: list(`
      Anubiscuit, Ra Ra, Sobekky, Horace Horus, Thothy, Bastet Belle, Setto, Khonsu Koo, Ptahbert,
      Hathorsome, Sekhmetty, Nephthys Nell, Scarabeus, Sphinxley, Pharaoh Phil, Mummy Mo, Wrappings,
      Papyrus, Hieroglyph, Obelisk, Pyramid Pete, Sarcophagus, Canopic, Ankh, Sun Disc, Jackal Jack, Ibis, Falcon,
      Father Frost, Old Saint Snow, Yule Log, Mistletoe, Holly King, Ivy Queen, Jingle, Tinsel Toes, Sleigh Bell,
      Stocking, Chimney Sweep, Snowflake, Frostbite, Icicle, Reindeer Rex, Antler, Sugarplum, Gingerbread, Candy Cane,
      Eggnog, Fruitcake, Plum Pudding, Mince Pie, Roast Chestnut, Wassail, Carol, Noel,       Thunder Lord, Storm Bringer, Sky Father, Sea Mother, Earth Shaker, Fire Keeper, Moon Weaver, Sun Strider,
      Star Herder, Dawn Bringer, Dusk Warden, Night Mother, Day Father, Harvest Lord, Rain Maker, Wind Caller,
      Oak Father, River Queen, Mountain King, Cave Mother, Hearth Spirit, Trickster Fox, Raven Spirit, Coyote Spirit,
      Spider Spirit, Hare Spirit, Turtle Spirit, Bear Spirit, Wolf Spirit, Owl Spirit, Elk Spirit, Salmon Spirit,
      Whale Spirit, Crane Spirit, Dragon Spirit, Lion Spirit,
      Sun Hare, Moon Toad, Star Whale, Cloud Shepherd, Thunder Bird, Frost Giant, Sea Serpent, Fire Drake, Hearth Mother, Stone Giant, Sky Whale, Dream Spinner,
    `),
  },
];

const THEMES_BY_ID = new Map(NAME_THEMES.map((t) => [t.id, t]));
export const nameTheme = (id: string | undefined): NameTheme | undefined => (id ? THEMES_BY_ID.get(id) : undefined);
export const isNameTheme = (x: unknown): x is string => typeof x === 'string' && THEMES_BY_ID.has(x);

/** The theme of a built-in look without one of its own: by what it is (a new soldier skin is a soldier). */
const GROUP_THEMES: Partial<Record<CharacterGroup, string>> = { soldiers: 'soldier', legends: 'knight', folk: 'townsfolk', horror: 'horror' };

/** The NPC skins' themes (`npc:<role>` looks; sim/npc.ts). */
export const NPC_SKIN_THEMES: Readonly<Record<string, string>> = {
  trooper: 'soldier',
  gunner: 'soldier',
  heavy: 'soldier',
  sniper: 'soldier',
  zombie: 'undead',
  imp: 'goblin',
  puglin: 'goblin',
  cyclops: 'alien',
  oculus: 'alien',
  scolitex: 'alien',
};

const lookById = new Map(CORE_LOOKS.map((l) => [l.id, l]));
/** A built-in look (a retired one gives its replacement), or undefined (a design of yours, an NPC skin, unknown). */
const builtIn = (id: string | undefined): CharacterLook | undefined => (id ? lookById.get(RETIRED_LOOKS[id] ?? id) : undefined);

/** A look's name theme: its own, else its group's; an NPC skin's; null for a design of yours or anything unknown. */
export function lookTheme(id: string | undefined): string | null {
  if (id?.startsWith('npc:')) return NPC_SKIN_THEMES[id.slice(4)] ?? null;
  const l = builtIn(id);
  if (!l) return null;
  return (l.nameTheme && THEMES_BY_ID.has(l.nameTheme) ? l.nameTheme : undefined) ?? (l.group ? GROUP_THEMES[l.group] : undefined) ?? null;
}

// ---------------------------------------------------------------- bot characters (which looks random bots wear)

/**
 * Which looks random bots wear: character groups (CHARACTER_GROUPS ids) and/or name themes (NAME_THEMES ids). A
 * look is in when its group or its theme is listed. Empty: every look (all).
 */
export type BotCast = readonly string[];
/** Most entries in a bot-characters setting. */
export const BOT_CAST_MAX = 8;

const isGroupId = (x: string) => CHARACTER_GROUPS.some((g) => g.id === x);
export const isCastId = (x: unknown): x is string => typeof x === 'string' && (isGroupId(x) || THEMES_BY_ID.has(x));

/** A bot-characters setting made valid: known ids only, each once, at most BOT_CAST_MAX. Not a list: empty (all). */
export function validBotCast(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) if (isCastId(x) && !out.includes(x) && out.length < BOT_CAST_MAX) out.push(x);
  return out;
}

/** Whether a look is in a bot-characters setting (empty: every look is). */
export function castAllows(cast: BotCast | undefined, look: string): boolean {
  if (!cast?.length) return true;
  const l = builtIn(look);
  const group = l?.group ?? null;
  const theme = lookTheme(look);
  return cast.some((x) => x === group || x === theme);
}

/** The looks random bots wear under a bot-characters setting, in roster order; every look when none fits. */
export function castLooks(cast: BotCast | undefined): readonly CharacterLook[] {
  if (!cast?.length) return CORE_LOOKS;
  const out = CORE_LOOKS.filter((l) => castAllows(cast, l.id));
  return out.length ? out : CORE_LOOKS;
}

/** The choices a menu offers, groups first: { id, label }. */
export const BOT_CAST_CHOICES: readonly { id: string; label: string }[] = [...CHARACTER_GROUPS.map((g) => ({ id: g.id, label: g.label })), ...NAME_THEMES.map((t) => ({ id: t.id, label: t.label }))];

/** "Soldiers", "Pirates + Knights & Kings", or "All characters". */
export function botCastLabel(cast: BotCast | undefined): string {
  if (!cast?.length) return 'All characters';
  return cast.map((x) => BOT_CAST_CHOICES.find((c) => c.id === x)?.label ?? x).join(' + ');
}

// ---------------------------------------------------------------- naming a bot

/**
 * A random bot's name for `look`: the look's own name ("Scamp"), else the next free name of its theme's list
 * (from `offset`, so matches differ), else the general list, else "Mildred 2"… `taken(name)`: whether a name is
 * in use in the match (any case): players', bots', the host's bot set's.
 */
export function botNameFor(look: string | undefined, taken: (name: string) => boolean, offset = 0): string {
  const own = builtIn(look)?.name;
  if (own && !taken(own)) return own;
  const theme = nameTheme(lookTheme(look) ?? undefined);
  if (theme) {
    const n = theme.names.length;
    const start = ((offset % n) + n) % n;
    for (let i = 0; i < n; i++) {
      const name = theme.names[(start + i) % n]!;
      if (!taken(name)) return name;
    }
  }
  for (const name of BOT_NAMES) if (!taken(name)) return name;
  for (let round = 2; ; round++) for (const base of BOT_NAMES) if (!taken(`${base} ${round}`)) return `${base} ${round}`;
}
