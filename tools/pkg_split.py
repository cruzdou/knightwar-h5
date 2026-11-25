#!/usr/bin/env python3
"""包体划分报告：把工程文件按「抖音小游戏 主包 / 分包」规则估算体积。

用法：python3 tools/pkg_split.py
输出：每个包的文件数、体积（未压缩字节），以及主包是否满足 4MB 限制。
规则（改 CORE_SPINE / UI_ART 名单即可调整）：
  main    —— 入口、脚本、数据表、字体/UI 图、主角与小怪骨架（首屏与第一关必须）
  bg      —— art 里超过 BIG_ART 的背景大图（按需加载）
  battle  —— 其余战斗骨架（区域敌人 / Boss / 技能特效）
  audio   —— 全部音频（首屏不播放，进入战斗前预载）
"""
import os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIG_ART = 100 * 1024          # art 里超过 100KB 视为背景/大图，进 bg 包
CORE_SPINE = ['Elf_Archer', 'Bandit', 'Goblin', 'Gnoll', 'Wolf', 'Boss_Golem', 'Seraph']

def sz(p):
    try: return os.path.getsize(p)
    except OSError: return 0

def collect(rel):
    return [p for p in glob.glob(os.path.join(ROOT, rel, '**', '*'), recursive=True) if os.path.isfile(p)]

def main():
    groups = {'main': [], 'bg': [], 'battle': [], 'audio': []}
    for rel in ['index.html', 'index_cdn.html', 'serve.js']:
        p = os.path.join(ROOT, rel)
        if os.path.isfile(p): groups['main'].append(p)
    for rel in ['src', 'data', 'vendor']:
        groups['main'] += collect(rel)
    for p in collect('assets/art'):
        (groups['bg'] if sz(p) > BIG_ART else groups['main']).append(p)
    groups['main'] += collect('assets/char')
    for p in collect('assets/spine'):
        stem = os.path.basename(p).split('.')[0]
        (groups['main'] if stem in CORE_SPINE else groups['battle']).append(p)
    groups['audio'] += collect('assets/audio')

    print('%-8s %6s %10s' % ('包', '文件数', '体积'))
    total = 0
    for k, files in groups.items():
        b = sum(sz(p) for p in files)
        total += b
        print('%-8s %6d %8.2f MB' % (k, len(files), b / 1048576))
        if k == 'main':
            ok = 'OK（≤4MB）' if b <= 4 * 1048576 else '超出 %.2f MB' % ((b - 4 * 1048576) / 1048576)
            print('        主包 4MB 限制：%s' % ok)
    print('%-8s %6s %8.2f MB' % ('合计', '-', total / 1048576))

if __name__ == '__main__':
    main()
