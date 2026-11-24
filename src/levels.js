// ============================================================
//  关卡表驱动：直接读原包 data/ListAllLevel.json（102 关、11 个分区）
//  分区名取自原包字符串表（Mirkwood / Dead Swamp / ...）
// ============================================================

const ZONE_NAMES = [
  'Mirkwood', 'Dead Swamp', 'Plateau of Gorgoroth', 'Last Desert', 'Misty Moutains',
  'Ices Moutains', 'Dead Desert', 'Plateau Wind', 'Dark Forest', 'Dead Swamp 2', 'Dark Forest 2'
];

let LEVELS = null;

async function loadLevelList() {
  if (LEVELS) return LEVELS;
  const raw = await fetch('data/ListAllLevel.json').then(r => r.json());
  const arr = raw.listLevelSaveModel.slice().sort((a, b) => a.id - b.id);
  const inZone = {};
  LEVELS = arr.map(it => {
    inZone[it.zoneID] = (inZone[it.zoneID] === undefined) ? 0 : inZone[it.zoneID] + 1;
    const idx = inZone[it.zoneID];
    return {
      id: it.id,
      zone: it.zoneID,
      zoneName: ZONE_NAMES[it.zoneID] || ('Zone ' + (it.zoneID + 1)),
      indexInZone: idx,
      name: (it.zoneID + 1) + '-' + (idx + 1),
      levelType: it.levelType,
      levelMode: it.levelMode,
      totalEnemy: it.totalEnemy,
      totalBlood: it.totalBlood,
      levelCoins: it.levelCoins,
      totalMinCoins: it.totalMinCoins,
      totalMaxCoins: it.totalMaxCoins,
      // 结算用（Battle.gameOver 读这三个字段）
      minMaterial: it.minMaterial,
      materialID: it.materialID,
      _1starBonus: it._1starBonus,
      _2starBonus: it._2starBonus,
      _3starBonus: it._3starBonus,
      // 原版存档里没有星级，这里按关卡类型给一个可玩的初始星级
      stars: it.levelType === 'bigBoss' ? 3 : (it.levelType === 'MiniBoss' ? 2 : 1 + (it.id % 3))
    };
  });
  return LEVELS;
}

function zoneList(levels) {
  const zs = [];
  for (const l of levels) if (zs.indexOf(l.zone) < 0) zs.push(l.zone);
  return zs;
}
