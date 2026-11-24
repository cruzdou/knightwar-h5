// ============================================================
//  盟友页：招募 / 训练 / 进化 / 上阵
//  数值与 8 阶进化全部取自 data/gameAllies.json（9 名援军）
//  上阵最多 3 名，战场上会自动向敌人射箭（battle.js 的 shootFrom）
// ============================================================

class AllyScene {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.hot = [];
    this.toast = '';
    this.toastT = 0;
    this.sel = 1;          // 当前选中的盟友 charID
    this.time = 0;
    this.ready = false;
  }

  async init() {
    if (this.inited) return;
    this.inited = true;
    const defs = {
      coin: 'UI_cur_coin.png', gem: 'UI_cur_gem.png', stamina: 'UI_cur_stamina.png',
      plus: 'UI2_icon_plus.png', ribbon: 'result_title_ribbon.png',
      btnY: 'common_btn_yellow.png', btnB: 'common_btn_blue.png',
      star: 'result_star.png', starDim: 'result_star_dim.png',
      arrowBack: 'btn_icon_arrow_back.png',
      crown: 'common_item_crown.png', book: 'common_item_book_skill.png',
      navShop: 'UI_navibar_shop.png', navCraft: 'UI_navibar_craft.png',
      navFight: 'UI_navibar_fight.png', navHero: 'UI_navibar_hero.png',
      navCastle: 'UI_navibar_castle.png'
    };
    const t = {};
    await Promise.all(Object.entries(defs).map(async ([k, f]) => {
      try { t[k] = await loadImage(f); } catch (e) { t[k] = null; }
    }));
    // 9 张盟友头像（原包 Assets/Sprites/Avatar/avatar_sp_01~09）
    t.avatar = [];
    await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9].map(async i => {
      const n = 'avatar_sp_0' + i + '.webp';
      try { t.avatar[i] = await loadImage(n); } catch (e) { t.avatar[i] = null; }
    }));
    this.tex = t;
    this.ready = true;
  }

  say(msg) { this.toast = msg; this.toastT = 0; }

  allies() { return this.g.allyList || []; }

  evoOf(id) {
    const rec = Player.allyOf(id);
    return (rec && rec.evo) || 1;
  }
  lvOf(id) {
    const rec = Player.allyOf(id);
    return (rec && rec.lv) || 1;
  }

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1018');
    bg.addColorStop(0.5, '#0d1520');
    bg.addColorStop(1, '#070b11');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.hot.length = 0;
    drawTopBar(ctx, this.tex, Player, this.hot);
    this.drawBack();
    this.drawGrid();
    this.drawDetail();
    drawBottomNav(ctx, this.tex, null, this.hot);
    drawToast(ctx, this.toast, this.toastT);
  }

  drawBack() {
    const ctx = this.ctx;
    const x = W - 52, y = 14, w = 42, h = 46;
    roundRect(ctx, x, y, w, h, 9, '#182534', '#3f6a8f', 2);
    const img = this.tex.arrowBack;
    if (img) drawIcon(ctx, img, x + w / 2, y + h / 2, 0.34);
    else text(ctx, '←', x + w / 2, y + h / 2, 20, '#9fd0ff', 'center');
    this.hot.push({ x, y, w, h, act: 'back' });
  }

  // 9 宫格：头像 + 名字 + Lv/EVO + 上阵角标
  drawGrid() {
    const ctx = this.ctx;
    const cols = 3, gap = 8, cw = (W - 24 - gap * 2) / cols, chh = 146;
    const owned = this.allies().filter(a => Player.hasAlly(a.charID)).length;
    text(ctx, '盟友 · 已拥有 ' + owned + ' / ' + this.allies().length, 14, 138, 19, '#ffe9a8', 'left', '#20160a');
    text(ctx, '上阵 ' + Player.squad.length + ' / 3', W - 60, 138, 13, '#8fa3b7', 'right');

    this.allies().forEach((a, i) => {
      const x = 12 + (i % cols) * (cw + gap), y = 156 + Math.floor(i / cols) * (chh + gap);
      const has = Player.hasAlly(a.charID);
      const on = Player.inSquad(a.charID);
      const sel = this.sel === a.charID;
      roundRect(ctx, x, y, cw, chh, 10, sel ? '#1d2f44' : '#141d29',
        sel ? '#7fc6ff' : (on ? '#c9a227' : '#33475e'), 2);
      // 头像（未拥有时压暗）
      const av = this.tex.avatar && this.tex.avatar[a.charID];
      if (av) {
        ctx.save();
        if (!has) ctx.globalAlpha = 0.35;
        const hh = 88, ww = hh * av.width / av.height;
        ctx.drawImage(av, x + (cw - ww) / 2, y + 6, ww, hh);
        ctx.restore();
      } else {
        drawIcon(ctx, this.tex.crown, x + cw / 2, y + 48, 0.4);
      }
      text(ctx, a.name, x + cw / 2, y + 106, 14, has ? '#ffffff' : '#7f93a8', 'center', '#0a1018');
      const lv = this.lvOf(a.charID), evo = this.evoOf(a.charID);
      text(ctx, has ? ('Lv ' + lv + ' · EVO ' + evo) : ('招募 ' + this.recruitCost(a.charID) + ' 宝石'),
        x + cw / 2, y + 128, 12, has ? '#9fb2c6' : '#c98a5a', 'center');
      if (on) {
        roundRect(ctx, x + 8, y + 8, 52, 22, 6, 'rgba(201,162,39,0.9)');
        text(ctx, '上阵', x + 34, y + 19, 12, '#1a1206', 'center');
      }
      this.hot.push({ x, y, w: cw, h: chh, act: 'sel', id: a.charID });
    });
  }

  // 详情面板：选中盟友的数值与三个按钮
  drawDetail() {
    const ctx = this.ctx;
    const a = this.allies().find(x => x.charID === this.sel) || this.allies()[0];
    if (!a) return;
    const px = 12, py = 646, pw = W - 24, ph = 470;
    roundRect(ctx, px, py, pw, ph, 12, '#121a24', '#33475e', 2);
    const has = Player.hasAlly(a.charID);
    const st = this.g.allyStats ? this.g.allyStats(a.charID) : null;

    // 大头像
    const ax = px + 18, ay = py + 18, aw = 168, ah = 200;
    roundRect(ctx, ax, ay, aw, ah, 9, '#0d141c', '#6d5a2c', 2);
    const av = this.tex.avatar && this.tex.avatar[a.charID];
    if (av) {
      const hh = 176, ww = hh * av.width / av.height;
      ctx.save();
      if (!has) ctx.globalAlpha = 0.35;
      ctx.drawImage(av, ax + (aw - ww) / 2, ay + (ah - hh) / 2, ww, hh);
      ctx.restore();
    }
    text(ctx, a.name, px + 204, py + 40, 22, '#ffe9a8', 'left', '#20160a');
    text(ctx, has ? ('Lv ' + this.lvOf(a.charID) + ' / ' + ((st && st.levelMax) || 20) +
      '    EVO ' + this.evoOf(a.charID) + ' / ' + ((st && st.evoMax) || 8)) : '未招募', px + 204, py + 70, 15, '#9fb2c6', 'left');
    // 简介（按单词折行，避免单词被劈断）+ 技能（原文来自 gameAllies.json）
    const desc = String(a.description || '');
    const lines = [];
    let cur = '';
    for (const w of desc.split(' ')) {
      if ((cur + ' ' + w).trim().length > 26 && cur) { lines.push(cur); cur = w; }
      else cur = (cur ? cur + ' ' : '') + w;
    }
    if (cur) lines.push(cur);
    lines.slice(0, 2).forEach((ln, i) => text(ctx, ln, px + 204, py + 98 + i * 18, 12, '#8fa3b7', 'left'));
    const sk = (a.skillList || [])[0];
    if (sk) text(ctx, '技能：' + sk.name, px + 204, py + 144, 13, '#9fd0ff', 'left');

    // 数值四格
    if (st) {
      const items = [
        ['伤害', Math.round(st.damage)],
        ['攻速', (st.atkRate || 1).toFixed(2) + '/s'],
        ['血量', Math.round(st.blood)],
        ['暴击率', Math.round(st.critRate || 0) + '%']
      ];
      items.forEach((it, i) => {
        const bx = px + 18 + (i % 2) * 200, by = py + 232 + Math.floor(i / 2) * 44;
        text(ctx, it[0], bx, by, 13, '#8fa3b7', 'left');
        text(ctx, String(it[1]), bx + 58, by, 19, '#ffe9a8', 'left');
      });
    }

    // 按钮区
    const by = py + 330, bh = 54;
    if (!has) {
      const cost = this.recruitCost(a.charID);
      const bw = 320, bx = px + (pw - bw) / 2;
      const can = Player.gems >= cost;
      roundRect(ctx, bx, by, bw, bh, 10, can ? '#e0a52a' : '#2a3644', can ? '#ffdf9a' : '#3a4654', 2);
      text(ctx, '招募  ' + cost + ' 宝石', bx + bw / 2, by + bh / 2, 18, can ? '#1a1206' : '#6f8398', 'center');
      if (can) this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'recruit', id: a.charID });
    } else {
      const gap = 8, bw = (pw - 36 - gap * 2) / 3;
      // 训练
      const lv = this.lvOf(a.charID), maxLv = (st && st.levelMax) || 20;
      const trainCost = this.trainCost(a.charID);
      const x1 = px + 18;
      if (lv >= maxLv) {
        roundRect(ctx, x1, by, bw, bh, 9, '#1a2431', '#2a3644', 1);
        text(ctx, '已满级', x1 + bw / 2, by + bh / 2, 15, '#6f8398', 'center');
      } else {
        const can = Player.coins >= trainCost;
        roundRect(ctx, x1, by, bw, bh, 9, can ? '#e0a52a' : '#3a4654', can ? '#ffdf9a' : '#4a5a70', 2);
        text(ctx, '训练', x1 + bw / 2, by + 20, 16, can ? '#1a1206' : '#9fb2c6', 'center');
        text(ctx, trainCost + ' 金币', x1 + bw / 2, by + 40, 12, can ? '#3a2a08' : '#8fa3b7', 'center');
        if (can) this.hot.push({ x: x1, y: by, w: bw, h: bh, act: 'train', id: a.charID });
      }
      // 进化
      const x2 = x1 + bw + gap;
      const evo = this.evoOf(a.charID), evoMax = (st && st.evoMax) || 8;
      if (evo >= evoMax) {
        roundRect(ctx, x2, by, bw, bh, 9, '#1a2431', '#2a3644', 1);
        text(ctx, '满进化', x2 + bw / 2, by + bh / 2, 15, '#6f8398', 'center');
      } else {
        const ec = this.evoCost(a.charID);
        const can = Player.coins >= ec.gold && Player.gems >= ec.gem;
        roundRect(ctx, x2, by, bw, bh, 9, can ? '#2f6fb0' : '#1a2431', can ? '#7fc6ff' : '#2a3644', 2);
        text(ctx, '进化 EVO' + (evo + 1), x2 + bw / 2, by + 20, 15, can ? '#fff' : '#6f8398', 'center');
        text(ctx, ec.gold + ' 金 + ' + ec.gem + ' 宝', x2 + bw / 2, by + 40, 11, can ? '#cfe8ff' : '#5f7488', 'center');
        if (can) this.hot.push({ x: x2, y: by, w: bw, h: bh, act: 'evo', id: a.charID });
      }
      // 上阵 / 下阵（只剩 1 名时不允许下阵）
      const x3 = x2 + bw + gap;
      const on = Player.inSquad(a.charID);
      const lock = on && Player.squad.length <= 1;
      if (lock) {
        roundRect(ctx, x3, by, bw, bh, 9, '#1a2431', '#2a3644', 1);
        text(ctx, '必上阵', x3 + bw / 2, by + bh / 2, 17, '#6f8398', 'center');
      } else {
        roundRect(ctx, x3, by, bw, bh, 9, on ? '#3d5a2a' : '#2f6fb0', on ? '#9fe06a' : '#7fc6ff', 2);
        text(ctx, on ? '下阵' : '上阵', x3 + bw / 2, by + bh / 2, 18, '#fff', 'center');
        this.hot.push({ x: x3, y: by, w: bw, h: bh, act: 'squad', id: a.charID });
      }
    }
    text(ctx, '盟友不会被打死；上阵后在战场自动攻击最靠城墙的敌人。', W / 2, py + ph - 20, 11, '#6f8398', 'center');
  }

  // ---------- 成本 ----------
  recruitCost(id) { return 120 + 60 * (id - 1); }

  trainCost(id) {
    const st = this.g.allyStats ? this.g.allyStats(id) : null;
    const lv = this.lvOf(id);
    return Math.max(50, Math.round(((st && st.goldLvUp) || 100) * (1 + lv * 0.6)));
  }

  evoCost(id) {
    const a = this.allies().find(x => x.charID === id);
    const evo = this.evoOf(id);
    const next = a && a.evolutionList ? a.evolutionList[evo] : null;
    return { gold: (next && next.goldEvolution) || 1000, gem: (next && next.gemEvolution) || 50 };
  }

  // ---------- 输入 ----------
  update(dt) {
    this.time += dt;
    if (this.toast) this.toastT += dt;
    if (this.toastT > 1.8) this.toast = '';
  }

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
      switch (b.act) {
        case 'back': this.g.showSelect(); this.g.playSfx('sfx_back', 0.3); return;
        case 'nav':
          if (b.kind === 'fight') this.g.showSelect(); else this.g.showTab(b.kind);
          this.g.playSfx('sfx_tab', 0.3);
          return;
        case 'sel': this.sel = b.id; this.g.playSfx('sfx_click', 0.3); return;
        case 'recruit': {
          const cost = this.recruitCost(b.id);
          if (!Player.spendGems(cost)) { this.say('宝石不足，需要 ' + cost); this.g.playSfx('sfx_equipfail', 0.3); return; }
          Player.recruitAlly(b.id);
          this.say('招募成功：' + this.nameOf(b.id) + ' 已加入并上阵');
          this.g.playSfx('sfx_claim', 0.36);
          return;
        }
        case 'train': {
          const st = this.g.allyStats(b.id);
          const lv = this.lvOf(b.id);
          if (!st) return;
          if (lv >= st.levelMax) { this.say('已满级'); return; }
          const cost = this.trainCost(b.id);
          if (!Player.spendCoins(cost)) { this.say('金币不足，需要 ' + cost); this.g.playSfx('sfx_equipfail', 0.3); return; }
          Player.setAlly(b.id, lv + 1, this.evoOf(b.id));
          if (window.Daily) Daily.count('allyUp', 1);
          this.say(this.nameOf(b.id) + ' 训练到 Lv ' + (lv + 1));
          this.g.playSfx('sfx_levelup', 0.4);
          return;
        }
        case 'evo': {
          const ec = this.evoCost(b.id);
          const evo = this.evoOf(b.id);
          if (!Player.spendCoins(ec.gold)) { this.say('金币不足，进化需要 ' + ec.gold); this.g.playSfx('sfx_equipfail', 0.3); return; }
          if (ec.gem && !Player.spendGems(ec.gem)) {
            Player.addCoins(ec.gold);
            this.say('宝石不足，进化需要 ' + ec.gem);
            this.g.playSfx('sfx_equipfail', 0.3);
            return;
          }
          Player.setAlly(b.id, this.lvOf(b.id), evo + 1);
          if (window.Daily) Daily.count('allyUp', 1);
          this.say(this.nameOf(b.id) + ' 进化到 EVO ' + (evo + 1) + '，等级上限提高');
          this.g.playSfx('sfx_levelup', 0.44);
          this.g.playSfx('sfx_star', 0.3);
          return;
        }
        case 'squad': {
          const r = Player.toggleSquad(b.id);
          if (r === 'full') { this.say('上阵已满 3 名，请先下阵一个'); this.g.playSfx('sfx_equipfail', 0.3); return; }
          if (r === 'last') { this.say('至少要留 1 名盟友上阵'); this.g.playSfx('sfx_equipfail', 0.3); return; }
          this.say(Player.inSquad(b.id) ? this.nameOf(b.id) + ' 已上阵' : this.nameOf(b.id) + ' 已下阵');
          // 换阵容后台预取骨架，下一场战斗不用等
          if (this.g.battle && this.g.battle.ensureAllySprites) this.g.battle.ensureAllySprites().catch(() => {});
          this.g.playSfx('sfx_equip', 0.34);
          return;
        }
      }
    }
  }

  nameOf(id) {
    const a = this.allies().find(x => x.charID === id);
    return a ? a.name : ('盟友 ' + id);
  }
}
