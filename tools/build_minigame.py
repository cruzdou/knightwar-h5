#!/usr/bin/env python3
"""按 minigame/package_manifest.json 生成抖音小游戏目录 build/minigame。

- main 包：入口/脚本/数据/UI，data/*.json 会压缩成一行（省约 45%）
- 分包：pkg_bg / pkg_battle / pkg_audio，运行时用 tt.loadSubpackage 按需拉
- 生成 game.json（subpackages 配置）与 project.config.json（占位 appid）
用法：python3 tools/minigame_manifest.py && python3 tools/build_minigame.py
"""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'build', 'minigame')
MANI = os.path.join(ROOT, 'minigame', 'package_manifest.json')

def minify_json(src, dst):
    data = json.load(open(src, encoding='utf-8'))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, separators=(',', ':')))

def copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


# ---------- game.js：适配层 + PKG_MAP + 业务脚本拼接 ----------
import re

def script_order():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    return re.findall(r'<script src="([^"]+)"', html)

def build_game_js(mani):
    scripts = [f for f in script_order() if f.startswith('src/') or f.startswith('vendor/')]
    out = []
    out.append(open(os.path.join(ROOT, 'minigame', 'adapter.js'), encoding='utf-8').read())
    out.append('\n/* 分包资源表：路径 -> 分包名（由 tools/build_minigame.py 生成） */\nwindow.PKG_MAP = ' +
               json.dumps({f: n for n, info in mani['packages'].items() if n != 'main' for f in info['file_list']},
                          ensure_ascii=False) + ';\n')
    for f in scripts:
        out.append('\n/* ===== ' + f + ' ===== */\n' + open(os.path.join(ROOT, f), encoding='utf-8').read())
    open(os.path.join(OUT, 'game.js'), 'w', encoding='utf-8').write('\n'.join(out))
    return len(scripts)

def main():
    if not os.path.isfile(MANI):
        raise SystemExit('先跑 tools/minigame_manifest.py')
    mani = json.load(open(MANI, encoding='utf-8'))
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    packs = mani['packages']
    for name, info in packs.items():
        for f in info['file_list']:
            # 小游戏入口是 game.js（脚本已拼接进去），这些不再单独拷贝
            if name == 'main' and (f.startswith('src/') or f.startswith('vendor/') or f.startswith('index') or f == 'serve.js') : continue
            src = os.path.join(ROOT, f)
            dst = os.path.join(OUT, f if name == 'main' else os.path.join('subpackages', name, f))
            if f.endswith('.json') and f.startswith('data/'):
                minify_json(src, dst)
            else:
                copy(src, dst)

    n_scripts = build_game_js(mani)
    cfg = {
        'deviceOrientation': 'portrait',
        'showStatusBar': False,
        'networkTimeout': {'request': 60000, 'downloadFile': 60000},
        'subpackages': [{'name': n, 'root': 'subpackages/' + n} for n in packs if n != 'main'],
        'subpackagesCountLimit': 4,
    }
    open(os.path.join(OUT, 'game.json'), 'w', encoding='utf-8').write(json.dumps(cfg, ensure_ascii=False, indent=2))
    proj = {'appid': 'tt0000000000000000', 'projectname': 'knightwar-minigame', 'setting': {'es6': True, 'minified': True}}
    open(os.path.join(OUT, 'project.config.json'), 'w', encoding='utf-8').write(json.dumps(proj, ensure_ascii=False, indent=2))

    def total(d):
        s = n = 0
        for r, _, fs in os.walk(d):
            for f in fs:
                s += os.path.getsize(os.path.join(r, f)); n += 1
        return s, n
    main_dir = OUT
    mb = n = 0
    for r, dirs, fs in os.walk(main_dir):
        if 'subpackages' in dirs: dirs.remove('subpackages')
        for f in fs:
            mb += os.path.getsize(os.path.join(r, f)); n += 1
    print('输出 %s：%d 个文件，%.2f MB' % (os.path.relpath(OUT, ROOT), n, mb / 1048576))
    for name in packs:
        sub = OUT if name == 'main' else os.path.join(OUT, 'subpackages', name)
        if name == 'main':
            s = c = 0
            for r, dirs, fs in os.walk(OUT):
                if 'subpackages' in dirs: dirs.remove('subpackages')
                for f in fs:
                    s += os.path.getsize(os.path.join(r, f)); c += 1
        else:
            s, c = total(sub)
        print('  %-11s %5d 个 %6.2f MB' % (name, c, s / 1048576))

if __name__ == '__main__':
    main()
