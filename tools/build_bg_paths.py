#!/usr/bin/env python3
# 从 10 张卡通战场底图提取「土路行进线」，输出 assets/bg/paths.json
#
# 做法（逐行跟踪，不依赖最短路）：
#   - 严格土路掩膜（暖橙色）；
#   - 从第一条成形的土路行开始，每行找「离上一行中心最近的路段」；
#   - 宽路段（横向路面）用夹取保持横向连续，窄路段取中点；
#   - 平滑 + 等距采样，供运行时 pathAt(d) 插值。
import json
import os

from PIL import Image

BG_DIR = 'assets/bg'
W, H = 720, 1280


def road(p):
    r, g, b = p
    return r > 198 and (r - g) > 33 and 110 < g < 240 and 55 < b < 208


def runs(row, minlen=14):
    out, s = [], None
    for x in range(W + 1):
        v = row[x] if x < W else False
        if v and s is None:
            s = x
        elif not v and s is not None:
            if x - s >= minlen:
                out.append((s, x))
            s = None
    return out


def build(idx):
    im = Image.open(os.path.join(BG_DIR, 'ga%d.webp' % idx)).convert('RGB').resize((W, H))
    px = im.load()
    rows = {y: runs([road(px[x, y]) for x in range(W)]) for y in range(H)}

    top = next((y for y in range(H) if any(r[1] - r[0] >= 50 for r in rows[y])), None)
    bot = next((y for y in range(H - 1, -1, -1) if any(r[1] - r[0] >= 50 for r in rows[y])), None)
    if top is None or bot is None or bot - top < 300:
        return None

    # 起点：往下 40px 内选「离画面中线最近、且够宽」的路段，避开顶部岸边
    sy = min(top + 40, max(top, bot - 320))
    cand_rows = [y for y in range(sy, min(sy + 40, bot)) if any(r[1] - r[0] >= 60 for r in rows[y])]
    if not cand_rows:
        cand_rows = [top]
    y0 = cand_rows[0]
    start = min([r for r in rows[y0] if r[1] - r[0] >= 60] or rows[y0], key=lambda r: abs((r[0] + r[1]) / 2 - 360))
    prev = (start[0] + start[1]) // 2
    pts = [(prev, y0)]
    for y in range(y0 + 2, bot + 1, 2):
        rs = rows[y]
        if not rs:
            continue
        near = min(rs, key=lambda r: 0 if r[0] <= prev <= r[1] else min(abs(prev - r[0]), abs(prev - r[1])))
        wdt = near[1] - near[0]
        if wdt > 130:
            cx = max(near[0] + 18, min(near[1] - 18, prev))
        else:
            cx = (near[0] + near[1]) // 2
            if abs(cx - prev) > 120:
                cx = prev
        pts.append((cx, y))
        prev = cx

    sm = []
    for i in range(len(pts)):
        a = pts[max(0, i - 6):i + 7]
        sm.append((int(sum(p[0] for p in a) / len(a)), int(sum(p[1] for p in a) / len(a))))

    out = [sm[0]]
    acc = 0
    for i in range(1, len(sm)):
        acc += abs(sm[i][0] - sm[i - 1][0]) + abs(sm[i][1] - sm[i - 1][1])
        if acc >= 55:
            out.append(sm[i])
            acc = 0
    if out[-1] != sm[-1]:
        out.append(sm[-1])

    # 去掉开头落在水面上方/岸边的点（水是明显的蓝色）
    def is_water(x, y):
        for dy in (0, 8, 16, 26):
            yy = min(H - 1, y + dy)
            r, g, b = px[max(0, min(W - 1, x)), yy]
            if b > 150 and b > r + 30:
                return True
        return False

    while len(out) > 5 and is_water(out[0][0], out[0][1]):
        out.pop(0)
    return out


def main():
    res = {}
    for i in range(1, 11):
        if not os.path.exists(os.path.join(BG_DIR, 'ga%d.webp' % i)):
            continue
        p = build(i)
        if not p or len(p) < 4:
            print('ga%d 提取失败（运行时退回直线）' % i)
            continue
        res[str(i)] = {'pts': [[int(x), int(y)] for (x, y) in p]}
        print('ga%d %d 点  y%d->%d' % (i, len(p), p[0][1], p[-1][1]))
    dst = os.path.join(BG_DIR, 'paths.json')
    with open(dst, 'w') as f:
        json.dump(res, f, separators=(',', ':'))
    print('已写入 %s (%d bytes)' % (dst, os.path.getsize(dst)))


if __name__ == '__main__':
    main()
