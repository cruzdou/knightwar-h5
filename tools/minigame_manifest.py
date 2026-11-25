#!/usr/bin/env python3
"""生成抖音小游戏分包清单（主包 / 分包体积核算）。

依据：
  1) tools/art_usage.txt —— playwright 走过选关/商店/锻造/英雄/城堡/每日/盟友/战斗
     全部入口后，真实被请求过的 art 文件名（新增界面后需重跑刷新）。
  2) data/*.json 里出现的贴图路径 —— 列表图标即使当前没滚到，也按「可能会用」保留。
  3) 其余 art 视为原包遗留资源（多为 Unity TMP 字体图集），不进任何包。

输出 minigame/package_manifest.json，并打印各包体积与 4MB 校验。
用法：python3 tools/minigame_manifest.py
"""
import json, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN_LIMIT = 4 * 1048576
BIG = 100 * 1024

def sz(p):
    return os.path.getsize(p) if os.path.isfile(p) else 0

def rel(p):
    return os.path.relpath(p, ROOT)

def gather_refs():
    refs = set()
    def walk(o):
        if isinstance(o, dict):
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
        elif isinstance(o, str) and re.search(r'\.(png|webp)$', o, re.I):
            refs.add(os.path.basename(o).rsplit('.', 1)[0])
    for f in glob.glob(os.path.join(ROOT, 'data', '*.json')):
        try: walk(json.load(open(f, encoding='utf-8')))
        except Exception: pass
    for f in glob.glob(os.path.join(ROOT, 'src', '*.js')):
        for m in re.findall(r"['\"]([^'\"/]+?\.[a-zA-Z0-9]{2,4})['\"]", open(f, encoding='utf-8').read()):
            refs.add(m.rsplit('.', 1)[0])
    return refs

def main():
    seen = {l.strip().rsplit('.', 1)[0] for l in open(os.path.join(ROOT, 'tools', 'art_usage.txt'), encoding='utf-8') if l.strip()}
    refs = gather_refs()
    needed = seen | refs

    main_files, bg_files, battle_files, audio_files = [], [], [], []
    for p in ['index.html', 'serve.js']:
        f = os.path.join(ROOT, p)
        if os.path.isfile(f): main_files.append(rel(f))
    for d in ['src', 'data', 'vendor']:
        main_files += [rel(p) for p in glob.glob(os.path.join(ROOT, d, '**', '*'), recursive=True) if os.path.isfile(p)]
    main_files += [rel(p) for p in glob.glob(os.path.join(ROOT, 'assets', 'char', '*')) if os.path.isfile(p)]

    legacy = []
    for p in glob.glob(os.path.join(ROOT, 'assets', 'art', '*')):
        if not os.path.isfile(p): continue
        name = os.path.basename(p).rsplit('.', 1)[0]
        if name not in needed:
            legacy.append(p)
        elif sz(p) > BIG:
            bg_files.append(rel(p))
        else:
            main_files.append(rel(p))

    # 骨架全部进 pkg_battle：进战斗前 tt.loadSubpackage 一次，主包只留 UI/数据
    core_spine = set()
    for p in glob.glob(os.path.join(ROOT, 'assets', 'spine', '*')):
        if not os.path.isfile(p): continue
        stem = os.path.basename(p).split('.')[0]
        (main_files if stem in core_spine else battle_files).append(rel(p))

    audio_files = [rel(p) for p in glob.glob(os.path.join(ROOT, 'assets', 'audio', '*')) if os.path.isfile(p)]

    packs = {
        'main': main_files,
        'pkg_bg': bg_files,
        'pkg_battle': battle_files,
        'pkg_audio': audio_files,
    }
    out = {'main_limit_mb': 4, 'packages': {}, 'legacy_excluded': len(legacy)}
    print('%-11s %6s %9s' % ('包', '文件', '体积'))
    for k, files in packs.items():
        b = sum(sz(os.path.join(ROOT, f)) for f in files)
        out['packages'][k] = {'count': len(files), 'bytes': b, 'mb': round(b / 1048576, 2), 'file_list': files}
        print('%-11s %6d %7.2f MB' % (k, len(files), b / 1048576))
    total = sum(v['bytes'] for v in out['packages'].values())
    print('%-11s %6s %7.2f MB' % ('合计', '-', total / 1048576))
    main_b = out['packages']['main']['bytes']
    print('主包校验：%s' % ('OK ≤4MB' if main_b <= MAIN_LIMIT else '超出 %.2f MB' % ((main_b - MAIN_LIMIT) / 1048576)))
    print('排除了 %d 个原包遗留美术（约 %.2f MB）' % (len(legacy), sum(sz(p) for p in legacy) / 1048576))
    os.makedirs(os.path.join(ROOT, 'minigame'), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, 'minigame', 'package_manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
