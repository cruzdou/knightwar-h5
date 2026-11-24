// ============================================================
//  玩家存档（localStorage）：金币 / 宝石 / 体力 / 星级 / 英雄 / 城堡等级
//  H5 版自己的一套进度，原版 SQLite 存档不参与
// ============================================================

const SAVE_KEY = 'kw2_h5_save_v1';

class PlayerState {
  constructor() {
    this.coins = 445;
    this.gems = 55;
    this.stamina = 50;
    this.stars = {};        // { '1-1': 3, ... }
    this.charID = 1;
    this.castleLevel = 1;
    // 装备：每个英雄三格（weapon / armor / artifact），值是装备表里的 itemID
    this.equipped = {};
    // 装备强化等级：{ itemID: level }
    this.itemLv = {};
    // 材料背包：{ itemID: 数量 }（材料表 601~643）
    this.mats = {};
    // 已打造装备：{ itemID: true }；未拥有的装备要先按配方打造才能强化/穿戴
    this.owned = {};
    // 英雄等级：{ charID: level }（上限取 gameCharacters.json 的 levelMax）
    this.heroLv = {};
    // 技能等级：{ 'charID:skillID': level }（上限取 skillList 的 maxLevel）
    this.skillLv = {};
    // 英雄进化阶段：{ charID: 1~8 }（取 gameCharacters.json 的 evolutionList）
    this.heroEvo = {};
    // 盟友：{ allyID: { lv, evo } }（取 gameAllies.json）；squad 为上场顺序（最多 3）
    this.allies = {};
    this.squad = [1];
    // 宝箱保底计数：{ 'boxID:slot': {m,h,s} }
    this.chestPity = {};
    // Raid 票（TreasureBox.json 的 raidTicketXxx 掉落）
    this.raidTickets = { normal: 0, medium: 0, hard: 0, super: 0 };
    // Boss 关首通记录：{ '1-1': true }
    this.bossClear = {};
    // 设置项（设置面板读写）：音效开关 / 是否已评过分
    this.sfxOn = true;
    this.rated = false;
    this.load();
    if (!Object.keys(this.mats).length) {
      // 新档给一套启动材料，够打第一件装备 + 一次材料合成
      this.mats = { 641: 20, 642: 10, 643: 5, 601: 10, 603: 4, 606: 6 };
    }
    if (!Object.keys(this.owned).length) {
      // 初始只拥有每系第一件（剑 1 / 弓 10 / 杖 19、护甲 201/210/219、神器 409）
      this.owned = { 1: true, 10: true, 19: true, 201: true, 210: true, 219: true, 409: true };
    }
  }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      for (const k of ['coins', 'gems', 'stamina', 'charID', 'castleLevel']) {
        if (typeof s[k] === 'number') this[k] = s[k];
      }
      if (s.stars && typeof s.stars === 'object') this.stars = s.stars;
      if (s.equipped && typeof s.equipped === 'object') this.equipped = s.equipped;
      if (s.itemLv && typeof s.itemLv === 'object') this.itemLv = s.itemLv;
      if (s.mats && typeof s.mats === 'object') this.mats = s.mats;
      if (s.owned && typeof s.owned === 'object') this.owned = s.owned;
      if (s.heroLv && typeof s.heroLv === 'object') this.heroLv = s.heroLv;
      if (s.skillLv && typeof s.skillLv === 'object') this.skillLv = s.skillLv;
      if (s.heroEvo && typeof s.heroEvo === 'object') this.heroEvo = s.heroEvo;
      if (s.allies && typeof s.allies === 'object') this.allies = s.allies;
      if (Array.isArray(s.squad)) this.squad = s.squad;
      if (s.chestPity && typeof s.chestPity === 'object') this.chestPity = s.chestPity;
      if (s.raidTickets && typeof s.raidTickets === 'object') this.raidTickets = s.raidTickets;
      if (s.bossClear && typeof s.bossClear === 'object') this.bossClear = s.bossClear;
      if (typeof s.sfxOn === 'boolean') this.sfxOn = s.sfxOn;
      if (typeof s.rated === 'boolean') this.rated = s.rated;
    } catch (e) { /* 存档损坏就用默认值 */ }
    // 新档默认送 1 号盟友（Elf Archer），否则战场上一个帮手都没有
    if (!Object.keys(this.allies).length) this.allies = { 1: { lv: 1, evo: 1 } };
    if (!Array.isArray(this.squad) || !this.squad.length) this.squad = [1];
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        coins: this.coins, gems: this.gems, stamina: this.stamina,
        stars: this.stars, charID: this.charID, castleLevel: this.castleLevel,
        equipped: this.equipped, itemLv: this.itemLv,
        mats: this.mats, owned: this.owned,
        heroLv: this.heroLv, skillLv: this.skillLv,
        heroEvo: this.heroEvo, allies: this.allies, squad: this.squad,
        chestPity: this.chestPity, raidTickets: this.raidTickets, bossClear: this.bossClear,
        sfxOn: this.sfxOn, rated: this.rated
      }));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  addCoins(n) { this.coins = Math.max(0, this.coins + n); this.save(); }
  addGems(n) { this.gems = Math.max(0, this.gems + n); this.save(); }
  spendCoins(n) {
    if (this.coins < n) return false;
    this.coins -= n; this.save(); return true;
  }
  spendGems(n) {
    if (this.gems < n) return false;
    this.gems -= n; this.save(); return true;
  }

  // ---------- 装备（每英雄三格：武器 / 护甲 / 神器） ----------
  equippedOf(charID) { return this.equipped[charID] || {}; }

  // 同一格再点一次 = 卸下；返回是否已装备
  setEquip(charID, slot, itemID) {
    const e = Object.assign({}, this.equipped[charID] || {});
    const on = e[slot] !== itemID;
    if (on) e[slot] = itemID; else delete e[slot];
    this.equipped[charID] = e;
    this.save();
    return on;
  }

  // ---------- 装备强化等级 ----------
  lvOf(itemID) { return this.itemLv[itemID] || 1; }
  setLv(itemID, lv) { this.itemLv[itemID] = lv; this.save(); }

  // ---------- 材料背包 ----------
  matOf(itemID) { return this.mats[itemID] || 0; }
  addMat(itemID, n) {
    this.mats[itemID] = this.matOf(itemID) + n;
    this.save();
  }
  // list: [{itemId, numbItem}]；全部够才扣
  canSpendMats(list) {
    return list.every(x => this.matOf(x.itemId) >= x.numbItem);
  }
  spendMats(list) {
    if (!this.canSpendMats(list)) return false;
    for (const x of list) this.mats[x.itemId] = this.matOf(x.itemId) - x.numbItem;
    this.save();
    return true;
  }

  // ---------- 已打造装备 ----------
  hasItem(itemID) { return !!this.owned[itemID]; }
  ownItem(itemID) { this.owned[itemID] = true; this.save(); }

  starsOf(levelName) { return this.stars[levelName] || 0; }
  setStars(levelName, n) {
    if (n > this.starsOf(levelName)) { this.stars[levelName] = n; this.save(); }
  }

  // ---------- 英雄 / 技能等级 ----------
  heroLvOf(charID) { return this.heroLv[charID] || 1; }
  setHeroLv(charID, lv) { this.heroLv[charID] = lv; this.save(); }

  skillLvOf(charID, skillID) { return this.skillLv[charID + ':' + skillID] || 1; }
  setSkillLv(charID, skillID, lv) { this.skillLv[charID + ':' + skillID] = lv; this.save(); }

  // ---------- 英雄进化 ----------
  heroEvoOf(charID) { return this.heroEvo[charID] || 1; }
  setHeroEvo(charID, evo) { this.heroEvo[charID] = evo; this.save(); }

  // ---------- 盟友 ----------
  allyOf(allyID) { return this.allies[allyID] || null; }
  hasAlly(allyID) { return !!this.allies[allyID]; }
  setAlly(allyID, lv, evo) {
    this.allies[allyID] = { lv: lv, evo: evo };
    this.save();
  }
  recruitAlly(allyID) {
    if (!this.allies[allyID]) this.allies[allyID] = { lv: 1, evo: 1 };
    if (this.squad.indexOf(allyID) < 0 && this.squad.length < 3) this.squad.push(allyID);
    this.save();
  }
  inSquad(allyID) { return this.squad.indexOf(allyID) >= 0; }
  // 上阵/下阵；下阵后队伍不能为空（至少留 1 个）
  toggleSquad(allyID) {
    const i = this.squad.indexOf(allyID);
    if (i >= 0) {
      if (this.squad.length <= 1) return 'last';
      this.squad.splice(i, 1);
    } else {
      if (this.squad.length >= 3) return 'full';
      this.squad.push(allyID);
    }
    this.save();
    return 'ok';
  }

  // ---------- 宝箱保底 / Raid 票 / Boss 首通 ----------
  pityOf(boxID, slotKey) { return this.chestPity[boxID + ':' + slotKey] || { m: 0, h: 0, s: 0 }; }
  setPity(boxID, slotKey, p) { this.chestPity[boxID + ':' + slotKey] = p; this.save(); }

  addRaidTicket(kind, n) {
    this.raidTickets[kind] = (this.raidTickets[kind] || 0) + n;
    this.save();
  }
  raidTicketTotal() {
    const k = this.raidTickets;
    return (k.normal || 0) + (k.medium || 0) + (k.hard || 0) + (k.super || 0);
  }

  isBossCleared(levelName) { return !!this.bossClear[levelName]; }
  setBossCleared(levelName) { this.bossClear[levelName] = true; this.save(); }

  // 重置进度：三个存档键一起清掉，然后重新载入页面
  resetAll() {
    try {
      localStorage.removeItem('kw2_h5_save_v1');
      localStorage.removeItem('kw2_h5_daily_v1');
      localStorage.removeItem('kw2_h5_ads_v1');
    } catch (e) { /* 忽略 */ }
    location.reload();
  }
}

const Player = new PlayerState();
