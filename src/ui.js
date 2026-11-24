// ============================================================
//  弹窗层：统一的遮罩 + 缩放淡入动画，承载 设置 / 分享 / 评分 /
//  确认框 / 开箱结果。绘制在所有场景之上，点击优先被它吃掉。
//  用法：Popup.open('settings') / Popup.open('rate') /
//        Popup.open('chest', { res }) / Popup.confirm(标题, 正文, 回调)
// ============================================================

const SHARE_TEXT = '骑士战争 H5 · 原包美术重建版，102 关塔防，手机直接玩：';

class PopupLayer {
  constructor() {
    this.current = null;
    this.t = 0;            // 0→1 的入场动画进度
    this.hits = [];        // 本次绘制的可点区域
    this.msg = '';         // 面板内的临时提示
    this.stars = 0;        // 评分面板里选中的星数
    this.onYes = null;
  }

  get isOpen() { return !!this.current; }

  open(kind, data) {
    this.current = { kind, data: data || {} };
    this.t = 0;
    this.hits = [];
    this.msg = '';
    this.stars = 0;
    if (window.game && window.game.playSfx) window.game.playSfx('sfx_click', 0.3);
  }

  confirm(title, body, onYes) {
    this.open('confirm', { title, body });
    this.onYes = onYes;
  }

  close() {
    this.current = null;
    this.hits = [];
    this.onYes = null;
    if (window.game && window.game.playSfx) window.game.playSfx('sfx_back', 0.25);
  }

  update(dt) {
    if (this.current && this.t < 1) this.t = Math.min(1, this.t + dt * 5);
  }

  // 面板几何：宽 600，高按内容给
  panelH(kind) {
    if (kind === 'settings') return 420;
    if (kind === 'share') return 372;
    if (kind === 'rate') return 352;
    if (kind === 'chest') {
      const total = this.aggCount(this.current.data.res);
      const n = Math.min(10, total);
      return 168 + n * 34 + (total > 10 ? 26 : 0) + 78;
    }
    return 380;
  }

  aggCount(res) {
    if (!res || !res.rewards) return 3;
    const m = new Map();
    for (const r of res.rewards) m.set(r.label, 1);
    return m.size;
  }

  draw(ctx) {
    if (!this.current) return;
    this.hits = [];
    const { kind, data } = this.current;
    const e = 1 - Math.pow(1 - this.t, 3);           // easeOutCubic
    const sc = 0.86 + 0.14 * e;
    const pw = 600, ph = this.panelH(kind);
    const px = (W - pw) / 2, py = (H - ph) / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(4,8,12,' + (0.82 * e) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = e;
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);

    // 面板
    const lg = ctx.createLinearGradient(px, py, px, py + ph);
    lg.addColorStop(0, '#16222f');
    lg.addColorStop(1, '#0d151e');
    roundRect(ctx, px, py, pw, ph, 14, lg, '#5a7ea6', 2);
    ctx.fillStyle = 'rgba(120,170,235,0.10)';
    ctx.fillRect(px + 20, py + 92, pw - 40, 2);

    if (kind === 'settings') this.drawSettings(px, py, pw, ph);
    else if (kind === 'share') this.drawShare(px, py, pw, ph);
    else if (kind === 'rate') this.drawRate(px, py, pw, ph);
    else if (kind === 'chest') this.drawChest(px, py, pw, ph, data.res);
    else this.drawConfirm(px, py, pw, ph, data);

    ctx.restore();
  }

  // ---------- 通用部件 ----------
  titleBar(ctx, px, py, pw, txt) {
    text(ctx, txt, px + pw / 2, py + 44, 22, '#ffe9a8', 'center', '#000');
    // 关闭按钮（右上角）
    const bx = px + pw - 52, by = py + 18, bw = 40, bh = 40;
    roundRect(ctx, bx, by, bw, bh, 8, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)', 1);
    text(ctx, '×', bx + bw / 2, by + bh / 2, 22, '#cfd8e3', 'center');
    this.hits.push({ x: bx, y: by, w: bw, h: bh, act: 'close' });
  }

  btn(ctx, x, y, w, h, label, act, color, edge, disabled) {
    const c = disabled ? '#3a4654' : (color || '#2f7ad6');
    roundRect(ctx, x, y, w, h, 10, c, disabled ? '#4a5a70' : (edge || '#8fc4ff'), 2);
    text(ctx, label, x + w / 2, y + h / 2, 16, disabled ? '#9fb2c6' : '#fff', 'center');
    if (!disabled) this.hits.push({ x, y, w, h, act });
  }

  // ---------- 设置 ----------
  drawSettings(px, py, pw, ph) {
    const ctx = window.game.ctx;
    this.titleBar(ctx, px, py, pw, '设置  SETTINGS');
    const rows = [
      { lbl: '音效', sub: Player.sfxOn ? '开' : '关', act: 'toggleSfx' },
      { lbl: '分享给朋友', sub: '复制链接 / 分享文案', act: 'share' },
      { lbl: '给个评分', sub: Player.rated ? '已评分，谢谢！' : '5 星打分', act: 'rate' },
      { lbl: '重置进度', sub: '清空金币/装备/关卡星数', act: 'reset' }
    ];
    rows.forEach((r, i) => {
      const ry = py + 110 + i * 74;
      roundRect(ctx, px + 24, ry, pw - 48, 62, 9, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.10)', 1);
      text(ctx, r.lbl, px + 46, ry + 22, 17, '#e8eef6', 'left');
      text(ctx, r.sub, px + 46, ry + 44, 13, '#8fa3b7', 'left');
      // 右侧开关/箭头
      if (r.act === 'toggleSfx') {
        const tx = px + pw - 96, ty = ry + 16;
        roundRect(ctx, tx, ty, 60, 30, 15, Player.sfxOn ? '#2f7ad6' : '#2a3543', Player.sfxOn ? '#8fc4ff' : '#4a5a70', 1);
        ctx.beginPath();
        ctx.arc(tx + (Player.sfxOn ? 45 : 15), ty + 15, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#e8eef6';
        ctx.fill();
      } else {
        text(ctx, '›', px + pw - 46, ry + 31, 20, '#9fd0ff', 'center');
      }
      this.hits.push({ x: px + 24, y: ry, w: pw - 48, h: 62, act: r.act });
    });
    if (this.msg) text(ctx, this.msg, px + pw / 2, py + ph - 26, 13, '#ffcf5c', 'center');
  }

  // ---------- 分享 ----------
  drawShare(px, py, pw, ph) {
    const ctx = window.game.ctx;
    this.titleBar(ctx, px, py, pw, '分享  SHARE');
    const link = location.href.split('#')[0];
    text(ctx, '把这句话连链接一起发给朋友：', px + 34, py + 118, 14, '#8fa3b7', 'left');
    roundRect(ctx, px + 24, py + 132, pw - 48, 92, 9, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.10)', 1);
    text(ctx, SHARE_TEXT, px + 40, py + 158, 14, '#e8eef6', 'left');
    text(ctx, link.replace(/^https?:\/\//, ''), px + 40, py + 192, 13, '#9fd0ff', 'left');
    this.btn(ctx, px + 24, py + 240, pw - 48, 54, '复制链接与文案', 'copy');
    if (this.msg) text(ctx, this.msg, px + pw / 2, py + 312, 13, '#ffcf5c', 'center');
    text(ctx, '抖音小游戏版可换成 tt.shareAppMessage（外壳已留位）', px + pw / 2, py + ph - 34, 12, '#6f8398', 'center');
  }

  // ---------- 评分 ----------
  drawRate(px, py, pw, ph) {
    const ctx = window.game.ctx;
    this.titleBar(ctx, px, py, pw, '评分  RATE US');
    text(ctx, '这版重建离原包手感还差多少？', px + pw / 2, py + 108, 15, '#8fa3b7', 'center');
    for (let i = 0; i < 5; i++) {
      const cx = px + pw / 2 - 120 + i * 60, cy = py + 170;
      const on = i < this.stars;
      text(ctx, '★', cx, cy, 34, on ? '#ffcf5c' : '#3a4654', 'center', on ? '#000' : null);
      this.hits.push({ x: cx - 28, y: cy - 28, w: 56, h: 56, act: 'star', n: i + 1 });
    }
    text(ctx, this.stars ? (this.stars + ' 星') : '点星星打分', px + pw / 2, py + 216, 14, '#ffcf5c', 'center');
    this.btn(ctx, px + 90, py + 250, pw - 180, 52, Player.rated ? '已评过，可再改' : '提交评分', 'submitRate', this.stars ? '#2f7ad6' : '#3a4654', null, !this.stars);
    if (this.msg) text(ctx, this.msg, px + pw / 2, py + 322, 13, '#ffcf5c', 'center');
  }

  // ---------- 确认框 ----------
  drawConfirm(px, py, pw, ph, data) {
    const ctx = window.game.ctx;
    this.titleBar(ctx, px, py, pw, data.title || '确认');
    const lines = String(data.body || '').split('\n');
    lines.slice(0, 4).forEach((l, i) => text(ctx, l, px + pw / 2, py + 120 + i * 28, 15, '#cfd8e3', 'center'));
    this.btn(ctx, px + 60, py + ph - 92, (pw - 140) / 2, 54, '取消', 'close', '#4a5a70', '#9fb2c6');
    this.btn(ctx, px + 80 + (pw - 140) / 2, py + ph - 92, (pw - 140) / 2, 54, '确定', 'yes', '#c0392b', '#ff8a7a');
  }

  // ---------- 开箱结果 ----------
  drawChest(px, py, pw, ph, res) {
    const ctx = window.game.ctx;
    if (!res) return;
    this.titleBar(ctx, px, py, pw, res.boxName);
    text(ctx, '×' + res.count + ' · 共 ' + res.rewards.length + ' 件', px + pw / 2, py + 78, 13, '#8fa3b7', 'center');

    const map = new Map();
    for (const r of res.rewards) {
      if (map.has(r.label)) map.get(r.label).n++;
      else map.set(r.label, { n: 1, rarity: r.rarity });
    }
    const rows = Array.from(map.entries()).map(([label, v]) => ({ label, ...v })).slice(0, 10);
    rows.forEach((r, i) => {
      const ry = py + 96 + i * 34;
      roundRect(ctx, px + 24, ry, pw - 48, 28, 6, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)', 1);
      ctx.beginPath();
      ctx.arc(px + 44, ry + 14, 6, 0, Math.PI * 2);
      ctx.fillStyle = Chest.rarityColor(r.rarity);
      ctx.fill();
      text(ctx, Chest.rarityLabel(r.rarity), px + 58, ry + 14, 12, Chest.rarityColor(r.rarity), 'left');
      text(ctx, r.label + (r.n > 1 ? ' x' + r.n : '').slice(0, 30), px + 116, ry + 14, 14, '#e8eef6', 'left');
    });
    const tk = Object.keys(res.tickets || {}).filter(k => res.tickets[k] > 0);
    const tkY = py + 96 + rows.length * 34 + 12;
    if (tk.length) text(ctx, 'Raid 票：' + tk.map(k => k + ' x' + res.tickets[k]).join('、'), px + pw / 2, tkY, 14, '#ffcf5c', 'center', '#000');
    this.btn(ctx, px + pw / 2 - 110, py + ph - 72, 220, 48, '收下', 'close', '#2f7ad6', '#8fc4ff');
  }

  // 不支持 Clipboard API 时的兜底：临时 textarea + execCommand
  fallbackCopy(txt) {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  // ---------- 输入 ----------
  ptDown(p) {
    if (!this.current) return false;
    if (this.t < 0.85) return true;       // 入场动画期间不接受点击（防连点）
    for (const h of this.hits) {
      if (p.x < h.x || p.x > h.x + h.w || p.y < h.y || p.y > h.y + h.h) continue;
      this.onHit(h);
      return true;
    }
    return true;   // 面板外也吃掉，避免点到后面的场景
  }

  onHit(h) {
    const g = window.game;
    switch (h.act) {
      case 'close': this.close(); return;
      case 'yes': {
        const cb = this.onYes;
        this.close();
        if (cb) cb();
        return;
      }
      case 'toggleSfx':
        Player.sfxOn = !Player.sfxOn;
        Player.save();
        this.msg = Player.sfxOn ? '音效已打开' : '音效已关闭';
        return;
      case 'share': this.open('share'); return;
      case 'rate': this.open('rate'); return;
      case 'reset':
        this.confirm('重置进度？', '会清空金币、宝石、装备、材料、关卡星数与每日进度。\n此操作不可撤销。', () => Player.resetAll());
        return;
      case 'copy': {
        const txt = SHARE_TEXT + location.href.split('#')[0];
        const done = ok2 => { this.msg = ok2 ? '已复制，去粘给朋友吧' : '复制失败，长按上面的链接手动复制'; if (g) g.playSfx(ok2 ? 'sfx_buy' : 'sfx_equipfail', 0.3); };
        this.msg = '正在复制…';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(() => done(true)).catch(() => done(this.fallbackCopy(txt)));
        } else {
          done(this.fallbackCopy(txt));
        }
        setTimeout(() => { if (this.msg === '正在复制…') this.msg = '复制没响应，长按上面的链接手动复制'; }, 1200);
        return;
      }
      case 'star': this.stars = h.n; return;
      case 'submitRate':
        if (!this.stars) return;
        Player.rated = true;
        Player.save();
        this.msg = '收到 ' + this.stars + ' 星，谢谢！正式上架后接应用商店评分。';
        if (g) g.playSfx('sfx_claim', 0.35);
        return;
    }
  }
}

const Popup = new PopupLayer();
window.Popup = Popup;

