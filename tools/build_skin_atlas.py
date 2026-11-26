#!/usr/bin/env python3
"""把 assets/skin/*.webp 打包成单张图集（大幅减少公网请求数）。
产出 assets/skin/atlas.webp + atlas.json；超大整图（背景板等）不进图集。"""
import json, os, glob, math
from PIL import Image

SKIN = 'assets/skin'
PAD = 2
BIG = 1400          # 单边超过这个尺寸的不进图集（自己单独请求）
files = sorted(f for f in glob.glob(os.path.join(SKIN, '*.webp')))
items, skipped = [], []
for f in files:
    im = Image.open(f).convert('RGBA')
    (skipped if max(im.size) > BIG else items).append((os.path.basename(f), im))

area = sum((im.width + PAD) * (im.height + PAD) for _, im in items)
side = int(math.sqrt(area)) + 256
ncol = max(1, round(side / 512))
# 按高度降序，轮流放进最低的列（贪心平衡）
cols = [[] for _ in range(ncol)]
colw = [0] * ncol
colh = [0] * ncol
for name, im in sorted(items, key=lambda t: -t[1].height):
    i = colh.index(min(colh))
    cols[i].append((name, im))
    colw[i] = max(colw[i], im.width + PAD)
    colh[i] += im.height + PAD

place = {}
x = 0
W = 0
H = 0
for i in range(ncol):
    y = 0
    for name, im in cols[i]:
        place[name] = (x, y, im.width, im.height)
        y += im.height + PAD
    H = max(H, y)
    x += colw[i]
W = x

atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for name, im in items:
    px, py, pw, ph = place[name]
    atlas.paste(im, (px, py))

atlas.save(os.path.join(SKIN, 'atlas.webp'), 'WEBP', quality=86, method=6)
with open(os.path.join(SKIN, 'atlas.json'), 'w', encoding='utf-8') as fp:
    json.dump({'w': W, 'h': H, 'files': {k: {'x': v[0], 'y': v[1], 'w': v[2], 'h': v[3]}
                                         for k, v in place.items()},
               'skip': [n for n, _ in skipped]}, fp, ensure_ascii=False)
print('atlas', W, 'x', H, 'packed', len(place), 'skip', len(skipped),
      round(os.path.getsize(os.path.join(SKIN, 'atlas.webp')) / 1024), 'KB')
