// ============================================================
//  成就系统：全部由本地存档即时推导，不需要额外打点计数器
//  （签到次数单独累加到 Player.signTotal，见 Daily.sign）
// ============================================================
const ACHV = [
  { id: 'star1',  name: '首战告捷', desc: '拿到第一颗星',        need: 1,  gem: 10, cur: () => totalStars() },
  { id: 'star30', name: '星光收集者', desc: '累计 30 颗星',      need: 30, gem: 20, cur: () => totalStars() },
  { id: 'star90', name: '群星璀璨', desc: '累计 90 颗星',        need: 90, gem: 50, cur: () => totalStars() },
  { id: 'castle5', name: '坚城', desc: '城堡升到 5 级',          need: 5,  gem: 15, cur: () => Player.castleLevel },
  { id: 'castle10', name: '铁壁要塞', desc: '城堡升到 10 级',     need: 10, gem: 30, cur: () => Player.castleLevel },
  { id: 'evo3', name: '进阶骑士', desc: '英雄进化到 3 阶',       need: 3,  gem: 25, cur: () => maxEvo() },
  { id: 'ally3', name: '结盟', desc: '拥有 3 位盟友',            need: 3,  gem: 20, cur: () => Object.keys(Player.allies || {}).length },
  { id: 'equip5', name: '全副武装', desc: '拥有 5 件装备',        need: 5,  gem: 15, cur: () => Object.keys(Player.owned || {}).filter(k => Player.owned[k]).length },
  { id: 'raid3', name: '屠龙者', desc: '击败 3 个 Raid Boss',    need: 3,  gem: 30, cur: () => Object.keys(Player.bossClear || {}).filter(k => Player.bossClear[k]).length },
  { id: 'sign7', name: '勤勉', desc: '累计签到 7 天',             need: 7,  gem: 20, cur: () => Player.signTotal || 0 }
];

function totalStars() {
  let n = 0;
  for (const k in Player.stars) n += Player.stars[k] || 0;
  return n;
}
function maxEvo() {
  let m = 1;
  for (const k in (Player.heroEvo || {})) m = Math.max(m, Player.heroEvo[k] || 1);
  return m;
}

const Achv = {
  list() {
    const claims = Player.achvClaims || {};
    return ACHV.map(a => {
      const cur = Math.min(a.need, a.cur() || 0);
      return {
        id: a.id, name: a.name, desc: a.desc, need: a.need, cur, gem: a.gem,
        done: cur >= a.need, claimed: !!claims[a.id]
      };
    });
  },

  claimable() { return this.list().filter(a => a.done && !a.claimed).length; },

  claim(id) {
    const a = this.list().find(x => x.id === id);
    if (!a || !a.done || a.claimed) return null;
    if (!Player.achvClaims) Player.achvClaims = {};
    Player.achvClaims[id] = true;
    Player.addGems(a.gem);
    Player.save();
    return a;
  }
};

window.Achv = Achv;
