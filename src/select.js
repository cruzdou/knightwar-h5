// ============================================================
//  关卡选择页（按原版 1080×1920 布局 0.667 折算到 720×1280）
//  顶部资源条 / 左侧礼包列 / 中央城堡面板 / 右侧福利列 / 关卡卡片列表 / 底部导航
//  全部贴图取自原包 assets/art
// ============================================================

const SEL = {
  top: { y: 12, h: 54 },
  left: { x: 8, w: 146 },
  mid: { x: 160, w: 398 },
  right: { x: 566, w: 146 },
  castle: { y: 88, h: 300 },
  cards: { y: 486, h: 116, gap: 12, per: 5 }
};

class LevelSelectScene {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.levels = [];
    this.zones = [];
    this.zoneIdx = 0;
    this.page = 0;
    this.time = 0;
    this.hot = [];
  }

  async init() {
    this.levels = await loadLevelList();
    this.zones = zoneList(this.levels);
    this.zoneIdx = 0;

    const t = {};
    const names = {
      coin: 'UI_cur_coin.png', gem: 'UI_cur_gem.png', stamina: 'UI_cur_stamina.png',
      plus: 'UI2_icon_plus.png',
      panel: 'UI2_panel_1.png', panel3: 'UI2_panel_3.png',
      btnY: 'common_btn_yellow.png', btnB: 'common_btn_blue.png',
      star: 'result_star.png', starDim: 'result_star_dim.png',
      ribbon: 'result_title_ribbon.png',
      castle: 'castle_1.png',
      navShop: 'UI_navibar_shop.png', navCraft: 'UI_navibar_craft.png',
      navFight: 'UI_navibar_fight.png', navHero: 'UI_navibar_hero.png',
      navCastle: 'UI_navibar_castle.png',
      chest: 'common_item_chest.png', crown: 'common_item_crown.png',
      anvil: 'common_item_anvil.png', book: 'common_item_book_skill.png',
      sword: 'common_item_sword.png',
      arrowPrev: 'stage_arrow_prev.png',
      allies: 'pack_avatar_sp.png',
      green: 'ribbon_bg_green.png',
      lock: 'stage_frame_icon_lock.png'
    };
    // 并行加载首屏贴图（串行时线上每张都要等 CDN，首屏会很慢）
    await Promise.all(Object.entries(names).map(async ([k, f]) => {
      try { t[k] = await loadImage(f); } catch (e) { t[k] = null; }
    }));
    this.tex = t;
    this.scene = 'select';
  }

  // ---------- 数据 ----------
  curZone() { return this.zones[this.zoneIdx]; }
  curStages() { return this.levels.filter(l => l.zone === this.curZone()); }
  pageCount() { return Math.max(1, Math.ceil(this.curStages().length / SEL.cards.per)); }

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 背景：暗色垂直渐变
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1018');
    g.addColorStop(0.5, '#0d1520');
    g.addColorStop(1, '#070b11');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    this.hot.length = 0;
    this.drawTopBar();
    this.drawLeftColumn();
    this.drawCastle();
    this.drawRightColumn();
    this.drawMilestones();
    this.drawCards();
    this.drawNav();
  }

  // 顶部资源条（与其它功能页共用）
  drawTopBar() { drawTopBar(this.ctx, this.tex, Player, this.hot); }

  // 左侧：玩家卡 + 礼包列
  drawLeftColumn() {
    const ctx = this.ctx, x = SEL.left.x, w = SEL.left.w;
    // 玩家卡
    let y = SEL.castle.y, h = 88;
    roundRect(ctx, x, y, w, h, 8, '#141d29', '#2c3f52', 2);
    ctx.save();
    ctx.beginPath(); ctx.arc(x + 34, y + 40, 24, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1d2b3a'; ctx.fillRect(x + 8, y + 14, 50, 50);
    ctx.restore();
    if (this.tex.lock) drawIcon(ctx, this.tex.lock, x + 34, y + 40, 0.4);
    text(ctx, 'Guest', x + 64, y + 28, 17, '#e8eef6');
    text(ctx, 'Lv 1', x + 64, y + 50, 14, '#9fb2c6');
    roundRect(ctx, x + 64, y + 62, w - 72, 10, 5, '#1c2836');
    roundRect(ctx, x + 64, y + 62, (w - 72) * (46 / 200), 10, 5, '#3f95e0');
    text(ctx, '46/200', x + w - 10, y + 84, 11, '#7f93a8', 'right');

    // 礼包卡
    y = SEL.castle.y + 96;
    this.packCard(x, y, w, 104, 'ALLIES PACK', '四位英雄', 'FREE', 'ally');
    y += 112;
    this.packCard(x, y, w, 104, 'BONUS PACK', this.packTimer('bonus', 6), '50G', 'pack', 'bonus');
    y += 112;
    this.packCard(x, y, w, 104, 'STARTER PACK', this.packTimer('starter', 24), '90G', 'pack', 'starter');
    // Raid 入口（票数实时显示）
    y += 112;
    this.packCard(x, y, w, 92, 'RAID', '票 ' + Player.raidTicketTotal() + ' 张', 'BOSS', 'raid');
  }

  // 礼包倒计时文案：未买→剩余时间；买过→已购买；超时→已结束
  packTimer(key, hours) {
    const p = Player.packState(key, hours);
    if (p.bought) return '已购买';
    const left = Player.packLeft(key, hours);
    if (left <= 0) return '已结束';
    const s = Math.floor(left / 1000);
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const two = n => (n < 10 ? '0' + n : '' + n);
    return hh > 0 ? hh + ':' + two(mm) + ':' + two(ss) : mm + ':' + two(ss);
  }

  packCard(x, y, w, h, title, sub, tag, act, key) {
    const ctx = this.ctx;
    roundRect(ctx, x, y, w, h, 8, '#16202d', '#33475e', 2);
    const lg = ctx.createLinearGradient(x, y, x, y + 30);
    lg.addColorStop(0, 'rgba(255,190,80,0.35)');
    lg.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = lg; ctx.fillRect(x + 2, y + 2, w - 4, 30);
    text(ctx, title, x + w / 2, y + 13, 11, '#ffd98a', 'center');
    if (title.indexOf('ALLIES') >= 0 && this.tex.allies) {
      const ah = 44, aw = ah * this.tex.allies.width / this.tex.allies.height;
      ctx.drawImage(this.tex.allies, x + (w - aw) / 2, y + 26, aw, ah);
    } else if (this.tex.chest) {
      drawIcon(ctx, this.tex.chest, x + w / 2, y + 52, 0.34);
    }
    text(ctx, sub, x + w / 2, y + 84, 13, '#a8bccf', 'center');
    roundRect(ctx, x + w - 34, y + 4, 28, 15, 4, '#3a2b10', '#ffcf5c', 1);
    text(ctx, tag, x + w - 20, y + 12, 9, '#ffcf5c', 'center');
    // 可点的卡：盟友页 / 礼包详情 / Raid 页
    if (act) this.hot.push({ x, y, w, h, act, key });
  }

  // 中央城堡面板
  drawCastle() {
    const ctx = this.ctx, x = SEL.mid.x, w = SEL.mid.w, y = SEL.castle.y, h = SEL.castle.h;

    // 外框
    roundRect(ctx, x, y, w, h, 12, '#0b1219', '#6d5a2c', 3);
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 10, '#0e1822');

    // 城堡画面（原版 castle_1 双塔，底对齐）
    if (this.tex.castle) {
      const cw = w - 8, ch = cw * this.tex.castle.height / this.tex.castle.width;
      ctx.save();
      roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 10, null, null, 0);
      ctx.clip();
      ctx.drawImage(this.tex.castle, x + 4, y + h - ch + 20, cw, ch);
      const fade = ctx.createLinearGradient(0, y + 4, 0, y + h);
      fade.addColorStop(0, 'rgba(8,12,18,0.75)');
      fade.addColorStop(0.55, 'rgba(8,12,18,0.25)');
      fade.addColorStop(1, 'rgba(8,12,18,0.05)');
      ctx.fillStyle = fade; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.restore();
    }

    // 分区标题缎带 + 星星
    const stages = this.curStages();
    const starsGot = stages.reduce((s, l) => s + Player.starsOf(l.name), 0);
    const rw = 260, rh = rw * (this.tex.ribbon ? this.tex.ribbon.height / this.tex.ribbon.width : 0.36);
    if (this.tex.ribbon) {
      ctx.drawImage(this.tex.ribbon, x + (w - rw) / 2, y + 16, rw, rh);
    } else {
      roundRect(ctx, x + (w - rw) / 2, y + 20, rw, 44, 8, '#4b2a7a');
    }
    text(ctx, stages[0] ? stages[0].zoneName : 'Mirkwood', x + w / 2, y + 16 + rh * 0.46, 22, '#ffe9a8', 'center', '#2a1440');

    // 星星计数 5/30
    const sy = y + 16 + rh + 26;
    if (this.tex.star) drawIcon(ctx, this.tex.star, x + w / 2 - 46, sy, 0.14);
    text(ctx, starsGot + '/30', x + w / 2 + 4, sy, 19, '#ffe9a8', 'left', '#241a08');

    // 分区左右切换箭头
    const ay = y + h - 44;
    this.arrowBtn(x + 16, ay, -1, this.zoneIdx > 0);
    this.arrowBtn(x + w - 16, ay, 1, this.zoneIdx < this.zones.length - 1);
    text(ctx, (this.zoneIdx + 1) + ' / ' + this.zones.length, x + w / 2, ay, 14, '#8fa3b7', 'center');

    // 左侧锁门提示（原版：骷髅门）
    text(ctx, stages.length + ' 个关卡', x + 16, y + h - 22, 12, '#8fa3b7', 'left');
  }

  arrowBtn(cx, cy, dir, on, act) {
    const ctx = this.ctx;
    roundRect(ctx, cx - 20, cy - 20, 40, 40, 20, on ? 'rgba(47,111,176,0.85)' : 'rgba(30,40,54,0.8)', '#2c3f52', 2);
    if (this.tex.arrowPrev) {
      ctx.save();
      ctx.translate(cx, cy);
      if (dir > 0) ctx.scale(-1, 1);
      const s = 0.30;
      ctx.globalAlpha = on ? 1 : 0.4;
      ctx.drawImage(this.tex.arrowPrev, -this.tex.arrowPrev.width * s / 2, -this.tex.arrowPrev.height * s / 2,
        this.tex.arrowPrev.width * s, this.tex.arrowPrev.height * s);
      ctx.restore();
    }
    if (on) this.hot.push({ x: cx - 22, y: cy - 22, w: 44, h: 44, act: act || (dir > 0 ? 'zoneNext' : 'zonePrev') });
  }

  // 右侧福利列（Daily Gift / Quest 点击进每日页，带可领数量小红点）
  drawRightColumn() {
    const x = SEL.right.x, w = SEL.right.w;
    const ready = window.Daily && Daily.ready;
    const nSign = ready ? Daily.sectionClaimable('sign') : 0;
    const nQuest = ready ? Daily.sectionClaimable('quest') : 0;
    const nEvent = ready ? Daily.sectionClaimable('event') : 0;
    let y = SEL.castle.y;
    this.rightCard(x, y, w, 88, 'VIP only', 'crown', '#c8a13c'); y += 96;
    this.rightCard(x, y, w, 88, 'Daily Gift', 'chest', '#4f8fd0', { act: 'daily', tab: 'sign' }, nSign); y += 96;
    this.rightCard(x, y, w, 88, 'Quest', 'book', '#4f8fd0', { act: 'daily', tab: 'quest' }, nQuest); y += 96;
    this.rightCard(x, y, w, 88, 'Event', 'green', '#6aa84f', { act: 'daily', tab: 'event' }, nEvent);
  }

  rightCard(x, y, w, h, label, icon, color, tap, dot) {
    const ctx = this.ctx;
    roundRect(ctx, x, y, w, h, 8, '#141d29', color, 2);
    const lg = ctx.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, 'rgba(255,255,255,0.06)');
    lg.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = lg;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 7, lg);
    const img = this.tex[icon];
    if (img) drawIcon(ctx, img, x + w / 2, y + 34, icon === 'green' ? 0.40 : 0.46);
    text(ctx, label, x + w / 2, y + h - 14, 13, '#dfe9f5', 'center', '#0a1018');
    // 可领数量小红点
    if (dot > 0) {
      ctx.beginPath();
      ctx.arc(x + w - 14, y + 14, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#c8382f';
      ctx.fill();
      text(ctx, dot > 9 ? '9+' : String(dot), x + w - 14, y + 14, 10, '#fff', 'center');
    }
    if (tap) this.hot.push({ x, y, w, h, act: tap.act, tab: tap.tab });
  }

  // 里程碑奖励 + 进度条
  drawMilestones() {
    const ctx = this.ctx;
    const x = SEL.mid.x, w = SEL.mid.w, y = SEL.castle.y + SEL.castle.h + 12;
    text(ctx, 'STAR MILESTONE', x, y - 2, 11, '#7f93a8', 'left');
    const rewards = [
      { lbl: '3-1', img: this.tex.coin, on: true },
      { lbl: '5-1', img: this.tex.gem, on: true },
      { lbl: '7-1', img: this.tex.anvil, on: false },
      { lbl: '10-1', img: this.tex.book, on: false }
    ];
    const cw = (w - 18) / 4;
    rewards.forEach((r, i) => {
      const cx = x + i * (cw + 6);
      roundRect(ctx, cx, y + 10, cw, 44, 7, r.on ? '#1a2635' : '#131b25', r.on ? '#6d5a2c' : '#28323e', 2);
      if (r.img) drawIcon(ctx, r.img, cx + 20, y + 32, 0.4, r.on ? 1 : 0.55);
      text(ctx, r.lbl, cx + cw - 12, y + 32, 13, r.on ? '#ffe9a8' : '#7f93a8', 'right');
    });
    // 蓝色进度条
    const by = y + 58;
    roundRect(ctx, x, by, w, 8, 4, '#16202d', '#2c3f52', 1);
    roundRect(ctx, x, by, w * 0.42, 8, 4, '#3f95e0');
  }

  // 关卡卡片列表
  drawCards() {
    const ctx = this.ctx;
    const stages = this.curStages();
    const start = this.page * SEL.cards.per;
    const list = stages.slice(start, start + SEL.cards.per);
    const x = SEL.mid.x, w = SEL.mid.w, h = SEL.cards.h, gap = SEL.cards.gap;
    let y = SEL.cards.y;

    // 第一个还没拿星的关卡就是「下一战」，其余显示 Replay
    let latest = -1;
    for (let i = 0; i < stages.length; i++) {
      if (Player.starsOf(stages[i].name) === 0) { latest = i; break; }
    }
    if (latest < 0) latest = stages.length - 1;

    list.forEach((st, i) => {
      const idx = start + i;
      const isNext = idx === latest;
      const gold = isNext || st.levelType === 'bigBoss';

      roundRect(ctx, x, y, w, h, 9, gold ? '#1d2233' : '#161d27', gold ? '#c8a13c' : '#33475e', gold ? 2.5 : 2);
      if (gold) {
        const lg = ctx.createLinearGradient(x, y, x + w, y + h);
        lg.addColorStop(0, 'rgba(255,200,90,0.14)');
        lg.addColorStop(1, 'rgba(255,200,90,0)');
        roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 8, lg);
      }

      // 左侧 2×2 奖励格
      const tiles = [this.tex.coin, this.tex.gem, this.tex.anvil, this.tex.book];
      tiles.forEach((img, k) => {
        const tx = x + 12 + (k % 2) * 34, ty = y + 22 + Math.floor(k / 2) * 36;
        roundRect(ctx, tx, ty, 28, 28, 5, '#0e151d', '#2a3644', 1);
        if (img) drawIcon(ctx, img, tx + 14, ty + 14, 0.28, 0.9);
      });

      // 关卡名 + 星级
      text(ctx, st.name, x + 96, y + 28, 22, gold ? '#ffe9a8' : '#dbe6f2', 'left', '#0c1016');
      const gotStars = Player.starsOf(st.name);
      let sx = x + 96;
      for (let s = 0; s < 3; s++) {
        const img = s < gotStars ? this.tex.star : this.tex.starDim;
        if (img) drawIcon(ctx, img, sx + 9, y + 62, 0.115, s < gotStars ? 1 : 0.6);
        sx += 20;
      }
      text(ctx, st.totalEnemy + ' 敌 · ' + st.levelCoins + ' 金币', x + 96, y + 90, 11, '#8fa3b7', 'left');
      if (st.levelType !== 'Normal') {
        text(ctx, st.levelType === 'bigBoss' ? 'BOSS' : 'MINI', x + 96 + 62, y + 28, 10, '#ff7a6a', 'left');
      }

      // 右侧按钮
      const bw = 104, bh = 44, bx = x + w - bw - 12, by = y + (h - bh) / 2;
      const btnImg = isNext ? this.tex.btnY : this.tex.btnB;
      if (btnImg) {
        ctx.drawImage(btnImg, bx, by, bw, bh);
      } else {
        roundRect(ctx, bx, by, bw, bh, 8, isNext ? '#e0a52a' : '#2f6fb0');
      }
      text(ctx, isNext ? 'Battle' : 'Replay', bx + bw / 2, by + bh / 2, 17, '#ffffff', 'center', '#1a1206');

      this.hot.push({ x: x, y: y, w: w, h: h, act: 'stage', stage: st });
      y += h + gap;
    });

    // 翻页箭头
    if (this.pageCount() > 1) {
      const py = y + 16;
      const onPrev = this.page > 0, onNext = this.page < this.pageCount() - 1;
      this.arrowBtn(x + 30, py, -1, onPrev, 'pagePrev');
      this.arrowBtn(x + w - 30, py, 1, onNext, 'pageNext');
      text(ctx, (this.page + 1) + ' / ' + this.pageCount(), x + w / 2, py, 14, '#8fa3b7', 'center');
      y = py + 34;
    }

    // 空白区：下一分区解锁提示（原版里程碑之后是营地/下一分区入口）
    const bottom = H - 104;
    if (bottom - y > 170) {
      const uh = Math.min(230, bottom - y - 12);
      this.drawUnlock(x, y + 6, w, uh);
    }
  }

  drawUnlock(x, y, w, h) {
    const ctx = this.ctx;
    roundRect(ctx, x, y, w, h, 10, '#101a24', '#28323e', 2);
    const nz = this.zones[this.zoneIdx + 1];
    // 底图（放在文字下面）
    if (this.tex.castle) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      const cw = w - 40, ch = cw * this.tex.castle.height / this.tex.castle.width;
      ctx.drawImage(this.tex.castle, x + 20, y + h - ch + 6, cw, ch);
      ctx.restore();
    }
    if (this.tex.lock) drawIcon(ctx, this.tex.lock, x + w / 2, y + 40, 0.5, 0.9);
    text(ctx, nz ? '下一分区' : '全部通关', x + w / 2, y + 86, 18, '#ffe9a8', 'center', '#101820');
    text(ctx, nz ? (ZONE_NAMES[nz] || ('Zone ' + (nz + 1))) : '已抵达最后一站', x + w / 2, y + 114, 14, '#9fb2c6', 'center');
    if (nz) {
      const need = this.curStages().length;
      text(ctx, '完成本分区 ' + need + ' 关后进入', x + w / 2, y + 138, 11, '#6f8398', 'center');
    }
  }

  // 底部五标签导航（与其它功能页共用）
  drawNav() { drawBottomNav(this.ctx, this.tex, 'fight', this.hot); }

  // ---------- 输入 ----------
  update(dt) { this.time += dt; }

  toLocal(ev) {
    const r = this.g.cv.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) / r.width * W,
      y: (ev.clientY - r.top) / r.height * H
    };
  }

  ptDown(p) {
    this.g.audioUnlock();
    for (const b of this.hot) {
      if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
      if (b.act === 'zonePrev') { this.zoneIdx = Math.max(0, this.zoneIdx - 1); this.page = 0; this.g.playSfx('sfx_tab', 0.3); return; }
      if (b.act === 'zoneNext') { this.zoneIdx = Math.min(this.zones.length - 1, this.zoneIdx + 1); this.page = 0; this.g.playSfx('sfx_tab', 0.3); return; }
      if (b.act === 'pagePrev') { this.page = Math.max(0, this.page - 1); this.g.playSfx('sfx_click', 0.26); return; }
      if (b.act === 'pageNext') { this.page = Math.min(this.pageCount() - 1, this.page + 1); this.g.playSfx('sfx_click', 0.26); return; }
      if (b.act === 'stage' && b.stage) { this.g.playSfx('sfx_click', 0.3); this.g.startBattle(b.stage); return; }
      if (b.act === 'daily') { this.g.playSfx('sfx_tab', 0.3); this.g.showDaily(b.tab); return; }
      if (b.act === 'ally') { this.g.playSfx('sfx_tab', 0.3); this.g.showAlly(); return; }
      if (b.act === 'raid') { this.g.playSfx('sfx_tab', 0.3); this.g.showRaid(); return; }
      if (b.act === 'pack') {
        const p = this.g.packDef(b.key);
        if (!p) return;
        if (Player.packState(b.key, p.hours).bought) { this.g.playSfx('sfx_equipfail', 0.3); return; }
        this.g.playSfx('sfx_click', 0.3);
        Popup.open('pack', { key: b.key });
        return;
      }
      if (b.act === 'nav') { this.g.showTab(b.kind); return; }
    }
  }
}
