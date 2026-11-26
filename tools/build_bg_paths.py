#!/usr/bin/env python3
# 从 10 张卡通战场底图里提取「土路中心线」，输出 assets/bg/paths.json
# 敌人沿这条线走，不再站到水面/草地上。底图坐标 = 720x1280（与运行时画布一致）
import json, os
from collections import deque
from PIL import Image

BG_DIR = 'assets/bg'
W, H = 720, 1280


def road_mask(px, w, h):
    m = [[False] * w for _ in range(h)]
    for y in range(h):
        row = m[y]
        for x in range(w):
            r, g, b = px[x, y]
            # 土路是暖橙色：红远高于绿，蓝低；草地绿强于红，水面蓝强
            if r > 200 and (r - g) > 35 and 110 < g < 238 and 60 < b < 205:
                row[x] = True
    return m


def runs_in_row(m, y, w, minlen=16):
    out, s = [], None
    for x in range(w + 1):
        v = m[y][x] if x < w else False
        if v and s is None:
            s = x
        elif not v and s is not None:
            if x - s >= minlen:
                out.append((s, x))
            s = None
    return out


def extract(idx):
    im = Image.open(os.path.join(BG_DIR, 'ga%d.webp' % idx)).convert('RGB').resize((W, H))
    px = im.load()
    m = road_mask(px, W, H)
    rows = {}
    for y in range(H):
        rows[y] = runs_in_row(m, y, W)
    tops = [y for y in range(H) if rows[y]]
    if not tops:
        return None
    y0 = tops[0]
    # 入口：最上面那一行里最长的一段
    seg = max(rows[y0], key=lambda s: s[1] - s[0])
    lanes = [((seg[0] + seg[1]) // 2, y0)]
    # 逐行跟踪：每 12px 选中心最接近上一行的路段
    prev = lanes[0][0]
    step = 12
    last_y = y0
    for y in range(y0 + step, H, step):
        cand = rows.get(y) or []
        if not cand:
            continue
        best = min(cand, key=lambda s: abs((s[0] + s[1]) // 2 - prev))
        c = (best[0] + best[1]) // 2
        # 只允许缓慢横移，跳变说明串到另一条路了
        if abs(c - prev) > 90:
            continue
        lanes.append((c, y))
        prev = c
        last_y = y
    # 采样：y 每 ~40px 一个点
    pts, lastk = [], -99
    for (x, y) in lanes:
        if y - lastk >= 40:
            pts.append([int(x), int(y)])
            lastk = y
    if lanes[-1][1] - lastk > 12:
        pts.append([int(lanes[-1][0]), int(lanes[-1][1])])
    return {'pts': pts, 'y0': y0, 'y1': last_y}


def main():
    out = {}
    for i in range(1, 11):
        p = os.path.join(BG_DIR, 'ga%d.webp' % i)
        if not os.path.exists(p):
            continue
        r = extract(i)
        if r and len(r['pts']) >= 4:
            out[str(i)] = r
            print('ga%d' % i, 'points', len(r['pts']), 'y', r['y0'], '->', r['y1'])
    with open(os.path.join(BG_DIR, 'paths.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote assets/bg/paths.json', os.path.getsize(os.path.join(BG_DIR, 'paths.json')))


if __name__ == '__main__':
    main()
