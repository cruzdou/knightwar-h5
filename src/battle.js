// ============================================================
//  战斗场景（竖屏 720×1280，按原版 1080×1920 布局 0.667 折算）
//  上：原版 bg1 战场   下：castle_1 城墙 + 站在墙上的英雄（Mel）
// ============================================================

const WALL_Y = 940;        // 城墙顶边
const HERO_X = 360;
const HERO_FEET = 1012;    // 英雄脚底
const HERO_H = 170;        // 英雄屏幕上高度
const SPAWN_Y = 300;       // 怪物出生（河道下方草地，避免站在水里）
const STOP_Y = 975;        // 推进到城墙前
const ENEMY_H_NEAR = 132;  // 到墙时的高度
const ENEMY_H_FAR = 74;    // 出生时的高度

// 盟友（gameAllies.json 的 charID 1~9）对应的原包骨架名
const ALLY_SKELETONS = {
  1: 'Elf_Archer', 2: 'Monk', 3: 'Ice_Mage', 4: 'White Mage', 5: 'FireMage',
  6: 'Ent', 7: 'Giant_Guardian', 8: 'GreenDragon', 9: 'Seraph'
};

class BattleScene {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.renderer = new SP.canvas.SkeletonRenderer(this.ctx);
    this.state = 'title';
    this.time = 0;
    this.speed = 1;
    this.enemies = [];
    this.arrows = [];
    this.floats = [];
    this.coinPops = [];
    this.matPops = [];
    this.matDrops = {};
    this.fx = [];
    this.shake = 0;
  }

  async init() {
    // 美术：CraftPix《Castle Guards》逐帧素材（Spine 4.2 骨架 3.6 运行时读不了，改走条带帧）
    await loadAnimIndex();
    skinPreload();
    // 等首屏必需的皮肤图与战场背景，避免第一帧是旧美术
    await Promise.all([skinLoad('sk_castle.webp'), bgLoadAsync(1), bgLoadAsync(2),
      skinLoad('sk_arrow.webp'), skinLoad('sk_coin_icon.webp'), skinLoad('sk_gem_icon.webp'),
      skinLoad('sk_btn_pause.webp'), skinLoad('sk_arrow_fire.webp'),
      skinLoad('sk_arrow_ice.webp'), skinLoad('sk_fireball.webp')]);

    // 主角：按 charID 取四阶兵种帧（1 骑士 / 2 战士 / 3 法师 / 4 处刑者）
    this.hero_infos = {};
    const curID = Player.charID;
    this.hero_info = heroFrameInfo(curID, 0);
    this.hero_infos[curID] = this.hero_info;
    [1, 2, 3, 4].forEach(id => { this.hero_infos[id] = heroFrameInfo(id, 0); });

    // 敌人：15 个骷髅兵种，按分区轮流上场
    this.enemy_infos = {};
    this.enemy_pool = [];
    for (let i = 1; i <= 15; i++) {
      const fi = frameInfo('e' + i);
      if (fi) { fi.name = 'E' + i; this.enemy_infos['E' + i] = fi; this.enemy_pool.push(fi); }
    }
    this._enemyReady = Promise.resolve();
    this._heroReady = Promise.resolve();

    // 贴图并行加载（每张独立兜底，慢网络下不会互相拖死）
    const li = n => loadImage(n).catch(() => null);
    // 先用皮肤图占位，原包贴图放到后台补（减少首屏请求阻塞，公网冷启动更快）
    this.tex = {
      arrow: skinGet('sk_arrow.webp'), gold: skinGet('sk_coin_icon.webp'),
      gem: skinGet('sk_gem_icon.webp'), pause: skinGet('sk_btn_pause.webp'),
      arrowFire: skinGet('sk_arrow_fire.webp'), arrowIce: skinGet('sk_arrow_ice.webp'),
      fireball: skinGet('sk_fireball.webp')
    };
    const li2 = n => loadImage(n).catch(() => null);
    this._texReady = Promise.all([
      li2('bg1.png'),
      Promise.all([li2('bg1.png'), li2('bg2.png'), li2('bg3.png'), li2('bg4.png'), li2('bg5.png')]),
      li2('castle_1.png'), li2('castle_1_1.png'), li2('bullet_arrow.png'),
      li2('UI_cur_coin.png'), li2('icon_gem.png'), li2('UI-btn-fight.png'), li2('btn_icon_magic.png'),
      Promise.all([li2('Skill_H01_1.png'), li2('Skill_H01_2.png'), li2('Skill_H01_3.png')]),
      li2('Skill_border_active.png'), li2('btn_icon_player_pause.png'), li2('btn_icon_boot_speed.png'),
      li2('HP_bar_border.png'), li2('HUD_btm_bar.png'),
      li2('ground_light03.png'), li2('ground_earth03.png'), li2('ground_storm.png'),
      li2('fx_glow1.png'), li2('fx_star1.png'), li2('fx_dust1.png'), li2('fx_smoke_01_d.png'),
      li2('victory.png'), li2('defeatbanner.png'), li2('result_star.png'),
      li2('BG_Splash.png'), li2('Play_btn.png')
    ]).then(([bgfield, bgZones, castle, castle2, arrow, gold, gem, sword, magic,
              skillIcons, skillBorder, pause, speed, hpbar, btmbar,
              fxRing, fxBolt, fxSwirl, fxGlow, fxStar, fxDust, fxSmoke,
              win, lose, star, splash, play]) => {
      Object.assign(this.tex, {
        bgfield, bgZones, castle, castle2, sword, magic,
        skillIcons, skillBorder, speed, hpbar, btmbar,
        fxRing, fxBolt, fxSwirl, fxGlow, fxStar, fxDust, fxSmoke
      });
    }).catch(() => {});

    this.bg = this.buildBackground();
    this.setHero(Player.charID);
    this.reset();
  }

  // 上阵盟友的帧素材（换阵容后第一次战斗前调用）
  async ensureAllySprites() {
    if (!this.ally_infos) this.ally_infos = {};
    await loadAnimIndex();
    const ids = (Player.squad || []).slice(0, 3);
    for (const id of ids) {
      if (this.ally_infos[id]) continue;
      const cls = ALLY_ARMY[id] || 'archer';
      this.ally_infos[id] = frameInfo(cls + '_lv0') || frameInfo('archer_lv0');
    }
  }

  // 换主角骨架（按 charID）
  // 开打前确保敌人骨架与当前英雄就绪（首屏不再等它们）
  async ensureEnemies() {
    if (this._heroReady) { try { await this._heroReady; } catch (e) { /* 忽略 */ } }
    if (this._enemyReady) { try { await this._enemyReady; } catch (e) { /* 忽略 */ } }
  }

  setHero(charID) {
    // 兵种四阶帧：按英雄等级分档（1-10 → Lv0，11-20 → Lv1，21-30 → Lv2，31+ → Lv3）
    const lv = (Player.heroLvOf ? Player.heroLvOf(charID) : 1) || 1;
    const tier = lv >= 31 ? 3 : (lv >= 21 ? 2 : (lv >= 11 ? 1 : 0));
    const info = heroFrameInfo(charID, tier);
    if (!info) return;
    this.hero_info = info;
    this.hero = new Actor(info, { anim: 'Idle' });
    this.hero.x = HERO_X;
    this.hero.y = HERO_FEET;
    this.hero.scale = HERO_H / info.h;
  }

  // 每个分区的战场背景（Castle Guards 的 10 张卡通战场轮换）
  bgFor(zone) {
    const n = Math.abs((zone || 0) % 10) + 1;
    return bgGet(n) || bgGet(1);
  }

  // ---------- 静态背景（画一次） ----------
  buildBackground() {
    // 背景素材还没到且已有可用旧底：直接沿用，避免出现"黑底+城堡"
    if (!this.bgFor(this.stageData && this.stageData.zone) && this.bg && this.bg.width) {
      const n0 = Math.abs(((this.stageData && this.stageData.zone) || 0) % 10) + 1;
      bgLoadAsync(n0).then(im => { if (im && im.width) this.bg = this.buildBackground(); });
      return this.bg;
    }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    const bgm = this.bgFor(this.stageData && this.stageData.zone);
    if (bgm) {
      // 卡通战场整屏铺满（等比 cover）
      const scale = Math.max(W / bgm.width, H / bgm.height);
      const dw = bgm.width * scale, dh = bgm.height * scale;
      c.drawImage(bgm, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // 远端轻微压暗，保留卡通亮度
      const fog = c.createLinearGradient(0, 0, 0, 300);
      fog.addColorStop(0, 'rgba(10,40,20,0.28)');
      fog.addColorStop(1, 'rgba(10,40,20,0)');
      c.fillStyle = fog; c.fillRect(0, 0, W, 300);
    } else if (this.tex && this.tex.bgfield) {
      // 兜底：旧战场图
      const bh = WALL_Y + 30;
      const scale = Math.max(W / this.tex.bgfield.width, bh / this.tex.bgfield.height);
      const dw = this.tex.bgfield.width * scale, dh = this.tex.bgfield.height * scale;
      c.drawImage(this.tex.bgfield, (W - dw) / 2, bh - dh, dw, dh);
    }
    // 冷启动慢时背景可能还没到：异步补到后重画一次
    if (!bgm && !this._bgRetry) {
      this._bgRetry = true;
      const n = Math.abs(((this.stageData && this.stageData.zone) || 0) % 10) + 1;
      bgLoadAsync(n).then(im => { if (im && im.width) { this._bgRetry = false; this.bg = this.buildBackground(); } });
    }

    // 己方城楼（卡通城堡）：贴底居中，英雄/盟友站它前面
    const ca = skinGet('sk_castle.webp');
    if (ca) {
      const chh = 290, cww = chh * ca.width / ca.height;
      c.drawImage(ca, (W - cww) / 2, H - 96 - chh, cww, chh);
    }

    // 底部草地暗化，让 HUD 与人物更清楚
    const bot = c.createLinearGradient(0, H - 300, 0, H);
    bot.addColorStop(0, 'rgba(0,0,0,0)');
    bot.addColorStop(1, 'rgba(0,0,0,0.22)');
    c.fillStyle = bot; c.fillRect(0, H - 300, W, 300);
    return cv;
  }

  // ---------- 一局重置（吃 ListAllLevel 的关卡元数据） ----------
  reset(stage, opts) {
    if (stage) this.stageData = stage;
    if (!this.stageData) this.stageData = { name: '1-1', zone: 0, totalEnemy: 12, levelCoins: 86, levelType: 'Normal' };
    const st = this.stageData;

    this.stage = st.name;
    this.wave = 1;
    // 关卡强度全部取自 ListAllLevel 的真实字段：
    // totalEnemy（原包 12~636，H5 按 3~6 波 × 3~8 只折算）、totalBlood/totalEnemy（平均每只血量）、levelCoins
    const realTotal = Math.max(8, st.totalEnemy || 12);
    const avgHP = realTotal ? (st.totalBlood || 0) / realTotal : 0;
    // 平均每只血量相对第一关（Level_0_0 约 4861/只）的比值，开 0.35 次方压平曲线，免得后期打不动
    this.hpK = Math.max(0.8, Math.min(3.0, Math.pow(avgHP / 4900 || 1, 0.35)));
    // 节奏：前三个区（新手前 30 关）3~4 波、每波 5~6 只，后面再放开到 6 波 8 只
    const zone = (st.zone === undefined ? 0 : st.zone);
    const waveCap = zone <= 1 ? 3 : (zone <= 3 ? 4 : 6);
    const perCap = zone <= 1 ? 5 : (zone <= 3 ? 6 : 8);
    this.waveCount = Math.max(3, Math.min(waveCap, Math.ceil(realTotal / 12)));
    this.perWave = Math.max(3, Math.min(perCap, Math.round(realTotal / this.waveCount)));
    this.totalEnemy = this.waveCount * this.perWave;
    this.coinPerKill = Math.max(1, Math.round((st.levelCoins || 30) / this.totalEnemy));
    this.isBoss = st.levelType === 'bigBoss';
    this.pool = this.poolForZone(st.zone);
    // 分区换了就重画战场背景
    if (this._bgZone !== st.zone) { this._bgZone = st.zone; this.bg = this.buildBackground(); }

    this.enemies.length = 0;
    this.arrows.length = 0;
    this.floats.length = 0;
    this.coinPops.length = 0;
    this.matPops.length = 0;
    this.matDrops = {};
    this.bonusRewards = [];
    this.fx.length = 0;
    this.coins = 0;
    this.castleHP = 561;
    this.castleMax = 561;
    this.heroHP = 500;
    this.heroMax = 500;
    // 城墙血量/护甲/回复随城堡等级（gameCastle.json listLevelUp），0.35 次方压平曲线
    this.wallArmor = 0;
    this.wallRegain = 0;
    this.regainT = 0;
    {
      const cs = castleStatsFor(this.g.castleData, Player.castleLevel || 1);
      this.castleMax = cs.hp;
      this.castleHP = cs.hp;
      this.wallArmor = cs.armor;
      this.wallRegain = cs.regain;
    }
    this.spawnLeft = this.perWave;
    this.spawnTimer = 1.0;
    this.kills = 0;
    this.skillCD = 0;
    // 三技能（CD 取自 gameCharacters.json skillList）：0 穿透射击 / 1 攻速增益 / 2 范围箭雨
    const ch = (this.g.chars || []).find(c => c.charID === Player.charID);
    const sk = (ch && ch.skillList) || [];
    this.skills = [0, 1, 2].map(i => ({
      name: (sk[i] && sk[i].name) || ['Power shot', 'Windspeed', 'Rain arrow'][i],
      cd: Math.max(6, Math.min(20, Math.round((sk[i] && sk[i].coolDown) || [10, 14, 20][i]))),
      t: 0,
      // 技能等级（存档里的技能升级）：每级 +6% 伤害；攻速增益类每级再 +3% 攻速
      lv: sk[i] ? Player.skillLvOf(Player.charID, sk[i].skillID) : 1,
      mul: 1 + 0.06 * ((sk[i] ? Player.skillLvOf(Player.charID, sk[i].skillID) : 1) - 1),
      buff: 1.6 + 0.03 * ((sk[i] ? Player.skillLvOf(Player.charID, sk[i].skillID) : 1) - 1)
    }));
    this.rageT = 0;
    this.fireTimer = 0;
    this.revived = false;      // 本局是否已用广告复活
    this.doubled = false;      // 本局结算是否已领双倍金币
    // 材料掉落率（?matdrop=1 可强制必掉，调试用）
    {
      const q = new URLSearchParams(location.search).get('matdrop');
      this.matDropRate = q ? Math.max(0, Math.min(1, parseFloat(q))) : 0.16;
    }
    // Raid：强化版 Boss 关（血量 ×2、金币 ×2、材料概率 ×2），票已在 RaidScene 扣掉
    this.raid = (opts && opts.raid) ? opts.raid : null;
    if (this.raid) {
      const mult = this.raid.mult || 2;
      this.hpK *= mult;
      this.coinPerKill *= mult;
      this.matDropRate = Math.min(1, this.matDropRate * mult);
      this.bonusRewards.push('RAID 强敌（' + (this.raid.kind || 'normal') + '）：敌人 ×' + mult + ' · 金币/材料 ×' + mult);
    }
    this.state = 'play';

    // 按存档里选中的英雄换算伤害/攻速（数值来自 gameCharacters.json）
    if (!this.hero || !this.hero.info || this.heroCharID !== Player.charID) {
      this.heroCharID = Player.charID;
      if (this.hero_infos && this.hero_infos[Player.charID]) this.setHero(Player.charID);
    }
    const chars = this.g.chars || [];
    const cur = chars.find(c => c.charID === Player.charID);
    const heroT = this.g.heroStats ? this.g.heroStats(Player.charID) : null;
    if (heroT) {
      // 装备加成后的最终数值（伤害/攻速/血量/暴击）
      this.g.heroDamage = heroT.damage * (window.CONFIG ? CONFIG.balance.damageMult : 3);
      this.g.heroAtkRate = heroT.atkRate * (window.CONFIG ? CONFIG.balance.fireRateMult : 3);
      this.heroMax = Math.max(1, Math.round(heroT.blood));
      this.heroHP = this.heroMax;
      this.heroCrit = heroT.crit;
    }

    // 上阵盟友（最多 3 名）：站在英雄两侧/后方，自动向最靠墙的敌人射击
    // 数值取自 gameAllies.json 该阶该级的伤害；盟友不吃伤害（简化：不会被打死）
    this.allies = [];
    const allySlots = [{ x: 232, y: 1052 }, { x: 488, y: 1052 }, { x: 360, y: 986 }];
    (Player.squad || []).slice(0, 3).forEach((id, i) => {
      const info = this.ally_infos && this.ally_infos[id];
      const st = this.g.allyStats ? this.g.allyStats(id) : null;
      if (!info || !st) return;
      const a = new Actor(info, { anim: info.anims.includes('Idle') ? 'Idle' : (info.anims[0] || 'Idle') });
      a.allyID = id;
      a.x = allySlots[i].x;
      a.y = allySlots[i].y;
      a.flip = false;
      a.scale = (HERO_H * 0.92) / info.h;
      a.dmg = Math.max(1, st.damage * (window.CONFIG ? CONFIG.balance.damageMult : 3) * 0.55);
      a.rate = Math.max(0.6, st.atkRate || 1.5);
      a.crit = st.critRate || 8;
      a.timer = 0.35 * i;
      this.allies.push(a);
    });
  }

  // 按分区挑怪物（15 种骷髅按区轮流）
  poolForZone(zone) {
    const sets = [
      ['E1', 'E2', 'E3', 'E4'],
      ['E5', 'E6', 'E7', 'E8'],
      ['E9', 'E10', 'E11', 'E12'],
      ['E13', 'E14', 'E15', 'E1'],
      ['E3', 'E6', 'E9', 'E12']
    ];
    const names = sets[(zone || 0) % sets.length];
    const out = names.map(n => this.enemy_infos[n]).filter(Boolean);
    return out.length ? out : this.enemy_pool;
  }

  // ---------- 出怪 ----------
  spawnEnemy() {
    const info = this.pool[Math.floor(Math.random() * this.pool.length)];
    if (!info) return;   // 素材索引尚未就绪时先不出怪，避免空 info 让整帧崩
    const a = new Actor(info, { anim: info.anims.includes('Move') ? 'Move' : 'Idle' });
    a.x = 110 + Math.random() * 500;
    a.y = SPAWN_Y + Math.random() * 50;
    a.stopY = STOP_Y - Math.random() * 30;
    a.base = ENEMY_H_NEAR / info.h;
    a.hp = 90 * (this.hpK || 1) * (1 + 0.18 * (this.wave - 1));
    a.maxHp = a.hp;
    a.speed = 24 + Math.random() * 8;
    // BOSS 关最后一波：最后一只体积放大、血量 ×4、走得慢，当小 Boss 用
    // （原包 Boss_Golem 等骨架是 mesh 权重附件，3.6 运行时渲染不全，不引用）
    if (this.isBoss && this.wave === this.waveCount && this.spawnLeft === 1) {
      a.base *= 1.35; a.hp = a.maxHp = a.hp * 4; a.speed *= 0.7; a.boss = true;
    }
    a.scale = a.base * (ENEMY_H_FAR / ENEMY_H_NEAR);
    a.flip = Math.random() < 0.5;
    a.dying = false;
    a.dead = false;
    this.enemies.push(a);
  }

  // ---------- 射击 ----------
  shoot(target) {
    this.arrows.push({
      x: HERO_X + 4, y: HERO_FEET - HERO_H * 0.72,
      tx: target.x, ty: target.y - target.scale * target.info.h * 0.55,
      target, speed: 520, rot: 0
    });
    this.hero.once(this.hero.info.anims.includes('Atk') ? 'Atk' : (this.hero.info.anims[0] || 'Idle'), 'Idle');
    this.g.playSfx('sfx_shoot', 0.35);
  }

  // 盟友射击：同样的箭矢，伤害取盟友自己的数值（箭上带 dmg/crit）
  shootFrom(al, target) {
    this.arrows.push({
      x: al.x, y: al.y - al.scale * al.info.h * 0.72,
      tx: target.x, ty: target.y - target.scale * target.info.h * 0.55,
      target, speed: 480, rot: 0, dmg: al.dmg, crit: al.crit
    });
    const atk = al.info.anims.includes('Atk') ? 'Atk' : (al.info.anims.includes('Attack_01') ? 'Attack_01' : null);
    if (atk) al.once(atk, 'Idle');
    this.g.playSfx('sfx_shoot', 0.18);
  }

  hitTarget(arrow) {
    const e = arrow.target;
    if (!e || e.dead || e.dying) return;
    const critP = Math.min(0.6, ((arrow.dmg ? arrow.crit : this.heroCrit) || 12) / 100);
    const crit = Math.random() < critP;
    const dmg = (arrow.dmg || this.g.heroDamage) * (crit ? 1.5 : 1);
    e.hp -= dmg;
    this.floats.push({ x: e.x, y: e.y - e.info.h * e.scale - 10, v: Math.round(dmg), life: 0.7, crit });
    // 命中特效：小光斑（原包 fx_glow1）
    this.fx.push({
      img: this.tex.fxGlow, x: e.x, y: e.y - e.info.h * e.scale * 0.55,
      r: crit ? 54 : 34, t: 0, life: crit ? 0.3 : 0.22, max: crit ? 0.3 : 0.22, rot: 0
    });
    this.g.playSfx('sfx_hit', 0.22);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.dying = true;
    e.dieT = 0.7;
    if (e.info.anims.includes('Die')) e.once('Die', 'Idle');
    this.kills++;
    // 每日任务/事件的真实计数源（boss 只算 spawnEnemy 里放大标记的那一只）
    if (window.Daily) {
      Daily.count('kill', 1);
      if (e.boss) Daily.count('bossKill', 1);
    }
    // 死亡音效：按骨架名挑原包 die 音
    const DIE_SFX = {
      Goblin: 'sfx_die_goblin', Gnoll: 'sfx_die_gnoll', Bandit: 'sfx_die_orc',
      Wolf: 'sfx_die_wolf', Thorn: 'sfx_die_thorn', Giant_Spiders: 'sfx_die_spider',
      Lizard_Rider: 'sfx_die_lizard', Anubis: 'sfx_die_snake',
      Ent: 'sfx_wallstone', Ice_Mage: 'sfx_blood', FireMage: 'sfx_blood',
      Shadow_Archer: 'sfx_die_orc', Hero_04_Ingame: 'sfx_die_orc'
    };
    this.g.playSfx(DIE_SFX[(e.info && e.info.name) || ''] || 'sfx_die_orc', 0.3);
    this.coinPops.push({ x: e.x, y: e.y - 24, t: 0 });
    // 材料掉落：普通怪 12%，Boss 必掉 2 个（材料表 601~643）
    const isBossUnit = !!(e.info && e.info.isBoss) || (this.isBoss && this.wave === this.waveCount);
    const times = (isBossUnit ? 2 : (Math.random() < this.matDropRate ? 1 : 0)) * (this.raid ? (this.raid.mult || 2) : 1);
    for (let i = 0; i < times; i++) {
      const id = this.rollMat();
      Player.addMat(id, 1);
      this.matDrops[id] = (this.matDrops[id] || 0) + 1;
      this.matPops.push({ x: e.x + (i - times / 2) * 18, y: e.y - 52, t: 0, id });
    }
    // 死亡特效：尘土 + 星点
    const cy = e.y - e.info.h * e.scale * 0.45;
    this.spawnFxSheet('fx_hit1', e.x, cy, 104, 0.62);
    this.fx.push({ img: this.tex.fxStar, x: e.x, y: cy, r: 60, t: 0, life: 0.4, max: 0.4, rot: 0.6 });
  }

  // 材料掉落权重（基础材料为主，三系打造材料略稀有）
  rollMat() {
    const pool = [
      [601, 26], [606, 18], [603, 14], [612, 10], [615, 6], [607, 4],
      [641, 12], [642, 8], [643, 4]
    ];
    let total = 0;
    for (const p of pool) total += p[1];
    let r = Math.random() * total;
    for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
    return 601;
  }

  matName(id) {
    const it = this.g && this.g.itemByID ? this.g.itemByID[id] : null;
    return it ? it.name : ('#' + id);
  }

  // ---------- 逻辑 ----------
  update(dt) {
    this.time += dt;
    if (this.state !== 'play') return;
    const d = dt * this.speed;

    // 城墙回复（城堡 regain 字段）：每 2 秒回 regain/3 点，战斗中不会回满
    if (this.wallRegain && this.castleHP < this.castleMax) {
      this.regainT = (this.regainT || 0) + dt;
      if (this.regainT >= 2) {
        this.regainT = 0;
        this.castleHP = Math.min(this.castleMax, this.castleHP + Math.max(1, Math.round(this.wallRegain / 3)));
      }
    }

    if (this.spawnLeft > 0) {
      this.spawnTimer -= d;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnLeft--;
        this.spawnTimer = 1.2 + Math.random() * 0.6;
      }
    }

    let alive = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(d);
      if (e.dying) {
        e.dieT -= d;
        e.alpha = Math.max(0, e.dieT / 0.7);
        if (e.dieT <= 0) e.dead = true;
        continue;
      }
      alive++;
      if (e.y < e.stopY) {
        e.y += e.speed * d;
        const t = Math.max(0, Math.min(1, (e.y - SPAWN_Y) / (STOP_Y - SPAWN_Y)));
        e.scale = e.base * lerp(ENEMY_H_FAR / ENEMY_H_NEAR, 1, t);
      } else {
        e.atkT = (e.atkT || 0) - d;
        if (e.atkT <= 0) {
          e.atkT = 1.0;
          // 护甲减伤：dmg = 12 × (1 - armor/(armor+40))，城堡等级越高越耐打
          const ar = this.wallArmor || 0;
          const dmg = Math.max(1, Math.round(12 * (1 - ar / (ar + 40))));
          this.castleHP = Math.max(0, this.castleHP - dmg);
          this.shake = 0.22;
          // 撞墙特效：烟尘 + 火花
          this.fx.push({ img: this.tex.fxSmoke, x: e.x, y: WALL_Y - 10, r: 110, t: 0, life: 0.5, max: 0.5, rot: 0 });
          this.fx.push({ img: this.tex.fxGlow, x: e.x, y: WALL_Y - 26, r: 48, t: 0, life: 0.25, max: 0.25, rot: 0 });
          this.g.playSfx('sfx_wallstone', 0.32);
          if (this.castleHP <= 0) this.gameOver(false);
        }
        if (e.info.anims.includes('Attack_01')) e.once('Attack', 'Walk');
      }
    }

    // 英雄自动射箭（优先打最靠近城墙的）
    this.fireTimer -= d;
    if (this.fireTimer <= 0 && alive > 0) {
      const target = this.enemies.filter(e => !e.dead && !e.dying).sort((a, b) => b.y - a.y)[0];
      if (target) {
        this.shoot(target);
        this.fireTimer = 1 / (this.g.heroAtkRate * (this.rageT > 0 ? (this.skills[1].buff || 1.6) : 1));
      }
    }

    // 盟友自动攻击（独立计时，目标同样取最靠墙的敌人）
    if (this.allies) {
      for (const al of this.allies) {
        al.update(d);
        if (al.timer > 0) { al.timer -= d; continue; }
        const aliveList = this.enemies.filter(e => !e.dead && !e.dying);
        if (!aliveList.length) continue;
        const target = aliveList.sort((a, b) => b.y - a.y)[0];
        this.shootFrom(al, target);
        al.timer = 1 / al.rate;
      }
    }

    for (const a of this.arrows) {
      if (a.dead) continue;
      const dx = a.tx - a.x, dy = a.ty - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      a.rot = Math.atan2(dy, dx);
      if (dist < 24) { a.dead = true; this.hitTarget(a); continue; }
      const step = a.speed * d;
      a.x += dx / dist * step;
      a.y += dy / dist * step;
    }
    this.arrows = this.arrows.filter(a => !a.dead);

    for (const f of this.floats) { f.life -= d; f.y -= 40 * d; }
    this.floats = this.floats.filter(f => f.life > 0);

    for (const c of this.coinPops) {
      c.t += d;
      if (c.t > 0.7 && !c.counted) { c.counted = true; this.coins += this.coinPerKill || 3; this.g.playSfx('sfx_coin', 0.2); }
    }
    this.coinPops = this.coinPops.filter(c => c.t < 1.1);
    for (const m of this.matPops) m.t += d;
    this.matPops = this.matPops.filter(m => m.t < 1.2);

    for (const f of this.fx) { f.t += d; f.life -= d; }
    this.fx = this.fx.filter(f => f.life > 0);

    this.hero.update(d);
    if (this.skillCD > 0) this.skillCD -= d;
    if (this.skills) for (const s of this.skills) if (s.t > 0) s.t = Math.max(0, s.t - d);
    if (this.rageT > 0) this.rageT = Math.max(0, this.rageT - d);
    if (this.shake > 0) this.shake -= dt;

    if (this.spawnLeft === 0 && alive === 0 && this.dyingCount() === 0) {
      if (this.wave >= this.waveCount) this.gameOver(true);
      else {
        this.wave++;
        this.spawnLeft = this.perWave;
        this.spawnTimer = 1.4;
      }
    }
  }

  dyingCount() { return this.enemies.filter(e => e.dying && !e.dead).length; }

  gameOver(win) {
    this.state = 'over';
    this.winFlag = win;
    this.bonusRewards = [];
    // 结算写存档：金币入账 + 星级（按城墙剩余血量给 1~3 星）
    if (win) {
      Player.addCoins(this.coins);
      const ratio = this.castleHP / this.castleMax;
      const stars = ratio > 0.7 ? 3 : (ratio > 0.35 ? 2 : 1);
      this.gainedStars = stars;
      const st = this.stageData || {};
      const oldStars = st.name ? (Player.starsOf(st.name) || 0) : 0;
      if (this.stageData) Player.setStars(this.stageData.name, stars);
      // 星级奖励（ListAllLevel.json 的 _1/2/3starBonus 是宝石数）：只在刷新纪录时才多给差额
      const bonusArr = [st._1starBonus || 0, st._2starBonus || 0, st._3starBonus || 0];
      const gain = Math.max(0, (bonusArr[stars - 1] || 0) - (bonusArr[Math.max(0, oldStars - 1)] || 0));
      if (gain > 0) { Player.addGems(gain); this.bonusRewards.push('星级奖励 宝石 +' + gain); }
      // 通关保底材料（minMaterial）
      const minMat = Math.max(0, st.minMaterial || 0);
      if (minMat > 0) {
        const add = {};
        for (let i = 0; i < minMat; i++) {
          const id = this.rollMat();
          Player.addMat(id, 1);
          this.matDrops[id] = (this.matDrops[id] || 0) + 1;
          add[id] = (add[id] || 0) + 1;
        }
        this.bonusRewards.push('通关保底材料：' + Object.keys(add).map(id => this.matName(id) + ' x' + add[id]).join('、'));
      }
      // Boss 首通（bigBoss 关）：Raid 票 +1（原包只给了票字段，Raid 玩法未开放）
      if (st.levelType === 'bigBoss' && st.name && !Player.isBossCleared(st.name)) {
        Player.setBossCleared(st.name);
        Player.addRaidTicket('normal', 1);
        this.bonusRewards.push('Boss 首通：Raid 票 +1');
      }
      // 每日事件：通关 / 困难关卡通关
      if (window.Daily) {
        Daily.count('win', 1);
        if (this.stageData && this.stageData.levelMode === 'Hard') Daily.count('hardWin', 1);
      }
    }
    this.g.playSfx(win ? 'sfx_win' : 'sfx_lose', 0.6);
  }

  // ---------- 绘制 ----------
  draw() {
    try { this._draw(); } catch (e) {
      if (!this._drawErr) { this._drawErr = 1; console.error('[battle.draw] ' + (e && e.stack || e)); }
    }
  }

  _draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (this.state === 'title') { this.drawTitle(); return; }

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5);
    ctx.drawImage(this.bg, 0, 0);

    // 技能特效（垫在角色下面）
    for (const f of this.fx) {
      const p = 1 - f.life / f.max;
      if (f.sheetUnit) {
        const sh = sheetCache[f.sheetUnit + '|loop'];
        const obj = sh && sh.__v;
        if (!obj) continue;
        const idx = Math.min(obj.frames - 1, Math.floor(f.t * (obj.fps || 15)));
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life / f.max);
        const dw = f.r, dh = dw * obj.h / obj.w;
        ctx.drawImage(obj.img, idx * obj.w, 0, obj.w, obj.h, f.x - dw / 2, f.y - dh / 2, dw, dh);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life / f.max) * 0.9;
      ctx.translate(f.x, f.y);
      ctx.rotate(p * 0.8);
      const sz = f.r * (0.5 + p * 0.9);
      ctx.drawImage(f.img, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }

    const sorted = [...this.enemies].filter(e => !e.dead && e.info).sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      e.draw(ctx, this.renderer);
      if (!e.dying) this.drawEnemyHP(e);
    }

    // 盟友画在英雄后面（先画，英雄压在最前）
    if (this.allies) for (const al of this.allies) if (al && al.info) al.draw(ctx, this.renderer);
    if (this.hero && this.hero.info) this.hero.draw(ctx, this.renderer);

    for (const a of this.arrows) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot + Math.PI / 2);
      const s = 0.55;
      ctx.drawImage(this.tex.arrow, -this.tex.arrow.width * s / 2, -this.tex.arrow.height * s / 2,
        this.tex.arrow.width * s, this.tex.arrow.height * s);
      ctx.restore();
    }

    for (const f of this.floats) {
      text(ctx, String(f.v), f.x, f.y, f.crit ? 30 : 24, '#ffffff', 'center', '#20120a');
    }

    for (const c of this.coinPops) {
      const t = Math.min(1, c.t / 0.7);
      drawIcon(ctx, this.tex.gold, lerp(c.x, W - 36, t), lerp(c.y, 40, t * t), 0.5, 1 - t * 0.2);
    }
    // 材料掉落飘字（原地上升淡出）
    for (const m of this.matPops) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - m.t / 1.2);
      text(ctx, '+' + this.matName(m.id), m.x, m.y - m.t * 46, 16, '#9fe6a8', 'center', '#0d2413');
      ctx.restore();
    }
    ctx.restore();

    this.drawHud();
    if (this.state === 'pause') this.drawPause();
    if (this.state === 'over') this.drawResult();
  }

  drawEnemyHP(e) {
    if (!e.info) return;
    const ctx = this.ctx;
    const w = Math.max(34, e.info.w * e.scale * 0.85), h = 6;
    const x = e.x - w / 2, y = e.y - e.info.h * e.scale - 10;
    ctx.fillStyle = 'rgba(8,8,8,0.9)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#e23b28';
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
  }

  // ---------- HUD（卡通皮肤） ----------
  drawHud() {
    const ctx = this.ctx;
    const hasSkin = !!skinGet('sk_status_bg.webp');

    // ===== 顶部状态条：木质底板 + 城墙血槽 + 金币 =====
    const barY = 10, barH = 58, barX = 10, barW = W - 20;
    if (hasSkin) {
      skinPanel(ctx, barX, barY, barW, barH, { file: 'sk_status_bg.webp', m: 26 });
    } else {
      roundRect(ctx, barX, barY, barW, barH, 12, '#2a2013', '#7a4d22', 3);
    }

    // Stage 文本
    text(ctx, 'Stage ' + this.stage, barX + 16, barY + barH / 2, 26, '#3a2208', 'left');

    // 城墙血槽（中段）
    const hpx = barX + 128, hpy = barY + 16, hpw = barW * 0.46;
    skinBar(ctx, hpx, hpy, hpw, 26, this.castleHP / this.castleMax, 'sk_hp_bg.webp', 'sk_hp_fg.webp');
    if (!hasSkin) {
      text(ctx, String(Math.round(this.castleHP)), hpx + hpw / 2, hpy + 13, 20, '#fff', 'center', '#141a12');
    } else {
      text(ctx, String(Math.round(this.castleHP)), hpx + hpw / 2, hpy + 14, 18, '#fff8e1', 'center', '#5a3410');
    }

    // Raid 标记
    if (this.raid) {
      const bx = hpx + hpw + 10, by = barY + 15;
      skinButton(ctx, bx, by, 78, 30, 'smallGreen', false, 'RAID×' + (this.raid.mult || 2), { size: 14 });
    }

    // 金币（右侧）
    const coinImg = this.tex.gold;
    if (coinImg && coinImg.width > 1) drawIconFit(ctx, coinImg, barX + barW - 26, barY + barH / 2, 34);
    text(ctx, String(this.coins), barX + barW - 48, barY + barH / 2, 22, '#3a2208', 'right');

    // ===== 四段推进小条 =====
    const pipY = barY + barH + 6, pipH = 10;
    const pipGap = 6, pipW = (barW * 0.7 - pipGap * 3) / 4;
    for (let i = 0; i < 4; i++) {
      const on = i < this.wave;
      roundRect(ctx, barX + i * (pipW + pipGap), pipY, pipW, pipH, 5,
        on ? (i === 3 ? '#3f8fd0' : '#f2b93b') : 'rgba(30,24,14,0.55)',
        on ? 'rgba(255,240,190,0.7)' : 'rgba(255,255,255,0.12)', 2);
    }

    // ===== 底部操作栏 =====
    const byY = H - 100;
    if (!skinSlice(ctx, 'sk_bot_bar.webp', 0, byY, W, 100, 70)) {
      roundRect(ctx, 0, byY, W, 100, 0, '#3a2716');
      ctx.fillStyle = 'rgba(255,214,140,0.6)';
      ctx.fillRect(0, byY, W, 4);
    }

    const cy = byY + 52;
    this.btn(ctx, 56, cy, 26, this.tex.sword, 0.42, '#2f5d24');
    this.btn(ctx, 122, cy, 26, this.tex.gem, 0.58, '#2f5d24');

    // 中：英雄血条
    const hx = 178, hw = W - 178 - 176, hy = cy - 20, hh = 40;
    skinBar(ctx, hx, hy, hw, hh, this.heroHP / this.heroMax, 'sk_hp_bg.webp', 'sk_hp_fg.webp');
    text(ctx, String(Math.round(this.heroHP)), hx + hw / 2, hy + hh / 2, 22, '#fff8e1', 'center', '#5a1414');

    // 右：加速 / 暂停
    this.btn(ctx, W - 118, cy, 26, this.tex.speed, 0.5, '#2f5d24');
    this.btn(ctx, W - 54, cy, 26, this.tex.pause, 0.46, '#8f2a1a');

    // 左下三个技能格（卡槽底板）
    const ss = 72, sy = H - 216, gap = 8;
    (this.skills || []).forEach((sk, i) => {
      const sx = 14 + i * (ss + gap);
      const ready = sk.t <= 0;
      if (skinGet('sk_card_slot.webp')) {
        skinSlice(ctx, 'sk_card_slot.webp', sx, sy, ss, ss, 26);
        if (!ready) {
          ctx.save();
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = '#1b1206';
          ctx.fillRect(sx + 3, sy + 3 + (ss - 6) * (1 - Math.min(1, sk.t / sk.cd)), ss - 6, (ss - 6) * Math.min(1, sk.t / sk.cd));
          ctx.restore();
        }
      } else {
        roundRect(ctx, sx, sy, ss, ss, 10, 'rgba(30,22,12,0.88)', ready ? '#79a24a' : '#3c4a38', 2);
      }
      const skIco = skinGet('sk_booster' + (i + 1) + '.webp') || (this.tex.skillIcons || [])[i];
      if (skIco && skIco.width) {
        const sc = (ss - 14) / Math.max(skIco.width, skIco.height);
        drawIcon(ctx, skIco, sx + ss / 2, sy + ss / 2 - 8, sc);
      }
      if (!ready) text(ctx, String(Math.ceil(sk.t)), sx + ss / 2, sy + ss / 2, 22, '#ffd9a0', 'center', '#20140a');
      text(ctx, sk.name.length > 10 ? sk.name.slice(0, 10) : sk.name, sx + ss / 2, sy + ss + 12, 11, '#ffe9a8', 'center', '#2a1608');
    });
  }

  btn(ctx, cx, cy, r, img, scale, color) {
    roundRect(ctx, cx - r, cy - r, r * 2, r * 2, 9, color, '#0c1420', 3);
    drawIcon(ctx, img, cx, cy, scale);
  }

  drawTitle() {
    const ctx = this.ctx;
    ctx.drawImage(this.tex.splash, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, W, H);
    const pw = 300, ph = pw * this.tex.play.height / this.tex.play.width;
    ctx.drawImage(this.tex.play, (W - pw) / 2, H * 0.62, pw, ph);
    text(ctx, '点击开始', W / 2, H * 0.62 + ph + 44, 22, '#dfe9f5', 'center', '#000');
  }

  drawPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20,12,4,0.62)';
    ctx.fillRect(0, 0, W, H);
    if (!skinSlice(ctx, 'sk_paused_box.webp', 70, H / 2 - 190, W - 140, 320, 60)) {
      roundRect(ctx, 70, H / 2 - 190, W - 140, 320, 20, 'rgba(40,28,14,0.95)', '#c68b4a', 4);
    }
    text(ctx, '已暂停', W / 2, H / 2 - 110, 40, '#ffd98a', 'center', '#4a2408');
    this.bigBtn(W / 2, H / 2 - 10, 240, 66, '继续战斗', 'green');
    this.bigBtn(W / 2, H / 2 + 76, 240, 66, '返回关卡', 'blue');
  }

  bigBtn(cx, cy, w, h, label, style) {
    const ctx = this.ctx;
    const st = style || 'green';
    if (!skinButton(ctx, cx - w / 2, cy - h / 2, w, h, st, false, label, { size: 26, stroke: '#3a1c08' })) {
      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 12, '#3a6f2f', '#f2d79a', 2);
      text(ctx, label, cx, cy, 26, '#fff', 'center', '#0c1016');
    }
  }

  drawResult() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20,12,4,0.72)';
    ctx.fillRect(0, 0, W, H);
    const top = H * 0.14;
    if (!skinSlice(ctx, 'sk_panel_box.webp', 56, top, W - 112, 560, 60)) {
      roundRect(ctx, 56, top, W - 112, 560, 20, 'rgba(40,28,14,0.95)', '#c68b4a', 4);
    }
    // 标题缎带
    if (skinGet('sk_top_title.webp')) {
      ctx.drawImage(skinGet('sk_top_title.webp'), W / 2 - 190, top - 66, 380, 102);
    }
    text(ctx, this.winFlag ? '胜 利' : '失 败', W / 2, top + 8, 40,
      this.winFlag ? '#ffe08a' : '#ffb0a0', 'center', '#5a2c0a');

    text(ctx, 'Stage ' + this.stage, W / 2, top + 78, 26, '#ffe9a8', 'center', '#4a2408');
    text(ctx, this.winFlag ? '击杀 ' + this.kills + ' · 金币 +' + this.coins
      : '城墙被攻破 · 击杀 ' + this.kills, W / 2, top + 116, 20, '#fff6dd', 'center', '#4a2408');
    // 掉落材料
    const drops = Object.keys(this.matDrops || {});
    if (drops.length) {
      const txt = '掉落：' + drops.map(id => this.matName(id) + ' x' + this.matDrops[id]).join('、');
      text(ctx, txt.slice(0, 42), W / 2, top + 148, 14, '#9fe6a8', 'center', '#2a3a12');
    }
    // 星级
    if (this.winFlag && this.gainedStars) {
      const n = this.gainedStars;
      for (let i = 0; i < 3; i++) {
        const file = i < n ? 'sk_star_filled.webp' : 'sk_star_empty.webp';
        if (!skinIcon(ctx, file, W / 2 - 78 + i * 56, top + 172, 48, i < n ? 1 : 0.75)) {
          if (this.tex.star) drawIcon(ctx, this.tex.star, W / 2 - 40 + i * 40, top + 186, 0.16, i < n ? 1 : 0.35);
        }
      }
    }
    (this.bonusRewards || []).slice(0, 3).forEach((r, i) => {
      text(ctx, r.slice(0, 40), W / 2, top + 232 + i * 22, 13, '#ffcf5c', 'center', '#4a2408');
    });

    this.bigBtn(W / 2, H * 0.62, 260, 70, '再来一局', 'green');
    this.bigBtn(W / 2, H * 0.62 + 90, 260, 70, '返回关卡', 'blue');
    // 广告位：胜利双倍金币 / 失败复活
    const adY = H * 0.62 + 180;
    if (this.winFlag) {
      const usable = !this.doubled && Ads.remaining() > 0;
      this.bigBtn(W / 2, adY, 260, 62, this.doubled ? '已领取双倍' : (usable ? '看广告 · 双倍金币' : '今日广告已用完'),
        usable ? 'orange' : 'smallGreen');
    } else {
      const usable = !this.revived && Ads.remaining() > 0;
      this.bigBtn(W / 2, adY, 260, 62, this.revived ? '已复活过' : (usable ? '看广告 · 原地复活' : '今日广告已用完'),
        usable ? 'orange' : 'smallGreen');
    }
    text(ctx, '广告剩余 ' + Ads.remaining() + '/' + Ads.dailyMax, W / 2, adY + 52, 13, '#f0ddb4', 'center');
  }

  // 结算页广告位：胜利领双倍金币 / 失败原地复活（每局各一次）
  adSlot() {
    if (this.winFlag) {
      if (this.doubled) { this.g.playSfx('sfx_equipfail', 0.3); return; }
    } else if (this.revived) { this.g.playSfx('sfx_equipfail', 0.3); return; }

    Ads.show({
      title: this.winFlag ? '看广告领双倍金币' : '看广告原地复活',
      seconds: 4,
      onDone: done => {
        if (!done) return;
        if (this.winFlag) {
          Player.addCoins(this.coins);   // 再发一次 = 双倍
          this.doubled = true;
          this.g.playSfx('sfx_buy', 0.4);
        } else {
          // 复活：城墙回 40%、英雄回满、清场，接着打当前波
          this.castleHP = Math.max(this.castleHP, Math.round(this.castleMax * 0.4));
          this.heroHP = this.heroMax;
          for (const e of this.enemies) { e.dead = true; e.dying = false; }
          this.enemies.length = 0;
          this.spawnLeft = Math.max(1, this.perWave - 1);
          this.spawnTimer = 1.6;
          this.state = 'play';
          this.revived = true;
          this.g.playSfx('sfx_levelup', 0.4);
        }
      },
      onFail: r => { if (r === 'daily_limit') this.g.playSfx('sfx_equipfail', 0.3); }
    });
  }

  // ---------- 输入 ----------
  toLocal(ev) {
    const r = this.g.cv.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) / r.width * W,
      y: (ev.clientY - r.top) / r.height * H
    };
  }

  ptDown(p) {
    if (this.state === 'title') { this.state = 'play'; this.g.audioUnlock(); return; }
    if (this.state === 'over') {
      if (Math.abs(p.x - W / 2) < 130 && Math.abs(p.y - H * 0.62) < 35) { this.reset(this.stageData); return; }
      if (Math.abs(p.x - W / 2) < 130 && Math.abs(p.y - (H * 0.62 + 90)) < 35) { this.g.showSelect(); return; }
      if (Math.abs(p.x - W / 2) < 130 && Math.abs(p.y - (H * 0.62 + 180)) < 31) { this.adSlot(); return; }
      return;
    }
    if (this.state === 'pause') {
      if (Math.abs(p.x - W / 2) < 120 && Math.abs(p.y - (H / 2 - 10)) < 34) { this.state = 'play'; return; }
      if (Math.abs(p.x - W / 2) < 120 && Math.abs(p.y - (H / 2 + 76)) < 34) { this.g.showSelect(); return; }
      return;
    }
    const byY = H - 96;
    if (p.y > byY) {
      if (p.x > W - 92) { this.state = 'pause'; this.g.playSfx('sfx_click', 0.3); return; }
      if (p.x > W - 156 && p.x <= W - 92) { this.speed = this.speed === 1 ? 2 : 1; this.g.playSfx('sfx_click', 0.3); return; }
      return;
    }
    // 三个技能格：x ∈ [14, 14+3*78]，y ∈ [H-210, H-140]
    if (p.y > H - 214 && p.y < H - 136 && p.x < 14 + 3 * 78) {
      const i = Math.floor((p.x - 14) / 78);
      if (i >= 0 && i < 3) this.castSkill(i);
    }
  }


  // 逐帧特效（Castle Guards 的 fx_fire / fx_heal / fx_hit1 / fx_hit2）
  spawnFxSheet(unit, x, y, size, life) {
    loadSheet(unit, 'loop');
    this.fx.push({ sheetUnit: unit, x, y, r: size, t: 0, life, max: life });
  }

  // 技能 0：穿透射击（一条竖线上的敌人全部受击并被击退）
  // 技能 1：攻速增益（6 秒内射速 ×1.6）
  // 技能 2：范围箭雨（城墙前一片区域集体受击）
  castSkill(i) {
    const sk = this.skills && this.skills[i];
    if (!sk || sk.t > 0) return;
    sk.t = sk.cd;
    this.shake = 0.28;
    const alive = this.enemies.filter(e => !e.dead && !e.dying);
    if (i === 0) {
      let n = 0;
      for (const e of alive) {
        if (Math.abs(e.x - HERO_X) > 150 || n >= 4) continue;
        n++;
        const dmg = this.g.heroDamage * 1.8 * (sk.mul || 1);
        e.hp -= dmg;
        e.y = Math.max(SPAWN_Y, e.y - 26);           // 击退
        this.floats.push({ x: e.x, y: e.y - 40, v: Math.round(dmg), life: 0.8, crit: true });
        if (e.hp <= 0) this.killEnemy(e);
      }
      this.spawnFxSheet('fx_hit2', HERO_X, HERO_FEET - HERO_H * 0.62, 300, 0.5);
    } else if (i === 1) {
      this.rageT = 6;
      this.spawnFxSheet('fx_heal', HERO_X, HERO_FEET - HERO_H * 0.5, 210, 1.1);
      this.fx.push({ img: this.tex.fxRing, x: HERO_X, y: HERO_FEET - HERO_H * 0.5, r: 260, t: 0, life: 0.6, max: 0.6 });
      this.fx.push({ img: this.tex.fxGlow, x: HERO_X, y: HERO_FEET - HERO_H * 0.75, r: 90, t: 0, life: 0.9, max: 0.9 });
    } else {
      for (const e of alive) {
        const dmg = this.g.heroDamage * 1.2 * (sk.mul || 1);
        e.hp -= dmg;
        this.floats.push({ x: e.x, y: e.y - 40, v: Math.round(dmg), life: 0.8 });
        if (e.hp <= 0) this.killEnemy(e);
      }
      for (let k = 0; k < 6; k++) {
        this.spawnFxSheet('fx_fire', 120 + k * 96, 300 + (k % 3) * 90, 120, 0.7);
      }
      this.fx.push({ img: this.tex.fxSwirl, x: W / 2, y: 520, r: 520, t: 0, life: 0.6, max: 0.6 });
    }
    this.g.playSfx('sfx_skill', 0.42);
  }
}

