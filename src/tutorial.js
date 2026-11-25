// ============================================================
//  新手引导：首次进入的新档走 4 步，只高亮不锁交互（点高亮区照常生效）
//  进度存 Player.tutorialStep（0 = 已完成）
// ============================================================
const TUT_STEPS = [
  {
    scene: 'LevelSelectScene',
    text: '点关卡卡片上的 Battle，开始你的第一场守城战',
    box: () => ({ x: SEL.mid.x, y: SEL.cards.y, w: SEL.mid.w, h: SEL.cards.h + 20 })
  },
  {
    scene: 'BattleScene',
    text: '技能图标亮起就点它，右下三个是英雄技能；敌人会一直往城墙走',
    box: () => ({ x: 8, y: 1050, w: 258, h: 120 })
  },
  {
    scene: 'BattleScene',
    text: '城墙血条见底就是输了；输了也能拿部分金币，重来就好',
    box: () => ({ x: 8, y: 8, w: W - 240, h: 56 })
  },
  {
    scene: 'LevelSelectScene',
    text: '点顶部星星图标看成就；下方的 STAR MILESTONE 达标就能领奖励',
    box: () => ({ x: W - 138, y: 8, w: 76, h: 66 })
  }
];

const Tutorial = {
  get step() { return Player && Player.tutorialStep ? Player.tutorialStep : 0; },

  active() { return this.step > 0 && this.step <= TUT_STEPS.length; },

  cur() { return this.active() ? TUT_STEPS[this.step - 1] : null; },

  start() {
    if (!Player.tutorialStep) { Player.tutorialStep = 1; Player.save(); }
  },

  finish() { Player.tutorialStep = 0; Player.save(); },

  // 场景切换时自动推进（不强制，玩家可以停在某步）
  sync(sceneName) {
    if (!this.active()) return;
    const c = this.cur();
    if (!c) return;
    if (sceneName === 'BattleScene' && this.step === 1) { Player.tutorialStep = 2; Player.save(); }
    // 提前回到选关页：跳过战斗相关的两步，直接指向成就/里程碑
    if (sceneName === 'LevelSelectScene' && this.step >= 2 && this.step <= 3) { Player.tutorialStep = 4; Player.save(); }
  },

  next() {
    if (!this.active()) return;
    if (this.step >= TUT_STEPS.length) { this.finish(); return; }
    Player.tutorialStep = this.step + 1; Player.save();
  },

  draw(ctx) {
    const c = this.cur();
    const g = window.game;
    if (!c || !g || !g.scene) return;
    if (g.scene.constructor.name !== c.scene) return;

    const b = c.box();
    // 全屏压暗 + 高亮挖洞
    ctx.save();
    ctx.fillStyle = 'rgba(3,7,12,0.62)';
    const hx = b.x - 6, hy = b.y - 6, hw = b.w + 12, hh = b.h + 12;
    // 用四块压暗矩形拼出亮区（clearRect 会把底下场景一起擦成透明）
    ctx.fillRect(0, 0, W, Math.max(0, hy));
    ctx.fillRect(0, hy + hh, W, Math.max(0, H - (hy + hh)));
    ctx.fillRect(0, hy, Math.max(0, hx), hh);
    ctx.fillRect(hx + hw, hy, Math.max(0, W - (hx + hw)), hh);
    // 高亮描边（呼吸）
    const t = (Date.now() % 1600) / 1600;
    ctx.strokeStyle = 'rgba(255,207,92,' + (0.55 + 0.35 * Math.sin(t * Math.PI * 2)) + ')';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
    ctx.restore();

    // 说明气泡：高亮在上半屏就放下面，反之放上面
    const bw = W - 60, bh = 154;
    const bx = 30, by = (b.y + b.h / 2 < H / 2) ? (b.y + b.h + 26) : Math.max(70, b.y - bh - 26);
    roundRect(ctx, bx, by, bw, bh, 12, 'rgba(10,16,24,0.96)', '#e8b548', 2);
    text(ctx, '新手引导  ' + this.step + '/' + TUT_STEPS.length, bx + 20, by + 24, 12, '#ffcf5c', 'left');
    text(ctx, c.text, bx + 20, by + 56, 14, '#e8eef6', 'left');
    // 按钮
    roundRect(ctx, bx + bw - 210, by + bh - 52, 90, 36, 8, '#22303d', '#5a7f9e', 1);
    text(ctx, '跳过', bx + bw - 165, by + bh - 34, 13, '#9fd0ff', 'center');
    roundRect(ctx, bx + bw - 108, by + bh - 52, 92, 36, 8, '#c58a1c', '#ffdf9a', 1);
    text(ctx, this.step >= TUT_STEPS.length ? '开始玩' : '下一步', bx + bw - 62, by + bh - 34, 13, '#fff', 'center', '#1a1206');
    this._btn = { skip: { x: bx + bw - 210, y: by + bh - 52, w: 90, h: 36 }, next: { x: bx + bw - 108, y: by + bh - 52, w: 92, h: 36 } };
  },

  hit(p) {
    if (!this.active()) return false;
    const c = this.cur(), g = window.game;
    if (!c || !g || !g.scene || g.scene.constructor.name !== c.scene) return false;
    const btn = this._btn;
    if (!btn) return false;
    const inside = r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (inside(btn.skip)) { this.finish(); if (g.playSfx) g.playSfx('sfx_close', 0.3); return true; }
    if (inside(btn.next)) { this.next(); if (g.playSfx) g.playSfx('sfx_click', 0.3); return true; }
    // 气泡与高亮以外的点击被吞掉，避免误触；高亮区放行给场景
    const b = c.box();
    if (p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) return false;
    return true;
  }
};
window.Tutorial = Tutorial;
