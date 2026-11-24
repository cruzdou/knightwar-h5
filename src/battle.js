// ============================================================
//  战斗场景（竖屏 720×1280，按原版 1080×1920 布局 0.667 折算）
//  上：原版 bg1 战场   下：castle_1 城墙 + 站在墙上的英雄（Mel）
// ============================================================

const WALL_Y = 940;        // 城墙顶边
const HERO_X = 360;
const HERO_FEET = 1060;    // 英雄脚底
const HERO_H = 145;        // 英雄屏幕上高度
const SPAWN_Y = 150;       // 怪物出生（远端）
const STOP_Y = 975;        // 推进到城墙前
const ENEMY_H_NEAR = 118;  // 到墙时的高度
const ENEMY_H_FAR = 64;    // 出生时的高度

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
    // 主角走存档里选中的英雄（1 Mel / 2 Maximus / 3 Sam / 4 Crimson）
    this.hero_infos = {};
    for (const [id, name] of Object.entries(HERO_SKELETONS)) {
      try { this.hero_infos[id] = await loadSpine(name); } catch (e) { /* 骨架缺件时跳过 */ }
    }
    this.hero_info = this.hero_infos[Player.charID] || this.hero_infos[1] || await loadSpine('Elf_Archer');

    // 只取「渲染完整」的骨架当敌人（其余骨架缺件，先不进池）
    const pool = ['Goblin', 'Gnoll', 'Bandit', 'Thorn', 'Wolf', 'Ent',
                  'Anubis', 'Ice_Mage', 'FireMage', 'Lizard_Rider',
                  'Giant_Spiders', 'Shadow_Archer', 'Hero_04_Ingame',
                  'Devil_Turtle', 'Sand_Warrios', 'Seraph'];
    this.enemy_pool = [];
    this.enemy_infos = {};
    for (const n of pool) {
      try {
        const info = await loadSpine(n);
        this.enemy_infos[n] = info;
        this.enemy_pool.push(info);
      } catch (e) { /* 缺图集跳过 */ }
    }

    this.tex = {
      bgfield: await loadImage('bg1.png'),
      bgZones: [await loadImage('bg1.png'), await loadImage('bg2.png'),
                await loadImage('bg3.png'), await loadImage('bg4.png'), await loadImage('bg5.png')],
      castle: await loadImage('castle_1.png'),
      castle2: await loadImage('castle_1_1.png'),
      arrow: await loadImage('bullet_arrow.png'),
      gold: await loadImage('UI_cur_coin.png'),
      gem: await loadImage('icon_gem.png'),
      sword: await loadImage('UI-btn-fight.png'),
      magic: await loadImage('btn_icon_magic.png'),
      skillIcons: [await loadImage('Skill_H01_1.png'), await loadImage('Skill_H01_2.png'),
                   await loadImage('Skill_H01_3.png')],
      skillBorder: await loadImage('Skill_border_active.png'),
      pause: await loadImage('btn_icon_player_pause.png'),
      speed: await loadImage('btn_icon_boot_speed.png'),
      hpbar: await loadImage('HP_bar_border.png'),
      btmbar: await loadImage('HUD_btm_bar.png'),
      fxRing: await loadImage('ground_light03.png'),
      fxBolt: await loadImage('ground_earth03.png'),
      fxSwirl: await loadImage('ground_storm.png'),
      fxGlow: await loadImage('fx_glow1.png'),
      fxStar: await loadImage('fx_star1.png'),
      fxDust: await loadImage('fx_dust1.png'),
      fxSmoke: await loadImage('fx_smoke_01_d.png'),
      win: await loadImage('victory.png'),
      lose: await loadImage('defeatbanner.png'),
      star: await loadImage('result_star.png'),
      splash: await loadImage('BG_Splash.png'),
      play: await loadImage('Play_btn.png')
    };

    this.bg = this.buildBackground();
    this.setHero(Player.charID);
    this.reset();
  }

  // 换主角骨架（按 charID）
  setHero(charID) {
    const info = this.hero_infos[charID] || this.hero_info;
    if (!info) return;
    this.hero_info = info;
    this.hero = new Actor(info, { anim: info.anims.includes('Idle') ? 'Idle' : info.anims[0] });
    this.hero.x = HERO_X;
    this.hero.y = HERO_FEET;
    this.hero.scale = HERO_H / info.h;
  }

  // 每个分区的战场背景（原包 bg1~bg5，按分区轮换）
  bgFor(zone) {
    const list = this.tex.bgZones || [this.tex.bgfield];
    const ok = list.filter(Boolean);
    return ok[Math.abs(zone || 0) % ok.length] || this.tex.bgfield;
  }

  // ---------- 静态背景（画一次） ----------
  buildBackground() {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    // 1) 原版战场背景：按分区取 bg1~bg5，等比铺满战场区
    const bgm = this.bgFor(this.stageData && this.stageData.zone);
    const bh = WALL_Y + 30;
    const scale = Math.max(W / bgm.width, bh / bgm.height);
    const dw = bgm.width * scale, dh = bgm.height * scale;
    c.drawImage(bgm, (W - dw) / 2, bh - dh, dw, dh);

    // 2) 远端压暗
    const fog = c.createLinearGradient(0, 0, 0, WALL_Y * 0.5);
    fog.addColorStop(0, 'rgba(14,26,10,0.5)');
    fog.addColorStop(1, 'rgba(14,26,10,0)');
    c.fillStyle = fog; c.fillRect(0, 0, W, WALL_Y * 0.5);

    // 3) 两侧压暗（原版两侧灌木阴影）
    const sideL = c.createLinearGradient(0, 0, 140, 0);
    sideL.addColorStop(0, 'rgba(6,16,6,0.7)');
    sideL.addColorStop(1, 'rgba(6,16,6,0)');
    c.fillStyle = sideL; c.fillRect(0, 0, 140, WALL_Y);
    const sideR = c.createLinearGradient(W, 0, W - 140, 0);
    sideR.addColorStop(0, 'rgba(6,16,6,0.7)');
    sideR.addColorStop(1, 'rgba(6,16,6,0)');
    c.fillStyle = sideR; c.fillRect(W - 140, 0, 140, WALL_Y);

    // 4) 城墙：原包两套皮肤（castle_1 / castle_1_1），后半段分区换第二套
    const castleArt = ((this.stageData && this.stageData.zone) >= 5 && this.tex.castle2) ? this.tex.castle2 : this.tex.castle;
    const cw = W + 40, ch = cw * castleArt.height / castleArt.width;
    c.drawImage(castleArt, (W - cw) / 2, WALL_Y - 6, cw, ch);

    // 5) 城墙下暗部
    c.fillStyle = '#111820';
    c.fillRect(0, WALL_Y - 6 + ch, W, H - WALL_Y + 6 - ch);
    return cv;
  }

  // ---------- 一局重置（吃 ListAllLevel 的关卡元数据） ----------
  reset(stage) {
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
    this.waveCount = Math.max(3, Math.min(6, Math.ceil(realTotal / 12)));
    this.perWave = Math.max(3, Math.min(8, Math.round(realTotal / this.waveCount)));
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
    this.fx.length = 0;
    this.coins = 0;
    this.castleHP = 561;
    this.castleMax = 561;
    this.heroHP = 500;
    this.heroMax = 500;
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
      t: 0
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
  }

  // 按分区挑怪物（只用渲染完整的骨架）
  poolForZone(zone) {
    const sets = [
      ['Goblin', 'Wolf', 'Gnoll', 'Bandit'],
      ['Thorn', 'Giant_Spiders', 'Ent', 'Devil_Turtle'],
      ['Anubis', 'Shadow_Archer', 'Hero_04_Ingame', 'Gnoll'],
      ['Ice_Mage', 'FireMage', 'Lizard_Rider', 'Seraph'],
      ['Bandit', 'Anubis', 'Sand_Warrios', 'Thorn']
    ];
    const names = sets[(zone || 0) % sets.length];
    const out = names.map(n => this.enemy_infos[n]).filter(Boolean);
    return out.length ? out : this.enemy_pool;
  }

  // ---------- 出怪 ----------
  spawnEnemy() {
    const info = this.pool[Math.floor(Math.random() * this.pool.length)];
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

  hitTarget(arrow) {
    const e = arrow.target;
    if (!e || e.dead || e.dying) return;
    const crit = Math.random() < Math.min(0.5, (this.heroCrit || 12) / 100);
    const dmg = this.g.heroDamage * (crit ? 1.5 : 1);
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
    if (e.info.anims.includes('Die')) e.state.setAnimation(0, 'Die', false);
    this.kills++;
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
    const times = isBossUnit ? 2 : (Math.random() < this.matDropRate ? 1 : 0);
    for (let i = 0; i < times; i++) {
      const id = this.rollMat();
      Player.addMat(id, 1);
      this.matDrops[id] = (this.matDrops[id] || 0) + 1;
      this.matPops.push({ x: e.x + (i - times / 2) * 18, y: e.y - 52, t: 0, id });
    }
    // 死亡特效：尘土 + 星点
    const cy = e.y - e.info.h * e.scale * 0.45;
    this.fx.push({ img: this.tex.fxDust, x: e.x, y: cy, r: 96, t: 0, life: 0.55, max: 0.55, rot: 0 });
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
          this.castleHP = Math.max(0, this.castleHP - 12);
          this.shake = 0.22;
          // 撞墙特效：烟尘 + 火花
          this.fx.push({ img: this.tex.fxSmoke, x: e.x, y: WALL_Y - 10, r: 110, t: 0, life: 0.5, max: 0.5, rot: 0 });
          this.fx.push({ img: this.tex.fxGlow, x: e.x, y: WALL_Y - 26, r: 48, t: 0, life: 0.25, max: 0.25, rot: 0 });
          this.g.playSfx('sfx_wallstone', 0.32);
          if (this.castleHP <= 0) this.gameOver(false);
        }
        if (e.info.anims.includes('Attack_01')) e.state.setAnimation(0, 'Attack_01', false);
      }
    }

    // 英雄自动射箭（优先打最靠近城墙的）
    this.fireTimer -= d;
    if (this.fireTimer <= 0 && alive > 0) {
      const target = this.enemies.filter(e => !e.dead && !e.dying).sort((a, b) => b.y - a.y)[0];
      if (target) {
        this.shoot(target);
        this.fireTimer = 1 / (this.g.heroAtkRate * (this.rageT > 0 ? 1.6 : 1));
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
    // 结算写存档：金币入账 + 星级（按城墙剩余血量给 1~3 星）
    if (win) {
      Player.addCoins(this.coins);
      const ratio = this.castleHP / this.castleMax;
      const stars = ratio > 0.7 ? 3 : (ratio > 0.35 ? 2 : 1);
      this.gainedStars = stars;
      if (this.stageData) Player.setStars(this.stageData.name, stars);
    }
    this.g.playSfx(win ? 'sfx_win' : 'sfx_lose', 0.6);
  }

  // ---------- 绘制 ----------
  draw() {
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
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life / f.max) * 0.9;
      ctx.translate(f.x, f.y);
      ctx.rotate(p * 0.8);
      const sz = f.r * (0.5 + p * 0.9);
      ctx.drawImage(f.img, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }

    const sorted = [...this.enemies].filter(e => !e.dead).sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      e.draw(ctx, this.renderer);
      if (!e.dying) this.drawEnemyHP(e);
    }

    this.hero.draw(ctx, this.renderer);

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
    const ctx = this.ctx;
    const w = Math.max(34, e.info.w * e.scale * 0.85), h = 6;
    const x = e.x - w / 2, y = e.y - e.info.h * e.scale - 10;
    ctx.fillStyle = 'rgba(8,8,8,0.9)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#e23b28';
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
  }

  // ---------- HUD（对齐原版 1080×1920 布局） ----------
  drawHud() {
    const ctx = this.ctx;

    // ===== 顶部状态条 =====
    const barY = 14, barH = 52, barX = 12, barW = W - 24;
    roundRect(ctx, barX, barY, barW, barH, 7, '#1d2632');

    // 红色 Stage 段（约 42%）
    const redW = barW * 0.42;
    roundRect(ctx, barX, barY, redW, barH, 7, '#a4121a');
    text(ctx, 'Stage ' + this.stage, barX + 14, barY + barH / 2, 28, '#ffffff', 'left', '#5d0a0e');

    // 绿色城墙血条（42% → 75%）
    const gx = barX + redW + 6, gw = barW * 0.75 - redW - 6;
    roundRect(ctx, gx, barY, gw, barH, 5, '#28361c');
    roundRect(ctx, gx, barY, gw * (this.castleHP / this.castleMax), barH, 5, '#5d8729');

    // 城墙血量数字
    text(ctx, String(Math.round(this.castleHP)), barX + barW * 0.70, barY + barH / 2, 32, '#ffffff', 'center', '#141a12');

    // 金币（右上角，数字在图标左侧）
    drawIcon(ctx, this.tex.gold, W - 34, barY + barH / 2, 0.8);
    text(ctx, String(this.coins), W - 72, barY + barH / 2, 28, '#ffe07a', 'right', '#3a2a08');

    // ===== 四段推进小条 =====
    const pipY = barY + barH + 8, pipH = 9;
    const pipGap = 5, pipW = (barW * 0.72 - pipGap * 3) / 4;
    for (let i = 0; i < 4; i++) {
      const on = i < this.wave;
      roundRect(ctx, barX + i * (pipW + pipGap), pipY, pipW, pipH, 4,
        on ? (i === 3 ? '#2f6fb0' : '#f0c23a') : '#243044');
    }

    // ===== 底部操作栏 =====
    const byY = H - 96;
    roundRect(ctx, 0, byY, W, 96, 0, '#1a2333');
    ctx.fillStyle = 'rgba(120,170,235,0.55)';
    ctx.fillRect(0, byY, W, 2);

    const cy = byY + 50;
    // 左：武器 / 宝石
    this.btn(ctx, 56, cy, 30, this.tex.sword, 0.42, '#2f6fb0');
    this.btn(ctx, 128, cy, 30, this.tex.gem, 0.62, '#2f6fb0');

    // 中：英雄血条（带原版外框）
    const hx = 172, hw = W - 172 - 168, hy = cy - 21, hh = 42;
    roundRect(ctx, hx - 7, hy - 7, hw + 14, hh + 14, 16, '#d8b055');
    roundRect(ctx, hx - 3, hy - 3, hw + 6, hh + 6, 12, '#7a5a24');
    roundRect(ctx, hx, hy, hw, hh, 9, '#3a0b0b');
    roundRect(ctx, hx, hy, hw * (this.heroHP / this.heroMax), hh, 9, '#b3202a');
    text(ctx, String(Math.round(this.heroHP)), hx + hw / 2, hy + hh / 2, 24, '#ffffff', 'center', '#520a0a');

    // 右：加速 / 暂停
    this.btn(ctx, W - 120, cy, 30, this.tex.speed, 0.55, '#2f6fb0');
    this.btn(ctx, W - 56, cy, 30, this.tex.pause, 0.55, '#c0272d');

    // 左下三个技能格（图标用原包 Skill_H01_1~3）
    const ss = 70, sy = H - 210, gap = 8;
    (this.skills || []).forEach((sk, i) => {
      const sx = 14 + i * (ss + gap);
      const ready = sk.t <= 0;
      roundRect(ctx, sx, sy, ss, ss, 10, 'rgba(12,22,16,0.82)', ready ? '#79a24a' : '#3c4a38', 2);
      drawIcon(ctx, this.tex.skillIcons[i], sx + ss / 2, sy + ss / 2 - 4, 0.52);
      if (!ready) {
        const k = sk.t / sk.cd;
        ctx.fillStyle = 'rgba(0,0,0,0.58)';
        ctx.fillRect(sx + 2, sy + 2 + (ss - 4) * (1 - k), ss - 4, (ss - 4) * k);
        text(ctx, String(Math.ceil(sk.t)), sx + ss / 2, sy + ss / 2, 20, '#ffd9a0', 'center', '#20140a');
      }
      text(ctx, sk.name.length > 10 ? sk.name.slice(0, 10) : sk.name, sx + ss / 2, sy + ss - 10, 9, '#cfe0b8', 'center');
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
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, '已暂停', W / 2, H / 2 - 90, 40, '#fff', 'center', '#000');
    this.bigBtn(W / 2, H / 2 - 10, 240, 66, '继续战斗', '#2f7ad6', '#8fc4ff');
    this.bigBtn(W / 2, H / 2 + 76, 240, 66, '返回关卡', '#4a5a70', '#9fb2c6');
  }

  bigBtn(cx, cy, w, h, label, bg, edge) {
    const ctx = this.ctx;
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 12, bg, edge, 2);
    text(ctx, label, cx, cy, 26, '#fff', 'center', '#0c1016');
  }

  drawResult() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    const img = this.winFlag ? this.tex.win : this.tex.lose;
    const iw = 460, ih = iw * img.height / img.width;
    ctx.drawImage(img, (W - iw) / 2, H * 0.20, iw, ih);
    text(ctx, 'Stage ' + this.stage, W / 2, H * 0.20 + ih + 26, 26, '#ffe9a8', 'center', '#000');
    text(ctx, this.winFlag ? '通关 · 击杀 ' + this.kills + ' · 金币 +' + this.coins
      : '城墙被攻破 · 击杀 ' + this.kills, W / 2, H * 0.20 + ih + 62, 20, '#fff', 'center', '#000');
    // 本局掉落材料
    const drops = Object.keys(this.matDrops || {});
    if (drops.length) {
      const txt = '掉落：' + drops.map(id => this.matName(id) + ' x' + this.matDrops[id]).join('、');
      text(ctx, txt.slice(0, 42), W / 2, H * 0.20 + ih + 88, 14, '#9fe6a8', 'center', '#000');
    }
    if (this.winFlag && this.gainedStars) {
      const n = this.gainedStars;
      for (let i = 0; i < 3; i++) {
        if (this.tex.star) drawIcon(ctx, this.tex.star, W / 2 - 40 + i * 40, H * 0.20 + ih + 104, 0.16, i < n ? 1 : 0.35);
      }
    }
    this.bigBtn(W / 2, H * 0.62, 260, 70, '再来一局', '#2f7ad6', '#8fc4ff');
    this.bigBtn(W / 2, H * 0.62 + 90, 260, 70, '返回关卡', '#4a5a70', '#9fb2c6');
    // 广告位：胜利双倍金币 / 失败复活（各一次，可换成真实激励视频）
    const adY = H * 0.62 + 180;
    if (this.winFlag) {
      const usable = !this.doubled && Ads.remaining() > 0;
      this.bigBtn(W / 2, adY, 260, 62, this.doubled ? '已领取双倍' : (usable ? '看广告 · 双倍金币' : '今日广告已用完'),
        usable ? '#c58a1c' : '#3a4654', usable ? '#ffdf9a' : '#4a5a70');
    } else {
      const usable = !this.revived && Ads.remaining() > 0;
      this.bigBtn(W / 2, adY, 260, 62, this.revived ? '已复活过' : (usable ? '看广告 · 原地复活' : '今日广告已用完'),
        usable ? '#c58a1c' : '#3a4654', usable ? '#ffdf9a' : '#4a5a70');
    }
    text(ctx, '广告剩余 ' + Ads.remaining() + '/' + Ads.dailyMax, W / 2, adY + 52, 13, '#8fa3b7', 'center');
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
        const dmg = this.g.heroDamage * 1.8;
        e.hp -= dmg;
        e.y = Math.max(SPAWN_Y, e.y - 26);           // 击退
        this.floats.push({ x: e.x, y: e.y - 40, v: Math.round(dmg), life: 0.8, crit: true });
        if (e.hp <= 0) this.killEnemy(e);
      }
      this.fx.push({ img: this.tex.fxBolt, x: HERO_X, y: HERO_FEET - HERO_H * 0.55, r: 420, t: 0, life: 0.42, max: 0.42 });
    } else if (i === 1) {
      this.rageT = 6;
      this.fx.push({ img: this.tex.fxRing, x: HERO_X, y: HERO_FEET - HERO_H * 0.5, r: 260, t: 0, life: 0.6, max: 0.6 });
      this.fx.push({ img: this.tex.fxGlow, x: HERO_X, y: HERO_FEET - HERO_H * 0.75, r: 90, t: 0, life: 0.9, max: 0.9 });
    } else {
      for (const e of alive) {
        const dmg = this.g.heroDamage * 1.2;
        e.hp -= dmg;
        this.floats.push({ x: e.x, y: e.y - 40, v: Math.round(dmg), life: 0.8 });
        if (e.hp <= 0) this.killEnemy(e);
      }
      for (let k = 0; k < 6; k++) {
        this.fx.push({
          img: this.tex.fxStar, x: 120 + k * 96, y: 260 + (k % 3) * 90,
          r: 60, t: 0, life: 0.55, max: 0.55, rot: Math.random() * 3
        });
      }
      this.fx.push({ img: this.tex.fxSwirl, x: W / 2, y: 520, r: 520, t: 0, life: 0.6, max: 0.6 });
    }
    this.g.playSfx('sfx_skill', 0.42);
  }
}

