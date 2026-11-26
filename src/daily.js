// ============================================================
//  每日系统（daily.js）
//  - 每日任务：ListDailyQuest.json 的 7 组任务（原包条件与奖励）
//  - 每日事件：DailyEvent.json 的 5 组事件、每组 4 档，按表里的
//    common/rare/epic/legendary 概率开箱
//  - 7 日签到：一天领一次，第 7 天领完回到第 1 天
//  进度全部来自真实操作（击杀 / 通关 / 开箱 / 强化 / 英雄训练 / 技能升级 / 在线时长）
// ============================================================

const DAILY_KEY = 'kw2_h5_daily_v1';

function dailyToday() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// 每日任务的进度来源（原表 questType + TargetID 映射到计数器）
function questCounterKey(t) {
  if (t.questType === 'Kill') return 'kill';
  if (t.questType === 'Chest') return 'chest';
  if (t.questType === 'CompleteAllDaily') return 'allquest';
  if (t.questType === 'Upgrade') {
    // TargetID：0=英雄 1=盟友 2=装备 4=技能
    if (t.TargetID === 0) return 'heroUp';
    if (t.TargetID === 1) return 'allyUp';
    if (t.TargetID === 2) return 'itemUp';
    if (t.TargetID === 4) return 'skillUp';
    return 'upgrade';
  }
  return 'other';
}

// 每日事件的进度来源
function eventCounterKey(t) {
  switch (t.eventType) {
    case 'Time': return 'onlineSec';
    case 'LevelPass': return 'win';
    case 'HardLevelPass': return 'hardWin';
    case 'KillEnemy': return 'kill';
    case 'KillBoss': return 'bossKill';
    default: return 'other';
  }
}

// 签到 7 天的奖励（原包没有这张表，按原版奖励量级自定）
const SIGN_REWARDS = [
  { kind: 'coin', n: 600, txt: '金币 +600' },
  { kind: 'mat', n: 3, id: 641, txt: '材料 x3' },
  { kind: 'gem', n: 10, txt: '宝石 +10' },
  { kind: 'chest', tier: 'common', txt: '铜宝箱' },
  { kind: 'coin', n: 2000, txt: '金币 +2000' },
  { kind: 'gem', n: 25, txt: '宝石 +25' },
  { kind: 'chest', tier: 'legendary', txt: '传说宝箱' }
];

const DAILY_QUEST_CN = {
  1: '英雄训练', 2: '怪物猎人', 3: '盟友养成', 4: '开宝石宝箱',
  5: '装备强化', 6: '技能升级', 7: '全部完成'
};
const DAILY_EVENT_CN = {
  1: '在线时长', 2: '关卡通关', 3: '困难关卡', 4: '击杀敌人', 5: '击杀首领'
};

const Daily = {
  ready: false,
  quests: [],
  events: [],
  rec: null,
  _dirty: 0,

  async init() {
    if (this.ready) { this.rollover(); return; }
    try { this.quests = (await fetch('data/ListDailyQuest.json').then(r => r.json())).listQuestModel || []; }
    catch (e) { this.quests = []; }
    try { this.events = (await fetch('data/DailyEvent.json').then(r => r.json())).listDailyEventModel || []; }
    catch (e) { this.events = []; }
    this._load();
    this.ready = true;
  },

  // ---------- 存档 ----------
  _load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (e) { s = {}; }
    this.rec = {
      date: s.date || dailyToday(),
      counters: s.counters || {},
      questClaims: s.questClaims || {},
      eventClaims: s.eventClaims || {},
      signDay: s.signDay || 1,
      signDate: s.signDate || ''
    };
    this.rollover();
  },

  save() {
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify(this.rec));
    } catch (e) { /* 隐私模式忽略 */ }
  },

  // 跨天：清空当日计数与领取记录（签到进度保留）
  rollover() {
    if (!this.rec) return;
    const t = dailyToday();
    if (this.rec.date !== t) {
      this.rec.date = t;
      this.rec.counters = {};
      this.rec.questClaims = {};
      this.rec.eventClaims = {};
      this.rec.onlineSec = 0;
      this.save();
    }
  },

  // ---------- 进度写入（游戏各处调用） ----------
  count(key, n) {
    if (!this.rec) this._load();
    this.rollover();
    const d = (n === undefined ? 1 : n);
    this.rec.counters[key] = (this.rec.counters[key] || 0) + d;
    this.save();
  },

  get(key) { return (this.rec && this.rec.counters[key]) || 0; },

  // 在线时长（主循环每帧调用）
  tick(dt) {
    if (!this.rec) return;
    this.rec.counters.onlineSec = (this.rec.counters.onlineSec || 0) + dt;
    this._dirty += dt;
    if (this._dirty > 10) { this._dirty = 0; this.save(); }
  },

  // ---------- 每日任务 ----------
  // 某条任务的进度值（need=0 表示无数量要求，如「全部完成」）
  questValue(t) {
    if (t.questType === 'CompleteAllDaily') return this.allQuestDoneCount();
    return this.get(questCounterKey(t));
  },

  questDone(t) {
    const need = t.RequestValue1 || 0;
    return this.questValue(t) >= need;
  },

  claimQuest(gi, ki, replace) {
    const g = this.quests[gi];
    if (!g) return '';
    const t = g.listQuestType[ki];
    if (!t) return '';
    const key = gi + '_' + ki;
    if (this.rec.questClaims[key]) return '今天已经领过了';
    if (t.questType === 'CompleteAllDaily') {
      if (!this.allQuestDone()) return '其他任务还没全部完成';
    } else if (!this.questDone(t)) {
      return '进度不足';
    }
    this.rec.questClaims[key] = true;
    this.save();
    const txt = this.grantQuestReward(t.RewardItems || []);
    // 「全部完成」领取后，其余任务的金币总额外不再重复发
    return txt || '已领取';
  },

  // 「全部完成」条件：除它自己以外的所有任务档都已领取
  allQuestDoneCount() {
    let total = 0, done = 0;
    for (let gi = 0; gi < this.quests.length; gi++) {
      const q = this.quests[gi];
      for (let ki = 0; ki < q.listQuestType.length; ki++) {
        const t = q.listQuestType[ki];
        if (t.questType === 'CompleteAllDaily') continue;
        total++;
        if (this.rec.questClaims[gi + '_' + ki]) done++;
      }
    }
    return done;
  },
  allQuestTotal() {
    let n = 0;
    for (const q of this.quests) for (const t of q.listQuestType) if (t.questType !== 'CompleteAllDaily') n++;
    return n;
  },
  allQuestDone() { return this.allQuestDoneCount() >= this.allQuestTotal() && this.allQuestTotal() > 0; },

  grantQuestReward(items) {
    const parts = [];
    for (const r of items) {
      const it = r.items || {};
      const n = r.numb || it.numbItems || 1;
      if (it.itemID === -3) { Player.addGems(n); parts.push('宝石 +' + n); }
      else if (it.itemID === -2) { Player.addCoins(n); parts.push('金币 +' + n); }
      else if (it.itemID > 0) { Player.addMat(it.itemID, n); parts.push((it.itemName || ('材料#' + it.itemID)) + ' +' + n); }
    }
    return parts.join('，');
  },

  // ---------- 每日事件 ----------
  eventValue(t) { return this.get(eventCounterKey(t)); },
  eventDone(t) { return this.eventValue(t) >= (t.RequestValue1 || 0); },

  claimEvent(gi, ti) {
    const g = this.events[gi];
    if (!g) return '';
    const t = g.listEventType[ti];
    if (!t) return '';
    const key = gi + '_' + ti;
    if (this.rec.eventClaims[key]) return '今天已经领过了';
    if (!this.eventDone(t)) return '进度不足';
    this.rec.eventClaims[key] = true;
    this.save();
    // 按表里的四档概率掷一次
    const rates = [
      ['common', t.commonPrizeRate || 0],
      ['rare', t.rarePrizeRate || 0],
      ['epic', t.epicPrizeRate || 0],
      ['legendary', t.legendDaryPrizeRate || 0]
    ];
    let total = 0;
    for (const r of rates) total += r[1];
    if (total <= 0) return this.openChest('common');
    let x = Math.random() * total;
    for (const r of rates) { x -= r[1]; if (x <= 0) return this.openChest(r[0]); }
    return this.openChest('common');
  },

  // 宝箱开奖（H5 侧自定数量级，概率来自原表）
  openChest(tier) {
    const parts = [];
    const addCoin = n => { Player.addCoins(n); parts.push('金币 +' + n); };
    const addGem = n => { Player.addGems(n); parts.push('宝石 +' + n); };
    const addMat = (id, n) => { Player.addMat(id, n); parts.push((window.game && window.game.itemByID && window.game.itemByID[id] ? window.game.itemByID[id].name : '材料') + ' +' + n); };
    if (tier === 'common') { addCoin(500 + Math.floor(Math.random() * 400)); addMat(641, 1 + Math.floor(Math.random() * 2)); }
    else if (tier === 'rare') { addCoin(1500 + Math.floor(Math.random() * 900)); addGem(3 + Math.floor(Math.random() * 4)); addMat(603, 2); }
    else if (tier === 'epic') { addGem(25 + Math.floor(Math.random() * 15)); addMat(642, 3); const u = this.upgradeEquip(2); if (u) parts.push(u); }
    else { addGem(80 + Math.floor(Math.random() * 40)); addMat(643, 5); const u = this.upgradeEquip(4); if (u) parts.push(u); }
    return parts.join('，');
  },

  // 把「已拥有且未满级」的装备里等级最低那件强化 n 级
  upgradeEquip(n) {
    const g = window.game;
    if (!g || !g.itemByID) return '';
    let best = null;
    for (const id of Object.keys(Player.owned)) {
      const it = g.itemByID[id];
      if (!it) continue;
      const lv = Player.lvOf(it.itemID), max = it.maxLevelUpgrade || 10;
      if (lv >= max) continue;
      if (!best || lv < Player.lvOf(best.itemID)) best = it;
    }
    if (!best) return '';
    const lv = Math.min(best.maxLevelUpgrade || 10, Player.lvOf(best.itemID) + n);
    Player.setLv(best.itemID, lv);
    return best.name + ' → Lv ' + lv;
  },

  // ---------- 签到 ----------
  canSign() { return this.rec.signDate !== dailyToday(); },

  sign() {
    if (!this.canSign()) return '今天已经签到过了';
    const r = SIGN_REWARDS[this.rec.signDay - 1] || SIGN_REWARDS[0];
    let txt = r.txt;
    if (r.kind === 'coin') Player.addCoins(r.n);
    else if (r.kind === 'gem') Player.addGems(r.n);
    else if (r.kind === 'mat') Player.addMat(r.id, r.n);
    else if (r.kind === 'chest') txt = this.openChest(r.tier);
    this.rec.signDate = dailyToday();
    Player.signTotal = (Player.signTotal || 0) + 1;
    Player.save();
    this.rec.signDay = this.rec.signDay >= 7 ? 1 : this.rec.signDay + 1;
    this.save();
    return txt;
  },

  // ---------- 小红点用：今日可领数量 ----------
  claimableCount() {
    return this.sectionClaimable('sign') + this.sectionClaimable('quest') + this.sectionClaimable('event');
  },

  sectionClaimable(kind) {
    if (kind === 'sign') return this.canSign() ? 1 : 0;
    let n = 0;
    if (kind === 'quest') {
      for (let gi = 0; gi < this.quests.length; gi++) {
        const q = this.quests[gi];
        for (let ki = 0; ki < q.listQuestType.length; ki++) {
          const t = q.listQuestType[ki], key = gi + '_' + ki;
          if (this.rec.questClaims[key]) continue;
          if (t.questType === 'CompleteAllDaily' ? this.allQuestDone() : this.questDone(t)) n++;
        }
      }
    }
    if (kind === 'event') {
      for (let gi = 0; gi < this.events.length; gi++) {
        const q = this.events[gi];
        for (let ti = 0; ti < q.listEventType.length; ti++) {
          const key = gi + '_' + ti;
          if (this.rec.eventClaims[key]) continue;
          if (this.eventDone(q.listEventType[ti])) n++;
        }
      }
    }
    return n;
  }
};

// ============================================================
//  每日页（三个页签：签到礼包 / 每日任务 / 每日事件）
// ============================================================
class DailyScene {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.hot = [];
    this.toast = '';
    this.toastT = 0;
    this.tab = 'sign';
    this.time = 0;
    this.ready = false;
  }

  async init() {
    if (this.inited) return;
    this.inited = true;
    await Daily.init();
    // 键名与 core.js / tabs.js 里的公共外框保持一致（drawTopBar / drawBottomNav 按语义键取图）
    const defs = {
      coin: 'UI_cur_coin.png', gem: 'UI_cur_gem.png', stamina: 'UI_cur_stamina.png',
      plus: 'UI2_icon_plus.png', ribbon: 'result_title_ribbon.png',
      btnY: 'common_btn_yellow.png', btnB: 'common_btn_blue.png',
      star: 'result_star.png', starDim: 'result_star_dim.png',
      chest: 'common_item_chest.png', anvil: 'common_item_anvil.png',
      book: 'common_item_book_skill.png', crown: 'common_item_crown.png',
      potion: 'common_item_potionGreen.png', ring: 'common_item_ring.png',
      arrowBack: 'btn_icon_arrow_back.png',
      navShop: 'UI_navibar_shop.png', navCraft: 'UI_navibar_craft.png',
      navFight: 'UI_navibar_fight.png', navHero: 'UI_navibar_hero.png',
      navCastle: 'UI_navibar_castle.png',
      chest0: 'shop_img_chest_0.png', chest2: 'shop_img_chest_2.png', chest4: 'shop_img_chest_4.png'
    };
    const t = {};
    await Promise.all(Object.entries(defs).map(async ([k, f]) => {
      try { t[k] = await loadImage(f); } catch (e) { t[k] = null; }
    }));
    this.tex = t;
    this.ready = true;
  }

  say(msg) { this.toast = msg; this.toastT = 0; }

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2b1d10');
    bg.addColorStop(0.5, '#332413');
    bg.addColorStop(1, '#241708');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.hot.length = 0;
    drawTopBar(ctx, this.tex, Player, this.hot);
    this.drawBack();
    this.drawTabs();
    if (this.tab === 'sign') this.drawSign();
    else if (this.tab === 'quest') this.drawQuests();
    else this.drawEvents();
    drawBottomNav(ctx, this.tex, null, this.hot);
    drawToast(ctx, this.toast, this.toastT);
  }

  drawBack() {
    const ctx = this.ctx;
    const x = W - 52, y = 14, w = 42, h = 46;
    roundRect(ctx, x, y, w, h, 9, '#34220d', '#8f6122', 2);
    const img = this.tex.arrowBack;
    if (img) drawIcon(ctx, img, x + w / 2, y + h / 2, 0.34);
    else text(ctx, '←', x + w / 2, y + h / 2, 20, '#ffe6a8', 'center');
    this.hot.push({ x, y, w, h, act: 'back' });
  }

  drawTabs() {
    const ctx = this.ctx;
    const y = 76, h = 50, gap = 8, w = (W - 24 - gap * 2) / 3;
    const defs = [
      { k: 'sign', lbl: '签到礼包', img: 'shop_img_chest_2.png' },
      { k: 'quest', lbl: '每日任务', img: 'common_item_book_skill.png' },
      { k: 'event', lbl: '每日事件', img: 'common_item_anvil.png' }
    ];
    defs.forEach((d, i) => {
      const x = 12 + i * (w + gap), on = this.tab === d.k;
      roundRect(ctx, x, y, w, h, 9, on ? '#442b0f' : '#3f2d19', on ? '#ffb645' : '#9a6630', 2);
      text(ctx, d.lbl, x + w / 2, y + h / 2, 17, on ? '#ffffff' : '#e8cfa0', 'center', '#2b1d10');
      this.hot.push({ x, y, w, h, act: 'tab', tab: d.k });
      // 该页签今日可领数量
      const n = Daily.sectionClaimable(d.k);
      if (n > 0) {
        const bx = x + w - 18, by = y + 14;
        ctx.beginPath();
        ctx.arc(bx, by, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#c8382f';
        ctx.fill();
        text(ctx, String(n), bx, by, 12, '#fff', 'center');
      }
    });
  }

  // ---------- 签到 ----------
  drawSign() {
    const ctx = this.ctx;
    const title = '每日签到 · 第 ' + Daily.rec.signDay + ' / 7 天';
    text(ctx, title, 14, 150, 19, '#ffe9a8', 'left', '#3a2408');
    text(ctx, Daily.canSign() ? '今天可签到，点下面「领取」' : '今天已签到，明天再来', W - 16, 150, 13, '#d9b98a', 'right');

    const cols = 4, gap = 10;
    const cw = (W - 24 - gap * (cols - 1)) / cols, ch = 252;
    const y0 = 176;
    SIGN_REWARDS.forEach((r, i) => {
      const x = 12 + (i % cols) * (cw + gap);
      const y = y0 + Math.floor(i / cols) * (ch + gap);
      const day = i + 1;
      // 已签到的日子 = 当前签到位之前的第几天；最后一天领完（signDay 回到 1）时，第 7 天显示已领
      const signed = day < Daily.rec.signDay || (Daily.rec.signDay === 1 && !Daily.canSign() && day === 7);
      const isToday = Daily.canSign() && Daily.rec.signDay === day;
      // 第 3 行只有 3 张卡，宽度对齐上一行
      roundRect(ctx, x, y, cw, ch, 10, isToday ? '#3a260f' : '#3f2d19',
        isToday ? '#ffcf5c' : (signed ? '#3c541c' : '#9a6630'), isToday ? 2.5 : 2);
      text(ctx, 'DAY ' + day, x + cw / 2, y + 22, 13, isToday ? '#ffcf5c' : '#d9b98a', 'center');
      const icon = r.kind === 'coin' ? 'coin'
        : r.kind === 'gem' ? 'gem'
          : r.kind === 'mat' ? 'ring'
            : (r.tier === 'legendary' ? 'chest4' : (r.tier === 'epic' ? 'chest2' : 'chest0'));
      const img = this.tex[icon];
      if (img) {
        const hh = 92, ww = Math.min(cw - 30, hh * img.width / img.height);
        ctx.drawImage(img, x + (cw - ww) / 2, y + 52, ww, hh);
      }
      text(ctx, r.txt, x + cw / 2, y + 168, 15, '#fff6dd', 'center', '#2b1d10');
      const bw = cw - 34, bh = 38, bx = x + 17, by = y + ch - 52;
      if (isToday) {
        if (this.tex.btnY) ctx.drawImage(this.tex.btnY, bx, by, bw, bh);
        else roundRect(ctx, bx, by, bw, bh, 7, '#e0a52a');
        text(ctx, '领取', bx + bw / 2, by + bh / 2, 15, '#fff', 'center', '#1a1206');
        this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'sign' });
      } else {
        roundRect(ctx, bx, by, bw, bh, 7, signed ? '#2f3e16' : '#31200f', null, 0);
        text(ctx, signed ? '已领取' : '未解锁', bx + bw / 2, by + bh / 2, 13, signed ? '#8ac94a' : '#836632', 'center');
      }
    });

    // 说明
    const note = '签到进度一天一次，第 7 天领完后回到第 1 天循环；每日任务与事件在跨天后重置进度。';
    text(ctx, note, W / 2, H - 148, 12, '#b5926a', 'center');

    // 本期签到进度条（7 个圆点：已领 / 今天 / 未到）
    const py = 176 + 2 * (252 + gap) + 12;
    roundRect(ctx, 12, py, W - 24, 150, 10, '#3f2d19', '#9a6630', 1.5);
    text(ctx, '本期签到进度', 28, py + 24, 15, '#f5d67a', 'left');
    text(ctx, (Daily.rec.signDay - 1) + '/7 天已签', W - 28, py + 24, 13, '#d9b98a', 'right');
    const dotY = py + 76, stepX = (W - 80) / 6;
    for (let i = 0; i < 7; i++) {
      const cx = 40 + i * stepX;
      const signed = i + 1 < Daily.rec.signDay;
      const isToday = i + 1 === Daily.rec.signDay;
      ctx.beginPath();
      ctx.arc(cx, dotY, 16, 0, Math.PI * 2);
      ctx.fillStyle = signed ? '#3c541c' : (isToday ? '#e0a52a' : '#31200f');
      ctx.fill();
      ctx.strokeStyle = signed ? '#8ac94a' : (isToday ? '#ffdf9a' : '#443117');
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, String(i + 1), cx, dotY, 13, signed ? '#8ac94a' : (isToday ? '#fff' : '#836632'), 'center');
    }
    text(ctx, '第 7 天必得传说宝箱（宝石 + 材料 + 装备强化）', W / 2, py + 124, 12, '#ffcf5c', 'center');

    // 7 天累计奖励 + 规则说明（补满下方空白区）
    const sy = py + 162;
    roundRect(ctx, 12, sy, W - 24, 226, 10, '#26180a', '#9a6630', 1.5);
    text(ctx, '7 天累计奖励', 28, sy + 26, 15, '#f5d67a', 'left');
    text(ctx, '全勤可拿', W - 28, sy + 26, 12, '#d9b98a', 'right');
    const chips = [
      ['coin', '金币 +2600'],
      ['gem', '宝石 +35'],
      ['ring', '材料 ×3'],
      ['chest4', '宝箱 ×2']
    ];
    chips.forEach((c, i) => {
      const cx = 24 + i * 170, cy2 = sy + 44;
      roundRect(ctx, cx, cy2, 156, 62, 9, '#21140a', '#443117', 1);
      const img = this.tex[c[0]];
      if (img) {
        const hh = 30, ww = hh * img.width / img.height;
        ctx.drawImage(img, cx + 12, cy2 + 16, ww, hh);
      }
      text(ctx, c[1], cx + 12 + 34, cy2 + 24, 13, '#ffe9a8', 'left');
      text(ctx, ['第 1 / 5 天', '第 3 / 6 天', '第 2 天', '第 4 / 7 天'][i], cx + 12 + 34, cy2 + 44, 11, '#c3a172', 'left');
    });
    text(ctx, '• 每天登录领 1 份，跨天刷新；断签不会清掉已领的天数', 28, sy + 132, 12, '#e8cfa0', 'left');
    text(ctx, '• 第 7 天领完自动回到第 1 天，重新开一轮', 28, sy + 154, 12, '#e8cfa0', 'left');
    text(ctx, '• 每日任务与每日事件同样跨天重置，记得顺带领掉', 28, sy + 176, 12, '#e8cfa0', 'left');
    text(ctx, '• 宝箱会开出装备 / 材料 / 宝石，重复装备自动转强化', 28, sy + 198, 12, '#e8cfa0', 'left');
  }

  // ---------- 每日任务 ----------
  drawQuests() {
    const ctx = this.ctx;
    text(ctx, '每日任务 · 原包 7 组条件与奖励', 14, 150, 17, '#ffe9a8', 'left', '#3a2408');
    const doneAll = Daily.allQuestDoneCount(), totalAll = Daily.allQuestTotal();
    text(ctx, doneAll + '/' + totalAll + ' 已完成', W - 16, 150, 13, '#e8cfa0', 'right');

    let y = 172;
    Daily.quests.forEach((q, gi) => {
      const items = q.listQuestType || [];
      const rowH = 30 + items.length * 54;
      // 组外框
      roundRect(ctx, 12, y, W - 24, rowH, 10, '#3f2d19', '#9a6630', 1.5);
      text(ctx, (gi + 1) + '. ' + (DAILY_QUEST_CN[q.id] || q.name), 26, y + 18, 15, '#f5d67a', 'left');
      text(ctx, q.description || '', 26 + 106, y + 18, 11, '#b5926a', 'left');

      items.forEach((t, ki) => {
        const ry = y + 28 + ki * 54;
        const key = gi + '_' + ki;
        const claimed = !!Daily.rec.questClaims[key];
        const isAll = t.questType === 'CompleteAllDaily';
        const val = isAll ? Daily.allQuestDoneCount() : Daily.questValue(t);
        const need = isAll ? Daily.allQuestTotal() : (t.RequestValue1 || 0);
        const done = isAll ? Daily.allQuestDone() : Daily.questDone(t);

        roundRect(ctx, 24, ry, W - 48, 46, 8, claimed ? '#1c200d' : (done ? '#1b2a1f' : '#20140a'),
          claimed ? '#3c541c' : (done ? '#527c2d' : '#443117'), 1);
        // 目标文字
        const needTxt = isAll ? '领完其它全部任务' : t.questType + ' ' + need +
          (t.questType === 'Upgrade' ? ['（英雄）', '（盟友）', '（装备）', '', '（技能）'][t.TargetID] || '' : '');
        text(ctx, needTxt, 36, ry + 12, 12, '#e8cfa0', 'left');
        // 进度条
        const pct = need > 0 ? Math.min(1, val / need) : (done ? 1 : 0);
        roundRect(ctx, 36, ry + 26, 260, 7, 3.5, '#180f0a', '#3d2d14', 1);
        if (pct > 0) roundRect(ctx, 36, ry + 26, Math.max(4, 260 * pct), 7, 3.5, done ? '#527c2d' : '#d99a2b');
        text(ctx, Math.min(val, need) + '/' + need, 306, ry + 12, 12, '#d9b98a', 'left');
        // 奖励
        const rw = (t.RewardItems || []).map(r => (r.items && r.items.itemID === -3 ? '宝石' : '金币') + ' +' + (r.numb || 1)).join(' ');
        text(ctx, rw, 380, ry + 12, 13, '#ffe9a8', 'left');
        // 领取按钮
        const bw = 96, bh = 30, bx = W - 24 - 12 - bw, by = ry + 8;
        if (claimed) {
          roundRect(ctx, bx, by, bw, bh, 7, '#20250f', null, 0);
          text(ctx, '已领取', bx + bw / 2, by + bh / 2, 13, '#8ac94a', 'center');
        } else if (done) {
          if (this.tex.btnY) ctx.drawImage(this.tex.btnY, bx, by, bw, bh);
          else roundRect(ctx, bx, by, bw, bh, 7, '#e0a52a');
          text(ctx, '领取', bx + bw / 2, by + bh / 2, 15, '#fff', 'center', '#1a1206');
          this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'claimQuest', gi, ki });
        } else {
          roundRect(ctx, bx, by, bw, bh, 7, '#31200f', '#443117', 1);
          text(ctx, '进行中', bx + bw / 2, by + bh / 2, 13, '#b5926a', 'center');
        }
      });
      y += rowH + 8;
    });
  }

  // ---------- 每日事件 ----------
  drawEvents() {
    const ctx = this.ctx;
    text(ctx, '每日事件 · 概率来自 DailyEvent.json 四档', 14, 150, 16, '#ffe9a8', 'left', '#3a2408');
    text(ctx, '普通/稀有/史诗/传说', W - 16, 150, 12, '#d9b98a', 'right');

    let y = 172;
    Daily.events.forEach((g, gi) => {
      const tiers = g.listEventType || [];
      const boxH = 172;
      roundRect(ctx, 12, y, W - 24, boxH, 10, '#3f2d19', '#9a6630', 1.5);
      text(ctx, (gi + 1) + '. ' + (DAILY_EVENT_CN[g.id] || g.name), 26, y + 20, 15, '#f5d67a', 'left');
      const cw = (W - 24 - 24 - 3 * 8) / 4, ch = 128;
      tiers.slice(0, 4).forEach((t, ti) => {
        const x = 24 + ti * (cw + 8), ty = y + 36;
        const key = gi + '_' + ti;
        const claimed = !!Daily.rec.eventClaims[key];
        const val = Daily.eventValue(t), need = t.RequestValue1 || 1;
        const done = Daily.eventDone(t);
        roundRect(ctx, x, ty, cw, ch, 8, claimed ? '#1c200d' : (done ? '#1b2a1f' : '#20140a'),
          claimed ? '#3c541c' : (done ? '#527c2d' : '#443117'), 1);
        text(ctx, t.name || '', x + cw / 2, ty + 18, 11, '#e8cfa0', 'center');
        // 进度（在线时长按分钟显示）
        const isTime = t.eventType === 'Time';
        const vTxt = isTime ? (Math.floor(val / 60) + '/' + Math.floor(need / 60) + ' 分钟') : (Math.min(val, need) + '/' + need);
        text(ctx, vTxt, x + cw / 2, ty + 42, 13, done ? '#8ac94a' : '#d9b98a', 'center');
        // 概率条
        const pr = '普' + (t.commonPrizeRate || 0) + ' 稀' + (t.rarePrizeRate || 0) + '\n史' + (t.epicPrizeRate || 0) + ' 传' + (t.legendDaryPrizeRate || 0);
        const lines = pr.split('\n');
        lines.forEach((l, li) => text(ctx, l, x + cw / 2, ty + 64 + li * 15, 10, '#b5926a', 'center'));
        // 按钮
        const bw = cw - 20, bh = 32, bx = x + 10, by = ty + ch - 42;
        if (claimed) {
          roundRect(ctx, bx, by, bw, bh, 7, '#20250f', null, 0);
          text(ctx, '已领取', bx + bw / 2, by + bh / 2, 12, '#8ac94a', 'center');
        } else if (done) {
          if (this.tex.btnY) ctx.drawImage(this.tex.btnY, bx, by, bw, bh);
          else roundRect(ctx, bx, by, bw, bh, 7, '#e0a52a');
          text(ctx, '开箱', bx + bw / 2, by + bh / 2, 13, '#fff', 'center', '#1a1206');
          this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'claimEvent', gi, ti });
        } else {
          roundRect(ctx, bx, by, bw, bh, 7, '#31200f', '#443117', 1);
          text(ctx, '进行中', bx + bw / 2, by + bh / 2, 12, '#b5926a', 'center');
        }
      });
      y += boxH + 10;
    });
    text(ctx, '首领 = 每关最后一波的放大 BOSS；困难关卡按 ListAllLevel 的 levelMode=Hard 计。',
      W / 2, H - 142, 11, '#b5926a', 'center');
  }

  // ---------- 输入 ----------
  update(dt) {
    this.time += dt;
    if (this.toast) this.toastT += dt;
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
        case 'tab': this.tab = b.tab; this.g.playSfx('sfx_click', 0.3); return;
        case 'sign': {
          const msg = Daily.sign();
          this.say('签到奖励：' + msg);
          this.g.playSfx('sfx_claim', 0.36);
          this.g.playSfx('sfx_openbox', 0.24);
          return;
        }
        case 'claimQuest': {
          const msg = Daily.claimQuest(b.gi, b.ki);
          this.say(msg);
          this.g.playSfx('sfx_claim', 0.36);
          return;
        }
        case 'claimEvent': {
          const msg = Daily.claimEvent(b.gi, b.ti);
          this.say(msg);
          this.g.playSfx('sfx_openbox', 0.36);
          this.g.playSfx('sfx_claim', 0.26);
          return;
        }
      }
    }
  }
}

// 暴露到 window：其它脚本用 window.Daily 做进度埋点（顶层 const 不会自动挂到 window）
window.Daily = Daily;


