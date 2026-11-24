// ============================================================
//  Raid 场景：消耗 Raid 票挑战已首通的 Boss 关（血量 ×2、金币/材料 ×2）
//  票的种类来自 TreasureBox.json 的 raidTicketXxx，本表没有 Raid 关卡配置，
//  所以按 Boss 关顺序每 5 关升一档票（普通→中→高→超）。
// ============================================================

const RAID_KINDS = [
  { key: 'normal', label: '普通', color: '#c9d6e2' },
  { key: 'medium', label: '中级', color: '#5fd08a' },
  { key: 'hard', label: '高级', color: '#7fc6ff' },
  { key: 'super', label: '传说', color: '#ffcf5c' }
];

class RaidScene {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.hot = [];
    this.toast = '';
    this.toastT = 0;
    this.page = 0;
    this.per = 6;
    const sel = game.select;
    this.tex = (sel && sel.tex) || {};
    this.bosses = ((sel && sel.levels) || []).filter(l => l.levelType === 'bigBoss');
    this.time = 0;
  }

  kindOf(i) { return RAID_KINDS[Math.min(3, Math.floor(i / 5))]; }

  say(t) { this.toast = t; this.toastT = 2.2; }

  update(dt) {
    this.time += dt;
    if (this.toastT > 0) this.toastT -= dt;
  }

  toLocal(ev) {
    const r = this.g.cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
  }

  draw() {
    const ctx = this.ctx;
    this.hot = [];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1a26');
    g.addColorStop(1, '#070b11');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawTopBar(ctx, this.tex, Player, this.hot);

    // 返回按钮（顶栏右上角是齿轮，返回放下方）
    roundRect(ctx, 12, 78, 92, 42, 8, '#16202d', '#33475e', 2);
    text(ctx, '‹ 返回', 58, 99, 16, '#9fb2c6', 'center');
    this.hot.push({ x: 12, y: 78, w: 92, h: 42, act: 'back' });

    // 标题
    roundRect(ctx, 12, 132, W - 24, 52, 9, '#141d29', '#6d5a2c', 2);
    text(ctx, 'RAID · 强敌挑战', 26, 158, 20, '#ffe9a8', 'left', '#000');
    text(ctx, '票 ' + Player.raidTicketTotal() + ' 张', W - 26, 158, 13, '#8fa3b7', 'right');

    // 票条：四种票各自数量
    const tw = (W - 24 - 3 * 8) / 4;
    RAID_KINDS.forEach((k, i) => {
      const x = 12 + i * (tw + 8), y = 196;
      roundRect(ctx, x, y, tw, 54, 8, '#16202d', k.color, 1);
      text(ctx, k.label, x + tw / 2, y + 17, 12, k.color, 'center');
      text(ctx, String(Player.raidTickets[k.key] || 0), x + tw / 2, y + 39, 17, '#e8eef6', 'center');
    });

    text(ctx, '规则：消耗 1 张票挑战已首通的 Boss 关，敌人血量 ×2、金币与材料 ×2；失败不退票。',
      14, 268, 12, '#8fa3b7', 'left');

    const start = this.page * this.per;
    const rows = this.bosses.slice(start, start + this.per);
    const rowH = 104, top = 292;
    rows.forEach((st, i) => {
      const idx = start + i;
      const kind = this.kindOf(idx);
      const y = top + i * (rowH + 8);
      const cleared = Player.isBossCleared(st.name);
      const own = (Player.raidTickets[kind.key] || 0) > 0;
      roundRect(ctx, 12, y, W - 24, rowH, 10, '#131d29', cleared ? '#3f6a8f' : '#2a3543', 2);
      // 左侧票标
      roundRect(ctx, 24, y + 24, 56, 56, 8, '#0e1620', kind.color, 1);
      text(ctx, kind.label, 52, y + 44, 13, kind.color, 'center');
      text(ctx, '×1', 52, y + 63, 11, '#9fb2c6', 'center');

      text(ctx, 'Stage ' + st.name, 96, y + 32, 18, '#e8eef6', 'left');
      text(ctx, (st.zoneName || '') + ' · 敌人 ' + (st.totalEnemy || '?') + ' 只', 96, y + 56, 12, '#8fa3b7', 'left');
      const mm = (st.minMaterial || 0);
      text(ctx, cleared ? '奖励 ×2：金币 ' + Math.round((st.levelCoins || 0) * 2) + (mm ? ' · 保底材料 ' + mm + ' → ' + mm * 2 : '') + ' · 掉落率翻倍'
        : '需先首通该关（普通关卡里打一次）', 96, y + 82, 12, cleared ? '#9fe6a8' : '#ff9a8a', 'left');

      const bw = 150, bh = 54, bx = W - 12 - bw - 16, by = y + 25;
      const ok = cleared && own;
      roundRect(ctx, bx, by, bw, bh, 10, ok ? '#c58a1c' : '#2a3543', ok ? '#ffdf9a' : '#4a5a70', 2);
      text(ctx, ok ? '挑战 · 1 票' : (cleared ? '票不足' : '未首通'), bx + bw / 2, by + bh / 2, 15, ok ? '#fff' : '#8fa3b7', 'center', ok ? '#1a1206' : null);
      if (ok) this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'raid', stage: st, kind: kind.key });
    });

    // 翻页
    const pages = Math.max(1, Math.ceil(this.bosses.length / this.per));
    const py = 970;
    roundRect(ctx, W / 2 - 160, py, 320, 46, 8, '#16202d', '#33475e', 2);
    text(ctx, '‹', W / 2 - 130, py + 23, 20, this.page > 0 ? '#9fd0ff' : '#4a5a70', 'center');
    text(ctx, (this.page + 1) + ' / ' + pages, W / 2, py + 23, 15, '#e8eef6', 'center');
    text(ctx, '›', W / 2 + 130, py + 23, 20, this.page < pages - 1 ? '#9fd0ff' : '#4a5a70', 'center');
    if (this.page > 0) this.hot.push({ x: W / 2 - 150, y: py, w: 60, h: 46, act: 'prev' });
    if (this.page < pages - 1) this.hot.push({ x: W / 2 + 90, y: py, w: 60, h: 46, act: 'next' });

    // 底部导航
    drawBottomNav(ctx, this.tex, 'fight', this.hot);
    drawToast(ctx, this.toast, this.toastT);
  }

  ptDown(p) {
    this.g.audioUnlock();
    for (const b of this.hot) {
      if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
      if (b.act === 'nav') {
        if (b.kind === 'fight') this.g.showSelect(); else this.g.showTab(b.kind);
        this.g.playSfx('sfx_tab', 0.3);
        return;
      }
      if (b.act === 'back') { this.g.showSelect(); this.g.playSfx('sfx_back', 0.3); return; }
      if (b.act === 'prev') { this.page = Math.max(0, this.page - 1); this.g.playSfx('sfx_click', 0.26); return; }
      if (b.act === 'next') { this.page++; this.g.playSfx('sfx_click', 0.26); return; }
      if (b.act === 'raid') {
        if (!(Player.raidTickets[b.kind] || 0)) {
          this.say('这张票不够了，去开宝箱或打 Boss 首通补票');
          this.g.playSfx('sfx_equipfail', 0.3);
          return;
        }
        this.g.startRaid(b.stage, b.kind);
        return;
      }
    }
  }
}
