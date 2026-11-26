// ============================================================
//  宝箱系统（全部读 data/TreasureBox.json 的 listTreaSureModel）
//  - 每个箱子 3 个槽位（slot1~3），每槽独立的 普通/稀有/史诗/传说 概率
//  - 保底：连续没开出高档时按 increaseXxx / maxXxx 逐次抬高概率（存在存档里）
//  - 池子：listItemsNormal/Medium/Hard/SuperHard，按 dropRate 权重抽
//  - 奖励类型：ItemWeapon/Armor/Artifact（装备入库，重复则强化 +1）、
//    AllyHero（联盟友，重复则该盟友升 1 级）、Material（材料入包）
//  - 每箱另有 raidTicketXxx 概率掉 Raid 票（票已入账，Raid 玩法待原包配置）
// ============================================================

class ChestSystem {
  constructor() {
    this.list = [];
    this.game = null;
    this.ready = false;
  }

  async init(game) {
    if (this.ready) return;
    this.game = game || this.game;
    try {
      const d = await fetch('data/TreasureBox.json').then(r => r.json());
      this.list = d.listTreaSureModel || [];
    } catch (e) { this.list = []; }
    this.ready = true;
  }

  box(id) { return this.list.find(b => b.id === id) || null; }

  // 原包价格倒挂（Epic 比 Common 便宜），商店展示与扣费用同一套修正值
  static PRICE_FIX = {
    1:  { g1: 50,  g10: 450 },
    2:  { g1: 120, g10: 1080 },
    3:  { g1: 260, g10: 2340 },
    4:  { g1: 600, g10: 5400 },
    10: { g1: 150, g10: 1350 },
    11: { g1: 320, g10: 2880 }
  };
  static DESC = {
    1:  '3 件随机装备 · 保底普通',
    2:  '3 件随机装备 · 稀有概率提升',
    3:  '3 件随机装备 · 高概率史诗',
    4:  '3 件随机装备 · 可出传说',
    10: '3 张盟友卡 · 重复转升级',
    11: '3 张盟友卡 · 高概率史诗'
  };
  desc(id) { return ChestSystem.DESC[id] || '3 件随机奖励'; }

  // 购买价：优先宝石价，没有宝石价就用金币价（修正表优先）
  price(box, n) {
    const fx = ChestSystem.PRICE_FIX[box && box.id];
    if (fx) return n === 10 ? { cur: 'gem', v: fx.g10 } : { cur: 'gem', v: fx.g1 };
    const ten = n === 10;
    const gem = ten ? (box.x10Gem || 0) : (box.x1Gem || 0);
    const coin = ten ? (box.x10Coin || 0) : (box.x1Coin || 0);
    if (gem > 0) return { cur: 'gem', v: gem };
    return { cur: 'coin', v: coin };
  }

  // 该箱最高稀有度（用于商店小字）
  topRarity(box) {
    const slots = ['slot1', 'slot2', 'slot3'];
    const names = [];
    if (slots.some(s => (box[s] || {}).superHardRate > 0)) names.push('传说');
    if (slots.some(s => (box[s] || {}).hardRare > 0)) names.push('史诗');
    if (slots.some(s => (box[s] || {}).mediumRare > 0)) names.push('稀有');
    return names[0] || '普通';
  }

  rarityLabel(r) {
    return { normal: '普通', medium: '稀有', hard: '史诗', super: '传说' }[r] || r;
  }

  rarityColor(r) {
    return { normal: '#c9d6e2', medium: '#5fd08a', hard: '#7fc6ff', super: '#ffcf5c' }[r] || '#c9d6e2';
  }

  // ---------- 概率 ----------
  _rollRarity(box, slotKey) {
    const c = box[slotKey] || {};
    const p = Player.pityOf(box.id, slotKey);
    let m = c.mediumRare || 0, h = c.hardRare || 0, s = c.superHardRate || 0;
    // 保底上限：maxXxx 为 0 视作「不保底」
    if (c.maxMediumRare) m = Math.min(c.maxMediumRare, m + (p.m || 0) * (c.increaseMediumRare || 0));
    if (c.MaxHardRare) h = Math.min(c.MaxHardRare, h + (p.h || 0) * (c.increaseHardRare || 0));
    if (c.MaxsuperHardRate) s = Math.min(c.MaxsuperHardRate, s + (p.s || 0) * (c.increasesuperHardRate || 0));
    const roll = Math.random() * 100;
    let res = 'normal';
    if (roll < s) res = 'super';
    else if (roll < s + h) res = 'hard';
    else if (roll < s + h + m) res = 'medium';
    // 保底计数：出高档就清空；没出就一直累加
    if (res === 'super') Player.setPity(box.id, slotKey, { m: 0, h: 0, s: 0 });
    else if (res === 'hard') Player.setPity(box.id, slotKey, { m: 0, h: 0, s: (p.s || 0) + 1 });
    else if (res === 'medium') Player.setPity(box.id, slotKey, { m: 0, h: (p.h || 0) + 1, s: (p.s || 0) + 1 });
    else Player.setPity(box.id, slotKey, { m: (p.m || 0) + 1, h: (p.h || 0) + 1, s: (p.s || 0) + 1 });
    return res;
  }

  _pool(box, rarity) {
    const key = { normal: 'listItemsNormal', medium: 'listItemsMedium', hard: 'listItemsHard', super: 'listItemsSuperHard' }[rarity];
    return (box[key] || []).filter(x => x && x.items) || [];
  }

  _pick(box, rarity) {
    const pool = this._pool(box, rarity);
    if (!pool.length) return null;
    const total = pool.reduce((s, x) => s + Math.max(0, x.dropRate || 0), 0);
    if (!total) return pool[Math.floor(Math.random() * pool.length)];
    let r = Math.random() * total;
    for (const x of pool) {
      r -= Math.max(0, x.dropRate || 0);
      if (r <= 0) return x;
    }
    return pool[pool.length - 1];
  }

  // ---------- 发奖 ----------
  _grant(entry, boxName) {
    const it = (entry && entry.items) || {};
    const type = String(it.bonusItemTypes || '');
    const num = Math.max(1, it.numbItems || 1);
    // 联盟友卡
    if (/Ally/i.test(type)) {
      const allies = (this.game && this.game.allyList) || [];
      const a = allies.find(x => x.name === it.itemName);
      if (!a) return { label: it.itemName + '（未匹配到盟友表）', rarity: 'normal', kind: 'none' };
      if (!Player.hasAlly(a.charID)) {
        Player.recruitAlly(a.charID);
        return { label: '新盟友：' + a.name, rarity: 'super', kind: 'ally' };
      }
      // 重复：该盟友升 1 级（不超过当前阶上限）
      const st = this.game && this.game.allyStats ? this.game.allyStats(a.charID) : null;
      const rec = Player.allyOf(a.charID) || { lv: 1, evo: 1 };
      const cap = (st && st.levelMax) || 20;
      if (rec.lv >= cap) return { label: a.name + ' 已满级（重复卡）', rarity: 'normal', kind: 'dup' };
      Player.setAlly(a.charID, rec.lv + 1, rec.evo);
      return { label: a.name + ' 升级到 Lv ' + (rec.lv + 1), rarity: 'medium', kind: 'allyUp' };
    }
    // 材料
    if (/Material/i.test(type) || (it.itemID >= 601 && it.itemID <= 699)) {
      Player.addMat(it.itemID, num);
      return { label: (it.itemName || ('材料#' + it.itemID)) + ' x' + num, rarity: 'medium', kind: 'mat' };
    }
    // 装备：入库；重复则强化 +1
    if (/Item/i.test(type)) {
      if (!Player.hasItem(it.itemID)) {
        Player.ownItem(it.itemID);
        return { label: '新装备：' + (it.itemName || ('#' + it.itemID)), rarity: 'medium', kind: 'item' };
      }
      const max = (it.levelBonus && 10) || 10;
      const lv = Math.min(max, Player.lvOf(it.itemID) + 1);
      Player.setLv(it.itemID, lv);
      return { label: it.itemName + ' 强化到 Lv ' + lv, rarity: 'normal', kind: 'itemUp' };
    }
    // 兜底：按金币折算
    const coins = 200;
    Player.addCoins(coins);
    return { label: '金币 +' + coins, rarity: 'normal', kind: 'coin' };
  }

  // n = 1 或 10；返回 { boxName, rewards:[{label,rarity,slot}], tickets:[], }
  open(boxId, n) {
    const box = this.box(boxId);
    if (!box) return null;
    const times = n === 10 ? 10 : 1;
    const rewards = [];
    const tickets = { normal: 0, medium: 0, hard: 0, super: 0 };
    for (let k = 0; k < times; k++) {
      ['slot1', 'slot2', 'slot3'].forEach((slotKey, si) => {
        const rarity = this._rollRarity(box, slotKey);
        const entry = this._pick(box, rarity);
        if (!entry) return;
        const r = this._grant(entry, box.name);
        r.rarity = rarity;            // 展示按实际抽到的稀有度
        r.slot = si;
        rewards.push(r);
      });
      // Raid 票（每开一箱判定一次）
      const TK = [
        ['normal', box.raidTicketNormal, box.raidTicketRateNormal],
        ['medium', box.raidTicketMedium, box.raidTicketRateMedium],
        ['hard', box.raidTicketHard, box.raidTicketRateHard],
        ['super', box.raidTicketSuperHard, box.raidTicketRateSuperHard]
      ];
      for (const [k2, cnt, rate] of TK) {
        if (cnt > 0 && rate > 0 && Math.random() * 100 < rate) {
          Player.addRaidTicket(k2, cnt);
          tickets[k2] += cnt;
        }
      }
    }
    if (window.Daily) Daily.count('chest', 1);
    return { boxName: box.name, count: times, rewards, tickets };
  }
}

const Chest = new ChestSystem();
window.Chest = Chest;
