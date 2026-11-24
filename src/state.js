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
    } catch (e) { /* 存档损坏就用默认值 */ }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        coins: this.coins, gems: this.gems, stamina: this.stamina,
        stars: this.stars, charID: this.charID, castleLevel: this.castleLevel,
        equipped: this.equipped, itemLv: this.itemLv,
        mats: this.mats, owned: this.owned
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
}

const Player = new PlayerState();
