# Music and announcer: the owner's sounds (plan, 2026-11-17)

The owner made 10 music tracks and 39 announcer lines and put them in their Drive, folder `sounds` (2026-11-17).
- **Tools:** music with Lyria 3 Pro, the voice with MiniMax Speech-02 HD (file names), made by the owner through Artlist.
- **Licence:** owner (2026-11-17): "we are good with the license, since i made those sounds and we are not giving out the individual files for them".
- **Provenance:** record each as made by the owner (Artlist; tool named), owned.
- **Shipping:** the owner's files may go in the game as they are (owner, 2026-11-17: "we can put the file in, we just can distribute it through our game"); they reach players only inside the game, never offered as separate downloads. The helper may still trim silence and even out loudness, or re-encode to a smaller format, where that helps.
- **Mapping:** owner "ok" on the mapping below, and keep both quoted lines.

## Music
- **Main menu:** `Arena Music 1–5` (the main menu, Match Setup, lobbies).
- **MapMaker:** `Map Maker Music 1–5`. Test play is a match, so no music there.
- **Playback:** a shuffle without repeats until all have played, a crossfade of about 3 s between tracks, and a fade out when a match starts.
- **Volume:** a Music slider beside today's volume slider, saved like it. Music stops when the tab is hidden and comes back where it was.
- **Loudness:** about -16 LUFS for music, so it sits under the menu sounds.

## Announcer
Rules:
- One line at a time and a short cooldown of about 2.5 s.
- Priority order: match flow, then objectives, then multi-kills, then streaks, then special kills, then hype.
- Kill lines are heard only by the player they're about.
- Team and match lines (flag, bomb, clock, round win) are heard by all.
- An Announcer slider, saved.
- The old Kenney lines stay as the fallback for anything not mapped.

| Line (file starts with) | Condition |
|---|---|
| 3_2_1_FIGHT | Match or round start (replaces "Fight!") |
| One_minute_left | 60 s left on the match clock |
| 10_Kills_left | The leading team or player is 10 from the score limit (once a match) |
| Attackers_Win / Defenders_Win | End of a Breakthrough or Bomb round, by side |
| Next_in_queue | The next map starts loading after a match |
| The_flag_has_been_taken / _dropped / _returned / _captured | CTF flag events |
| The_bomb_has_been_planted / _disarmed | Bomb mode |
| Double_Kill / Triple_Kill / Quadra_Kill | 2 / 3 / 4 kills, each within 4 s of the last (the existing multi-kill window) |
| Multi-kill | 5 in that chain |
| Mega_Ultra_Super_Nasty_Boy_Kil | 6–7 in that chain |
| Server_overload | 8+ in that chain, or 4+ kills from one explosion |
| Headshot / Dome_shot / Brain_Cave | Headshot kill, rotating; Dome shot preferred for a headshot past about 40 m |
| Killing_spree | 5 kills without dying |
| Eviscerator | 10 kills without dying |
| Do_you_ever_stop_stopping | 15 kills without dying |
| Twist_his_eggplant | Melee kill |
| That_guy_just_blew_up_a_dog_so | Explosive kill of an animal character (a look flagged as animal) |
| Mr_Boombastic_Say_me_fantastic | A multi-kill (2+) where the kills are explosive |
| Later_Gator | You end someone's streak of 5 or more |
| Hail_to_the_cheet | You take first place (FFA) or your team takes the lead, at most once a minute |
| Im_gonna_need_about_tree_fiddy | A Roulette jackpot life |
| This_is_wild / Incredible / Can_you_believe_it / I_freakin_love_it / My_guy_did_you_just_see_that / Give_me_more | Hype: at random, about 1 in 3 times after a Triple Kill or better, a streak line, or Server overload; never right after another line |
| Irate_now | You die 3 times in a row without a kill |
| What_the_heck_is_Timmy_gonna_d | You are the last one alive on your team (Elimination, rounds) |
| This_is_my_rifle_There_are_man | You finish a match as the top scorer |

Reduce flashing doesn't apply: these are sounds only.

## As built (2026-11-18, `wip/music-announcer`)
- **Files:** `content/owner-audio.json` maps each track and line to the start of the owner's file name; `tools/content/owner-audio.mjs` encodes them (silence trimmed, -16 LUFS, Ogg Opus: music 64 kbps stereo, 1.0-1.5 MB a track, 13.5 MB in all; lines 48 kbps mono, 0.5 MB in all) and `content/owner-audio.lock.json` records them; provenance lists each as the owner's own (owned). Nothing in the game lists the files or offers them for download.
- **Music:** `audio/music.ts`, by the app's screen: menu (also Match Setup, lobbies and the character designer), MapMaker, none in a match or test play. Starts only after the first click or key, streams only the track playing; Music at 0 fetches nothing.
- **Announcer:** `audio/announcer.ts` (the rules, unit-tested) fed by `game/sessionAudio.ts` (events) and `game/session.ts` (the clock, scores and who is alive, from snapshots).
  - "3, 2, 1, FIGHT!" starts at 3 s left in the countdown, so FIGHT lands on the start (the beeps stop under it); a round start without a countdown says it as the round begins.
  - One minute left: the clock crossing 60 s (once a match). Ten kills left: Deathmatch, Team Deathmatch and Roulette only, score limit 20 or more (the other modes' scores aren't kills).
  - Attackers / Defenders win: Breakthrough (the team attacking that round) and Bomb (the mode's first team attacks); Elimination keeps Kenney's win / lose.
  - Next in queue: the match's end when the rotation or "next map" names where it goes, after the result and "This is my rifle".
  - Bomb planted / disarmed: Bomb mode, and Breakthrough's charges too.
  - Mr Boombastic: a chain of 2 or 3 kills that were all blasts says it once, in place of Double / Triple Kill; 4 kills from one blast is Server overload.
  - Special kills, one a kill, in this order: Later gator, the blown-up animal, melee, headshot.
  - Hype: one time in three after a Triple Kill or better, a streak line or Server overload, at most once in 20 s, only into a quiet moment.
  - Hail to the chief: you (free-for-all) or your team taking the lead outright, not in Co-op or Zombies.
  - The last one alive: Elimination and Bomb, once a round, while an enemy still stands.

