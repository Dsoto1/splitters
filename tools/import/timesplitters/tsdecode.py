#!/usr/bin/env python3
"""Prototype decoder for TimeSplitters 2 / Future Perfect MapMaker saves (GameCube .gci).

Usage:  python3 -I tsdecode.py OUTDIR file1.gci [file2.gci ...]
Writes OUTDIR/<basename>.json and OUTDIR/<basename>.txt (ASCII preview) per input.

Pure byte parsing; nothing from the input is executed. See FORMAT.md for the
meaning/confidence of every field.
"""
import json, os, struct, sys

# ---------------------------------------------------------------- helpers
def u32(b, o): return struct.unpack_from('>I', b, o)[0]
def u16(b, o): return struct.unpack_from('>H', b, o)[0]
def s8(x): return x - 256 if x > 127 else x
def cstr(b):
    return b.split(b'\0', 1)[0].decode('latin-1')
def f32(b, o): return struct.unpack_from('>f', b, o)[0]

DATA = 0x880          # file offset of the map data block (after 64B GCI header + 0x40 comment + 0x800 icon)
TAG_BASE = {'TS2': 0x01324600, 'TSFP': 0x00C77600}
VERSION_TAG = {'TS2': 0x26, 'TSFP': 0x67}
END_TAG = {'TS2': 0x29, 'TSFP': 0x6A}

# Footprints (w,h) in grid cells, for rot 0; odd rotations swap w/h.
# Anchor (x,y) = minimum corner of the rotated footprint.
# Confidence: see FORMAT.md. Missing types default to 1x1.
TS2_SIZE = {0: (1, 2), 3: (2, 2), 4: (1, 2), 5: (1, 5), 6: (3, 5), 7: (3, 3), 8: (2, 2),
            10: (3, 1), 11: (3, 3), 12: (3, 3), 13: (3, 3), 14: (1, 2), 15: (3, 1), 16: (3, 3),
            18: (1, 3), 19: (3, 1), 20: (3, 3), 21: (3, 3), 22: (3, 3), 23: (3, 3), 24: (3, 3),
            25: (3, 3), 26: (3, 3), 27: (3, 5), 28: (2, 2), 29: (5, 5)}
TSFP_SIZE = {0: (2, 1), 2: (2, 1), 3: (2, 2), 4: (2, 2), 5: (2, 2), 10: (3, 1), 11: (3, 3),
             12: (3, 3), 13: (3, 3), 16: (3, 3), 18: (3, 1), 19: (3, 1), 20: (3, 3), 21: (3, 3),
             23: (3, 3), 24: (3, 3), 25: (3, 3), 26: (5, 3), 28: (2, 2), 29: (5, 3), 31: (3, 3),
             32: (3, 3), 33: (3, 3), 34: (2, 1), 39: (3, 3), 41: (3, 3), 43: (2, 2), 44: (2, 2)}
# TS2 1x1 corridor exits in the tile's local frame (E,N,W,S), statistically inferred.
TS2_EXITS = {1: 'ES', 2: 'NS', 9: 'NSW', 17: 'ENWS', 0: 'S@(0,0),N@(0,1)'}


def footprint(x, y, rot, w, h):
    """World cells covered by a tile anchored at (x,y) (min corner) with rotation rot."""
    out = []
    for i in range(w):
        for j in range(h):
            dx, dy = [(i, j), (h - 1 - j, i), (w - 1 - i, h - 1 - j), (j, w - 1 - i)][rot & 3]
            out.append((x + dx, y + dy))
    return out


# ---------------------------------------------------------------- GCI wrapper
def parse_gci(b):
    h = b[:64]
    return dict(
        gamecode=h[0:4].decode('latin-1'), maker=h[4:6].decode('latin-1'),
        banner_flags=h[7], filename=cstr(h[8:40]), mtime=u32(h, 0x28),
        image_offset=u32(h, 0x2C), icon_format=u16(h, 0x30), anim_speed=u16(h, 0x32),
        permissions=h[0x34], copy_counter=h[0x35], first_block=u16(h, 0x36),
        block_count=u16(h, 0x38), comment_offset=u32(h, 0x3C),
        comment1=cstr(b[0x40:0x60]), comment2=cstr(b[0x60:0x80]))


def walk_chunks(b, game):
    """Tagged chunks: [u32 tag][u32 size][size bytes]. Version tag and end tag carry no body."""
    base = TAG_BASE[game]
    o = DATA + 4 if game == 'TS2' else DATA + 8
    chunks, ended = [], False
    while o + 8 <= len(b):
        t, s = u32(b, o), u32(b, o + 4)
        if t & ~0xFF != base:
            break
        tid = t & 0xFF
        if tid == VERSION_TAG[game]:
            chunks.append((tid, o, s)); o += 8; continue
        if tid == END_TAG[game]:
            chunks.append((tid, o, s)); o += 8; ended = True; break
        if o + 8 + s > len(b):
            break
        chunks.append((tid, o, s)); o += 8 + s
    return chunks, o, ended


# ---------------------------------------------------------------- TS2
def ts2_settings(d):
    return dict(
        flags=u32(d, 0), tile_count=u32(d, 4), u16_08_theme_guess=u16(d, 8), u16_0a=u16(d, 0xA),
        u16_0c=u16(d, 0xC), weapon_slots_guess=[u16(d, 0xE + 2 * i) for i in range(10)],
        u16_22=u16(d, 0x22), u16_24_x5=[u16(d, 0x24 + 2 * i) for i in range(5)],
        name=cstr(d[0x42:0x62]), description=cstr(d[0x62:0x162]).rstrip(),
        briefing=cstr(d[0x162:0x362]).rstrip(), byte_362=d[0x362] if len(d) > 0x362 else None)


def ts2_tiles(b, o, s):
    p, e, recs = o + 8, o + 8 + s, []
    while p < e:
        k = u16(b, p + 10)
        rec = dict(type=u32(b, p), x=s8(b[p + 4]), y=s8(b[p + 5]), z=s8(b[p + 6]), rot=b[p + 7],
                   u16_08=u16(b, p + 8), color=b[p + 12:p + 16].hex(), u32_10=u32(b, p + 16),
                   attachments=[dict(kind=u16(b, q), id=u16(b, q + 2), u32_4=u32(b, q + 4),
                                     u32_8_junk=u32(b, q + 8)) for q in range(p + 20, p + 20 + 12 * k, 12)])
        recs.append(rec); p += 20 + 12 * k
    return recs, p == e


def decode_ts2(b, out):
    chunks, end, ended = walk_chunks(b, 'TS2')
    L = u32(b, DATA)
    out['container'] = dict(length_field=L, chunks=[('0x%02x' % t, o, s) for t, o, s in chunks],
                            end_marker_found=ended, end_offset=end,
                            length_consistent=(ended and end == DATA + L))
    unk = out['unknown']
    tiles, items = [], []
    for t, o, s in chunks:
        d = b[o + 8:o + 8 + s]
        if t == 0x27:
            st = ts2_settings(d)
            out['name'] = st['name']; out['description'] = st['description']; out['briefing'] = st['briefing']
            out['settings'] = st
        elif t == 0x28:
            recs, ok = ts2_tiles(b, o, s)
            out['container']['tile_chunk_ok'] = ok
            for i, r in enumerate(recs):
                w, h = TS2_SIZE.get(r['type'], (1, 1))
                tiles.append(dict(x=r['x'], y=r['y'], z=r['z'], type=r['type'], rot=r['rot'], w=w, h=h,
                                  exits=TS2_EXITS.get(r['type']), light_rgba=r['color'],
                                  raw=dict(u16_08=r['u16_08'], u32_10=r['u32_10'])))
                for a in r['attachments']:
                    items.append(dict(tile=i, x=r['x'], y=r['y'], z=r['z'], kind=a['kind'],
                                      slot_guess=a['id'] - 9000, raw=dict(u32_4=a['u32_4'])))
        elif t == 0x2B:
            unk.setdefault('chunk2b_ai_slots', []).append(dict(name=cstr(d[0:16]), hex=d.hex()))
        elif t not in (0x26,):
            unk.setdefault('chunk%02x' % t, []).append(d.hex())
    out['tiles'], out['items'] = tiles, items


# ---------------------------------------------------------------- TSFP
def fp_tiles(b, o, s):
    p, e, recs = o + 8, o + 8 + s, []
    while p < e:
        nitems, nl, rl = u32(b, p + 0x1C), u16(b, p + 0x20), u16(b, p + 0x24)
        if rl < 0x28 or rl > 0x400 or nitems > 64:
            return recs, False
        rec = dict(type=u32(b, p), x=b[p + 4], y=b[p + 5], z=s8(b[p + 6]), rot=b[p + 7],
                   b08=b[p + 8:p + 12].hex(), color1=b[p + 12:p + 16].hex(), color2=b[p + 16:p + 20].hex(),
                   u32_14=u32(b, p + 0x14), f32_18=round(f32(b, p + 0x18), 4), u16_22=u16(b, p + 0x22),
                   links=[(u16(b, q), u16(b, q + 2), u32(b, q + 4)) for q in range(p + 0x28, p + 0x28 + 8 * nl, 8)])
        q, its = p + rl, []
        for _ in range(nitems):
            n = b[q + 0x14]
            if n > 16:
                return recs, False
            its.append(dict(u32_0=u32(b, q), u32_4=u32(b, q + 4), u32_8=u32(b, q + 8), kind=u32(b, q + 0xC),
                            sub=u16(b, q + 0x10), u16_12=u16(b, q + 0x12), b14=b[q + 0x14:q + 0x18].hex(),
                            refs=[u32(b, q + 0x18 + 4 * j) for j in range(n)]))
            q += 0x18 + 4 * n
        rec['items'] = its
        recs.append(rec); p = q
    return recs, p == e


def decode_tsfp(b, out):
    chunks, end, ended = walk_chunks(b, 'TSFP')
    L = u32(b, DATA)
    out['container'] = dict(length_field=L, checksum_field='0x%08x' % u32(b, DATA + 4),
                            chunks=[('0x%02x' % t, o, s) for t, o, s in chunks], end_marker_found=ended,
                            end_offset=end, length_consistent=(ended and end == DATA + 4 + L))
    unk = out['unknown']
    tiles, items = [], []
    for t, o, s in chunks:
        d = b[o + 8:o + 8 + s]
        if t == 0x68:
            st = dict(u32_00=u32(d, 0), tile_count=u32(d, 4), u16_08=u16(d, 8), u16_0a=u16(d, 0xA),
                      u32_0c=u32(d, 0xC), weapon_slots_guess=[d[0x18 + 4 * i:0x1C + 4 * i].hex() for i in range(10)],
                      name=cstr(d[0x62:0x76]), description=cstr(d[0x76:0x156]).rstrip(),
                      briefing=cstr(d[0x156:0x238]).rstrip(), tail_hex=d[0x238:].hex())
            out['name'] = st['name']; out['description'] = st['description']; out['briefing'] = st['briefing']
            out['settings'] = st
        elif t == 0x69:
            recs, ok = fp_tiles(b, o, s)
            out['container']['tile_chunk_ok'] = ok
            for i, r in enumerate(recs):
                w, h = TSFP_SIZE.get(r['type'], (1, 1))
                tiles.append(dict(x=r['x'], y=r['y'], z=r['z'], type=r['type'], rot=r['rot'], w=w, h=h,
                                  light_rgba=r['color1'],
                                  raw=dict(b08=r['b08'], color2=r['color2'], u32_14=r['u32_14'],
                                           f32_18=r['f32_18'], u16_22=r['u16_22'], cell_links=r['links'])))
                for it in r['items']:
                    items.append(dict(tile=i, x=r['x'], y=r['y'], z=r['z'], kind=it['kind'] & 0xFF,
                                      facing_guess=it['sub'], raw=it))
        elif t == 0x72:
            out['palette_rgba'] = [d[i:i + 4].hex() for i in range(0, len(d), 4)]
        elif t == 0x73:
            unk['chunk73_labels'] = [cstr(d[i:i + 0x40]) for i in range(0, len(d), 0x40)]
        elif t not in (0x67,):
            unk.setdefault('chunk%02x' % t, []).append(d.hex())
    out['tiles'], out['items'] = tiles, items


# ---------------------------------------------------------------- driver
def ascii_preview(out):
    tiles = out['tiles']
    if not tiles:
        return '(no tiles)\n'
    sym = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    cells = {}
    for t in tiles:
        for k, c in enumerate(footprint(t['x'], t['y'], t['rot'], t['w'], t['h'])):
            key = (c[0], c[1], t['z'])
            if (t['x'], t['y']) == c:
                cells[key] = sym[t['type'] % 62] + '>^<v'[t['rot'] & 3]
            elif key not in cells:
                cells[key] = '::'
    xs = [k[0] for k in cells]; ys = [k[1] for k in cells]
    lines = ['%s  (%s)  grid x %d..%d, y %d..%d; anchor = type(base36)+rot arrow, :: = covered by footprint'
             % (out.get('name'), out['game'], min(xs), max(xs), min(ys), max(ys))]
    for z in sorted(set(k[2] for k in cells)):
        lines.append('z=%d' % z)
        for y in range(max(ys), min(ys) - 1, -1):
            lines.append('%4d ' % y + ''.join(cells.get((x, y, z), ' .') for x in range(min(xs), max(xs) + 1)))
    return '\n'.join(lines) + '\n'


def decode(path):
    b = open(path, 'rb').read()
    hdr = parse_gci(b)
    out = dict(file=os.path.basename(path), gci=hdr, unknown={})
    if 'MapMaker' not in hdr['comment2']:
        out['game'] = None; out['error'] = 'not a MapMaker map (comment2=%r)' % hdr['comment2']
        return out
    out['game'] = 'TS2' if hdr['gamecode'] == 'GTSE' else 'TSFP'
    (decode_ts2 if out['game'] == 'TS2' else decode_tsfp)(b, out)
    out['levels'] = sorted(set(t['z'] for t in out['tiles']))
    st = out.get('settings', {})
    out['container']['tile_count_matches_header'] = st.get('tile_count') == len(out['tiles'])
    c = out['container']
    out['valid'] = bool(c.get('tile_chunk_ok') and c['tile_count_matches_header'] and c['length_consistent'])
    return out


def main():
    outdir = sys.argv[1]; os.makedirs(outdir, exist_ok=True)
    summary = []
    for p in sys.argv[2:]:
        o = decode(p)
        stem = os.path.join(outdir, os.path.basename(p))
        with open(stem + '.json', 'w') as f:
            json.dump(o, f, indent=1)
        if o.get('game'):
            with open(stem + '.txt', 'w') as f:
                f.write(ascii_preview(o))
        summary.append((o['file'], o.get('game'), o.get('name'), len(o.get('tiles', [])), len(o.get('items', [])),
                        o.get('valid'), o.get('error', '')))
    for s in summary:
        print('%-40s %-5s %-22s tiles=%-4s items=%-4s valid=%s %s' % s)


if __name__ == '__main__':
    main()
