// ============================================================
//  逐帧角色（CraftPix Castle Guards 素材）
//  - assets/anim/index.json：{ 单位: {w,h,fps,anims:{idle:{file,frames},...}} }
//  - 每个动画是一张横向条带 webp，按 fps 循环/单次播放
//  - 与 Spine 路径共用 Actor 接口（Idle/Walk(Move)/Attack(Atk)/Special/Dead(Die)）
// ============================================================

const ANIM_DIR = 'assets/anim/';
const ANIM_ALIAS = {
  Idle: 'idle', Walk: 'walk', Move: 'walk',
  Attack: 'attack', Atk: 'attack', Attack_01: 'attack', Attack_02: 'attack',
  Special: 'special', Skill: 'special',
  Dead: 'dead', Die: 'dead', Death: 'dead'
};

let ANIM_INDEX = null;
const sheetCache = {};

function loadAnimIndex() {
  if (ANIM_INDEX) return Promise.resolve(ANIM_INDEX);
  return fetch(ANIM_DIR + 'index.json')
    .then(r => r.json())
    .then(j => { ANIM_INDEX = j; return j; })
    .catch(() => { ANIM_INDEX = {}; return ANIM_INDEX; });
}

// 单位 → 面向 Actor 的 info（无该单位返回 null）
function frameInfo(unit) {
  const u = ANIM_INDEX && ANIM_INDEX[unit];
  if (!u) return null;
  const aliases = [];
  for (const k of Object.keys(ANIM_ALIAS)) if (u.anims[ANIM_ALIAS[k]]) aliases.push(k);
  return {
    kind: 'frames', unit, w: u.w, h: u.h, fps: u.fps || 15, hb: u.hb || u.h, y0: u.y0 || 0,
    anims: aliases, frames: u.anims
  };
}

// 载入某个动画的条带图（缓存 Promise）
function loadSheet(unit, anim) {
  const key = unit + '|' + anim;
  if (sheetCache[key]) return sheetCache[key];
  const meta = ANIM_INDEX && ANIM_INDEX[unit] && ANIM_INDEX[unit].anims[anim];
  if (!meta) return Promise.resolve(null);
  sheetCache[key] = new Promise(res => {
    const im = new Image();
    const timer = setTimeout(() => { console.warn('动画条带超时: ' + meta.file); res(null); }, 12000);
    im.onload = () => {
      clearTimeout(timer);
      const obj = { img: im, w: ANIM_INDEX[unit].w, h: ANIM_INDEX[unit].h, frames: meta.frames };
      sheetCache[key].__v = obj;      // Actor.draw 直接读缓存里的 __v
      res(obj);
    };
    im.onerror = () => { clearTimeout(timer); console.warn('动画条带缺失: ' + meta.file); res(null); };
    im.src = ANIM_DIR + meta.file;
  });
  return sheetCache[key];
}

// 常见单位 id 别名：e1..e15 = 骷髅敌人；archer_lv0.. = 兵种四阶
const HERO_ARMY = { 1: 'knight', 2: 'warrior', 3: 'mage', 4: 'executor' };
const ALLY_ARMY = { 1: 'archer', 2: 'paretorian', 3: 'ice_archer', 4: 'mage', 5: 'mage',
                    6: 'axeman', 7: 'executor', 8: 'horseman', 9: 'warrior' };

// 英雄四阶：按进化次数给 Lv0~Lv3
function heroFrameInfo(charID, lv) {
  const cls = HERO_ARMY[charID] || 'knight';
  return frameInfo(cls + '_lv' + Math.max(0, Math.min(3, lv || 0))) || frameInfo('knight_lv0');
}
