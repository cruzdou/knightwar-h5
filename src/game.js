// ============================================================
//  骑士战争 H5 原型 · 场景逻辑
//  BootScene  : 加载资源
//  BattleScene: 城堡防守战斗（英雄自动射击，怪物从右往左推进）
// ============================================================

const W = 1280, H = 720;
const GROUND_Y = 600;      // 地面线
const CASTLE_X = 60;       // 城堡中心
const HERO_X = 420;        // 英雄站位
const STOP_X = 560;        // 怪物推进到这里开始砸城墙
const SPAWN_X = 1300;      // 怪物出生点

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const bar = document.getElementById('bootBar');
    const tip = document.getElementById('bootTip');
    this.load.on('progress', v => { if (bar) bar.style.width = (v * 100).toFixed(0) + '%'; });
    this.load.on('fileprogress', f => { if (tip) tip.textContent = '加载 ' + f.key; });

    this.load.json('chars', 'data/gameCharacters.json');
    this.load.json('levels', 'data/ListAllLevel.json');
    this.load.json('enemies', 'data/gameEnemies.json');

    const art = CONFIG.art;
    this.load.image('bg', art.bg);
    this.load.image('ground', art.ground);
    this.load.image('castle', art.castle);
    this.load.image('hero', art.hero);
    this.load.image('enemyA', art.enemyA);
    this.load.image('enemyB', art.enemyB);
    this.load.image('bullet', art.bullet);
    this.load.image('spark', art.spark);
    this.load.image('coin', art.coin);
    this.load.image('winBanner', art.win);
    this.load.image('loseBanner', art.lose);

    const au = CONFIG.audio;
    this.load.audio('sfx_shoot', au.shoot);
    this.load.audio('sfx_hit', au.hit);
    this.load.audio('sfx_coin', au.coin);
    this.load.audio('sfx_win', au.win);
    this.load.audio('sfx_lose', au.lose);
  }

  create() {
    const boot = document.getElementById('boot');
    if (boot) { boot.classList.add('hide'); setTimeout(() => boot.remove(), 500); }
    this.scene.start('Battle');
  }
}

class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  create() {
    const bal = CONFIG.balance;
    const lvCfg = CONFIG.level;

    // ---- 数据 ----
    const chars = this.cache.json.get('chars').listCharacters;
    this.heroData = chars.find(c => c.charID === CONFIG.heroCharID) || chars[0];
    const levels = this.cache.json.get('levels').listLevelSaveModel;
    this.levelData = levels[Math.min(lvCfg.index, levels.length - 1)] || {};

    // ---- 状态 ----
    this.castleHP = bal.castleHP;
    this.castleMax = bal.castleHP;
    this.coins = 0;
    this.kills = 0;
    this.waveIndex = 0;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.gapTimer = 0;
    this.phase = 'ready';      // ready / wave / gap / over
    this.enemies = [];
    this.fireTimer = 0;
    this.paused = false;

    this.heroRange = (this.heroData.atkRange || 15) * bal.rangePerUnit;
    this.heroDamage = (this.heroData.damage || 15) * bal.damageMult;
    this.heroAtkRate = (this.heroData.atkRate || 1) * bal.fireRateMult;

    // 调试参数：?auto=1 跳过开始界面；?god=1 不掉血；?waves=2 改波数
    const qs = new URLSearchParams(location.search);
    if (qs.get('god') === '1') CONFIG.debug.godMode = true;
    if (qs.get('waves')) CONFIG.level.waves = parseInt(qs.get('waves'), 10) || CONFIG.level.waves;
    this.autoStart = qs.get('auto') === '1';

    this.buildWorld();
    this.buildHud();
    if (this.autoStart) { this.startBattle(); } else { this.showReady(); }

    // 键盘：空格暂停
    this.input.keyboard.on('keydown-SPACE', () => this.togglePause());
  }

  // ============================================ 场景搭建
  buildWorld() {
    // 背景（整屏战场）
    this.bg = this.add.image(W / 2, H / 2, 'bg').setDepth(-10);

    // 近景草皮带，让角色脚下有落地感
    this.ground = this.add.tileSprite(W / 2, GROUND_Y + 60, W, 120, 'ground')
      .setTileScale(3.2, 1.2).setDepth(0).setAlpha(0.92);
    // 地面与天空交界处的暗线
    this.add.rectangle(W / 2, GROUND_Y + 1, W, 3, 0x1e2a12, 0.35).setDepth(0);
    // 整体暗角，压住边角
    this.add.rectangle(W / 2, 0, W, 120, 0x000000, 0).setDepth(0);

    // 城堡
    this.castle = this.add.image(CASTLE_X, GROUND_Y + 14, 'castle').setOrigin(0.5, 1)
      .setScale(0.55).setDepth(1);

    // 英雄
    this.hero = this.add.image(HERO_X, GROUND_Y + 10, 'hero').setOrigin(0.5, 1)
      .setScale(0.42).setDepth(3);
    // 英雄脚下阴影
    this.heroShadow = this.add.ellipse(HERO_X, GROUND_Y + 8, 150, 26, 0x000000, 0.25).setDepth(2);

    // 攻击范围提示（调试时可看）
    if (CONFIG.debug.showFps) {
      this.rangeRing = this.add.ellipse(HERO_X + this.heroRange / 2, GROUND_Y - 20,
        this.heroRange, 40, 0x66ccff, 0.06).setDepth(0);
    }
  }

  buildHud() {
    // 城堡血条
    this.add.rectangle(28, 28, 316, 26, 0x000000, 0.45).setOrigin(0, 0).setDepth(20);
    this.add.text(44, 41, '城墙', { fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '17px', color: '#ffd9a0' }).setOrigin(0, 0.5).setDepth(21);
    this.hpBarBg = this.add.rectangle(94, 41, 236, 16, 0x3a1010).setOrigin(0, 0.5).setDepth(21);
    this.hpBar = this.add.rectangle(94, 41, 236, 16, 0x40d06a).setOrigin(0, 0.5).setDepth(22);

    // 金币
    this.add.image(W - 168, 41, 'coin').setScale(0.55).setDepth(21);
    this.coinText = this.add.text(W - 140, 41, '0', {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '26px', color: '#ffd45e',
      stroke: '#3a2500', strokeThickness: 4
    }).setOrigin(0, 0.5).setDepth(21);

    // 波次
    this.waveText = this.add.text(W / 2, 44, '', {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '24px', color: '#eaf3ff',
      stroke: '#101820', strokeThickness: 5
    }).setOrigin(0.5).setDepth(21);

    // 操作提示
    this.add.text(W / 2, H - 26, '空格 暂停 / 继续', {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '16px', color: '#9fb3c8'
    }).setOrigin(0.5).setDepth(21);

    if (CONFIG.debug.showFps) {
      this.fpsText = this.add.text(12, H - 34, '', {
        fontFamily: 'monospace', fontSize: '14px', color: '#7fe0a8'
      }).setDepth(21);
    }
  }

  showReady() {
    const c = this.add.container(0, 0).setDepth(50);
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x06090f, 0.82);
    const title = this.add.text(W / 2, H / 2 - 96, '骑士战争 · H5 原型', {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '46px', color: '#eaf3ff'
    }).setOrigin(0.5);
    const sub = this.add.text(W / 2, H / 2 - 40,
      `英雄 ${this.heroData.name} · 伤害 ${this.heroDamage.toFixed(0)} · 攻速 ${this.heroAtkRate.toFixed(1)}/秒 · 射程 ${this.heroRange}px`, {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '20px', color: '#9fb3c8'
    }).setOrigin(0.5);
    const lvInfo = this.add.text(W / 2, H / 2 + 2,
      `关卡 #${CONFIG.level.index} · 原表总怪 ${this.levelData.totalEnemy || '-'} · 过关金币 ${this.levelData.levelCoins || '-'}`, {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '18px', color: '#6f8399'
    }).setOrigin(0.5);

    const btnBg = this.add.rectangle(W / 2, H / 2 + 96, 240, 68, 0x2f7ad6).setStrokeStyle(2, 0x8fc4ff);
    const btnTx = this.add.text(W / 2, H / 2 + 96, '开始战斗', {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '26px', color: '#ffffff'
    }).setOrigin(0.5);
    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on('pointerdown', () => {
      this.sound.unlock();
      c.destroy();
      this.startBattle();
    });

    c.add([bg, title, sub, lvInfo, btnBg, btnTx]);
  }

  // ============================================ 战斗流程
  startBattle() {
    this.phase = 'gap';
    this.gapTimer = 600;
    this.nextWave();
  }

  nextWave() {
    this.waveIndex++;
    this.waveText.setText(`WAVE ${this.waveIndex} / ${CONFIG.level.waves}`);
    this.toSpawn = CONFIG.level.enemiesStart + (this.waveIndex - 1) * CONFIG.level.enemiesStep;
    this.spawnTimer = 0;
    this.phase = 'wave';

    const t = this.add.text(W / 2, 150, `第 ${this.waveIndex} 波`, {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '40px', color: '#ffd45e',
      stroke: '#2a1600', strokeThickness: 6
    }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, alpha: 0, y: 110, duration: 900, onComplete: () => t.destroy() });
  }

  spawnEnemy() {
    const isElite = this.waveIndex >= 3 && Math.random() < 0.4;
    const key = isElite ? 'enemyB' : 'enemyA';
    const baseHp = 220;
    const hp = baseHp * Math.pow(CONFIG.balance.hpMultPerWave, this.waveIndex - 1) * (isElite ? 2.4 : 1);

    const startX = SPAWN_X + Math.random() * 40;
    const spr = this.add.image(startX, GROUND_Y + 8, key).setOrigin(0.5, 1).setDepth(4);
    const scale = isElite ? 0.34 : 0.3;
    spr.setScale(scale * 0.6);
    spr.setAlpha(0);
    this.tweens.add({ targets: spr, alpha: 1, scale: scale, duration: 260 });

    const hpBg = this.add.rectangle(0, 0, 64, 7, 0x1a1a1a, 0.9).setDepth(6);
    const hpFg = this.add.rectangle(0, 0, 64, 5, isElite ? 0xff8a3c : 0x53d97a).setDepth(7);

    const e = {
      spr, hpBg, hpFg,
      hp, maxHp: hp,
      speed: 96 * (isElite ? 0.8 : 1),
      dmg: 15 * (isElite ? 1.8 : 1),
      coin: isElite ? 6 : 3,
      elite: isElite,
      stopX: Math.max(470, STOP_X - this.enemies.filter(x => x.alive).length * 48 - Math.random() * 18),
      atkTimer: 0,
      alive: true
    };
    this.enemies.push(e);
  }

  // ============================================ 每帧
  update(time, delta) {
    const dt = delta / 1000;
    if (this.phase === 'ready' || this.phase === 'over' || this.paused) return;

    if (this.fpsText) this.fpsText.setText('FPS ' + Math.round(this.game.loop.actualFps));

    // 出怪
    if (this.phase === 'wave' && this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.toSpawn--;
        this.spawnTimer = CONFIG.level.spawnGapMs / 1000 * (0.75 + Math.random() * 0.5);
      }
    }

    // 波次间隔 → 下一波 / 通关
    if (this.phase === 'gap') {
      this.gapTimer -= dt;
      if (this.gapTimer <= 0) {
        if (this.waveIndex >= CONFIG.level.waves) this.win();
        else this.nextWave();
      }
    }

    // 敌人推进
    let alive = 0;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      alive++;
      const spr = e.spr;
      if (spr.x > e.stopX) {
        spr.x -= e.speed * dt;
        // 走路轻微上下晃
        spr.y = GROUND_Y + 8 + Math.sin(time / 170 + spr.x / 40) * 2;
      } else {
        e.atkTimer -= dt;
        if (e.atkTimer <= 0) {
          e.atkTimer = 1.0;
          this.damageCastle(e.dmg);
          this.tweens.add({ targets: spr, x: spr.x - 12, yoyo: true, duration: 120 });
        }
      }
      // 血条跟随
      e.hpBg.setPosition(spr.x, spr.y - spr.displayHeight - 12);
      e.hpFg.setPosition(spr.x - 32, spr.y - spr.displayHeight - 12);
    }

    // 自动射击
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      const target = this.pickTarget();
      if (target) {
        this.shoot(target);
        this.fireTimer = 1 / this.heroAtkRate;
      }
    }

    // 本波清空 → 进入间隔
    if (this.phase === 'wave' && this.toSpawn === 0 && alive === 0) {
      if (this.waveIndex >= CONFIG.level.waves) {
        this.win();
      } else {
        this.phase = 'gap';
        this.gapTimer = CONFIG.level.waveGapMs / 1000;
      }
    }
  }

  pickTarget() {
    let best = null, bestDx = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.spr.x - HERO_X;
      if (dx > 0 && dx <= this.heroRange && dx < bestDx) { best = e; bestDx = dx; }
    }
    return best;
  }

  shoot(target) {
    const fromX = HERO_X + 40, fromY = GROUND_Y - 120;
    const bullet = this.add.image(fromX, fromY, 'bullet').setDepth(8);
    bullet.setScale(0.28);
    bullet.setRotation(Math.atan2(target.spr.y - 60 - fromY, target.spr.x - fromX) + Math.PI / 2);
    this.tweens.add({
      targets: bullet,
      x: target.spr.x,
      y: target.spr.y - target.spr.displayHeight * 0.5,
      duration: 260,
      onComplete: () => { bullet.destroy(); this.hitEnemy(target); }
    });
    // 英雄后坐
    this.tweens.add({ targets: this.hero, x: HERO_X - 10, yoyo: true, duration: 110 });
    this.playSfx('sfx_shoot', 0.45);
  }

  hitEnemy(e) {
    if (!e.alive) return;
    const crit = Math.random() < (this.heroData.critRate || 0.1);
    let dmg = this.heroDamage * (crit ? CONFIG.balance.critMult : 1);
    dmg = Math.max(1, dmg - (e.armor || 0));
    e.hp -= dmg;

    this.showDamage(e.spr.x, e.spr.y - e.spr.displayHeight - 6, dmg, crit);
    this.sparkAt(e.spr.x, e.spr.y - e.spr.displayHeight * 0.55);
    this.playSfx('sfx_hit', 0.25);

    const ratio = Math.max(0, e.hp / e.maxHp);
    e.hpFg.width = 64 * ratio;

    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.alive = false;
    this.kills++;
    const gain = Math.round(e.coin * CONFIG.balance.coinMult);
    this.coins += gain;
    this.coinText.setText(String(this.coins));
    this.playSfx('sfx_coin', 0.35);

    const plus = this.add.text(e.spr.x, e.spr.y - 60, '+' + gain, {
      fontFamily: 'Arial', fontSize: '22px', color: '#ffd45e', stroke: '#3a2500', strokeThickness: 4
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: plus, y: plus.y - 50, alpha: 0, duration: 700, onComplete: () => plus.destroy() });

    e.hpBg.destroy(); e.hpFg.destroy();
    this.tweens.add({
      targets: e.spr, alpha: 0, y: e.spr.y - 18, angle: e.elite ? 12 : -12,
      duration: 420, onComplete: () => e.spr.destroy()
    });
  }

  damageCastle(dmg) {
    if (CONFIG.debug.godMode) return;
    this.castleHP = Math.max(0, this.castleHP - dmg);
    this.hpBar.width = 236 * (this.castleHP / this.castleMax);
    this.hpBar.fillColor = this.castleHP / this.castleMax > 0.35 ? 0x40d06a : 0xe0503c;
    this.cameras.main.shake(120, 0.004);
    this.tweens.add({ targets: this.castle, alpha: 0.5, yoyo: true, duration: 90 });
    if (this.castleHP <= 0) this.lose();
  }

  showDamage(x, y, dmg, crit) {
    const t = this.add.text(x, y, Math.round(dmg).toString(), {
      fontFamily: 'Arial Black, Arial', fontSize: crit ? '34px' : '26px',
      color: crit ? '#ff5a3c' : '#ffffff', stroke: '#20120a', strokeThickness: 4
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 620, onComplete: () => t.destroy() });
  }

  sparkAt(x, y) {
    const s = this.add.image(x, y, 'spark').setDepth(9).setScale(0.5).setTint(0xffd08a);
    this.tweens.add({ targets: s, scale: 1.1, alpha: 0, duration: 260, onComplete: () => s.destroy() });
  }

  playSfx(key, vol) {
    if (this.sound.locked) return;
    try { this.sound.play(key, { volume: vol }); } catch (err) { /* 音频缺失不影响玩法 */ }
  }

  togglePause() {
    if (this.phase === 'over' || this.phase === 'ready') return;
    this.paused = !this.paused;
    if (this.paused) {
      this.pauseText = this.add.text(W / 2, H / 2, '已暂停\n空格继续', {
        fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '36px', color: '#eaf3ff',
        align: 'center', stroke: '#000', strokeThickness: 6
      }).setOrigin(0.5).setDepth(45);
    } else if (this.pauseText) { this.pauseText.destroy(); this.pauseText = null; }
  }

  // ============================================ 结算
  showResult(isWin) {
    this.phase = 'over';
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72));
    const banner = this.add.image(W / 2, H / 2 - 130, isWin ? 'winBanner' : 'loseBanner').setScale(0.62);
    c.add(banner);

    const line = isWin
      ? `击杀 ${this.kills}  ·  金币 +${this.coins}  ·  原表过关奖励 ${this.levelData.levelCoins || 0}`
      : `坚守到第 ${this.waveIndex} 波  ·  击杀 ${this.kills}`;
    c.add(this.add.text(W / 2, H / 2 + 10, line, {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '24px', color: '#eaf3ff'
    }).setOrigin(0.5));

    const btn = this.add.rectangle(W / 2, H / 2 + 100, 220, 62, 0x2f7ad6).setStrokeStyle(2, 0x8fc4ff);
    const tx = this.add.text(W / 2, H / 2 + 100, '再来一局', {
      fontFamily: 'Arial, "Microsoft YaHei"', fontSize: '24px', color: '#fff'
    }).setOrigin(0.5);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.scene.restart());
    c.add([btn, tx]);

    this.playSfx(isWin ? 'sfx_win' : 'sfx_lose', 0.6);
  }

  win() {
    if (this.phase === 'over') return;
    // 结算前把场上怪清掉
    this.showResult(true);
  }

  lose() {
    if (this.phase === 'over') return;
    this.showResult(false);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d1016',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H
  },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, BattleScene]
});




