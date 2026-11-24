// ============================================================
//  战斗场景（竖屏，原版布局）
//  上：草坡 + 从远处走下来的怪   下：城墙 + 站在墙上的英雄
// ============================================================

const WALL_Y = 940;        // 城墙顶部在屏幕上的位置
const HERO_X = 360;
const HERO_FEET = 1085;    // 英雄脚底
const SPAWN_Y = 150;       // 怪物出生（远处）
const STOP_Y = 1005;       // 怪物推进到城墙
const MIN_SCALE_Y = 170, MAX_SCALE_Y = STOP_Y;   // 透视缩放范围

class BattleScene {
  constructor(game) {
    this.g = game;
    this.ctx = game.ctx;
    this.renderer = new SP.canvas.SkeletonRenderer(this.ctx);
    this.state = 'title';       // title / play / pause / over
    this.time = 0;
    this.speed = 1;
    this.enemies = [];
    this.arrows = [];
    this.floats = [];
    this.coinPops = [];
    this.shake = 0;
    this.paused = false;
  }

  async init() {
    this.hero_info = await loadSpine('Elf_Archer');
    this.enemy_pool = [];
    // 优先原表里出现过的怪，取有骨架的
    const names = ['Bandit', 'Goblin', 'Ghoul', 'Gargoyle', 'Harpy', 'Gnoll', 'Orcs', 'Troll', 'Wolf', 'Vulture', 'Ent', 'Thorn', 'Seraph', 'Monk', 'Anubis'];
    for (const n of names) {
      try { this.enemy_pool.push(await loadSpine(n)); } catch (e) { /* 有些骨架缺图集，跳过 */ }
    }
    this.tex = {
      castle: await loadImage('castle_1.png'),
      bgfield: await loadImage('bg1.png'),
      arrow: await loadImage('bullet_arrow.png'),
      gold: await loadImage('icon_gold.png'),
      gem: await loadImage('icon_gem.png'),
      sword: await loadImage('UI-btn-fight.png'),
      pause: await loadImage('btn_pause.png'),
      magic: await loadImage('btn_icon_magic.png'),
      speed: await loadImage('btn_icon_boot_speed.png'),
      win: await loadImage('victory.png'),
      lose: await loadImage('defeatbanner.png'),
      splash: await loadImage('BG_Splash.png'),
      play: await loadImage('Play_btn.png'),
      hpborder: await loadImage('HP_bar_border.png')
    };
    this.bg = this.buildBackground();
    this.hero = new Actor(this.hero_info, { anim: 'Idle' });
    this.hero.x = HERO_X; this.hero.y = HERO_FEET; this.hero.scale = 210 / this.hero_info.h;
    this.hero.tag = 'HERO'; this.hero.debugLog = true;
    console.log("HERO bbox h=" + this.hero_info.h.toFixed(1) + " w=" + this.hero_info.w.toFixed(1) + " by=" + this.hero_info.by.toFixed(1));
    this.reset();
  }

  // ---------- 静态背景（画一次，之后直接贴） ----------
  buildBackground() {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    // 1) 原版战场背景 bg1.png（苔藓草地 + 两侧灌木），直接铺满战场区
    const bgm = this.tex.bgfield;
    const bw = W, bh = WALL_Y + 40;
    const srcH = bgm.height * (bw / bgm.width);          // 按宽度裁出等比例高度
    const cropH = Math.min(bgm.height, srcH);
    c.drawImage(bgm, 0, bgm.height - cropH, bgm.width, cropH, 0, 0, bw, bh);

    // 2) 远端压暗，制造纵深
    const fog = c.createLinearGradient(0, 0, 0, WALL_Y * 0.55);
    fog.addColorStop(0, 'rgba(16,28,12,0.55)');
    fog.addColorStop(1, 'rgba(16,28,12,0)');
    c.fillStyle = fog; c.fillRect(0, 0, W, WALL_Y * 0.55);

    // 3) 左右两侧压暗，跟原版两侧灌木阴影一致
    const sideL = c.createLinearGradient(0, 0, 150, 0);
    sideL.addColorStop(0, 'rgba(8,18,8,0.75)');
    sideL.addColorStop(1, 'rgba(8,18,8,0)');
    c.fillStyle = sideL; c.fillRect(0, 0, 150, WALL_Y);
    const sideR = c.createLinearGradient(W, 0, W - 150, 0);
    sideR.addColorStop(0, 'rgba(8,18,8,0.75)');
    sideR.addColorStop(1, 'rgba(8,18,8,0)');
    c.fillStyle = sideR; c.fillRect(W - 150, 0, 150, WALL_Y);

    // 4) 城墙
    const cw = 900, ch = cw * this.tex.castle.height / this.tex.castle.width;
    c.drawImage(this.tex.castle, (W - cw) / 2, WALL_Y - 8, cw, ch);

    // 5) 城墙下方的暗部
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, WALL_Y + ch - 30, W, H - WALL_Y - ch + 30);
    return cv;
  }

  // ---------- 一局的重置 ----------
  reset() {
    this.stage = '1_3';
    this.wave = 1;
    this.waveCount = 5;
    this.enemies.length = 0;
    this.arrows.length = 0;
    this.floats.length = 0;
    this.coinPops.length = 0;
    this.coins = 0;
    this.castleHP = 561;
    this.castleMax = 561;
    this.heroHP = 500;
    this.heroMax = 500;
    this.spawnLeft = 5;
    this.spawnTimer = 0.8;
    this.kills = 0;
    this.skillCD = 0;
    this.state = 'play';
  }

  // ---------- 出怪 ----------
  spawnEnemy() {
    const info = this.enemy_pool[Math.floor(Math.random() * this.enemy_pool.length)];
    const a = new Actor(info, { anim: info.anims.includes('Move') ? 'Move' : 'Idle' });
    a.x = 130 + Math.random() * 460;
    a.y = SPAWN_Y + Math.random() * 40;
    a.stopY = STOP_Y - Math.random() * 40;
    a.base = 150 / info.h;
    a.tag = 'ENEMY-' + info.name; a.debugLog = true;
    a.scale = a.base;
    a.hp = 90 * Math.pow(1.22, this.wave - 1);
    a.maxHp = a.hp;
    a.speed = 26 + Math.random() * 8;
    a.flip = Math.random() < 0.5;
    a.dying = false;
    a.dead = false;
    this.enemies.push(a);
  }

  // ---------- 投射物 ----------
  shoot(target) {
    this.arrows.push({
      x: HERO_X + 6, y: HERO_FEET - 150,
      tx: target.x, ty: target.y - 40 * target.scale,
      target,
      speed: 460,
      rot: 0
    });
    this.hero.once(this.hero.info.anims.includes('Atk') ? 'Atk' : 'Attack_01', 'Idle');
    this.g.playSfx('sfx_shoot', 0.4);
  }

  hitTarget(arrow) {
    const e = arrow.target;
    if (!e || e.dead || e.dying) return;
    const crit = Math.random() < 0.12;
    let dmg = this.g.heroDamage * (crit ? 1.5 : 1);
    e.hp -= dmg;
    this.floats.push({ x: e.x, y: e.y - 60 * e.scale, v: Math.round(dmg), life: 0.75, crit });
    this.g.playSfx('sfx_hit', 0.25);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.dying = true;
    e.dieT = 0.7;
    if (e.info.anims.includes('Die')) e.state.setAnimation(0, 'Die', false);
    this.kills++;
    this.coinPops.push({ x: e.x, y: e.y - 30, t: 0 });
  }

  // ---------- 每帧逻辑 ----------
  update(dt) {
    this.time += dt;
    if (this.state !== 'play') return;
    const d = dt * this.speed;

    // 出怪
    if (this.spawnLeft > 0) {
      this.spawnTimer -= d;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnLeft--;
        this.spawnTimer = 1.1 + Math.random() * 0.5;
      }
    }

    // 敌人推进
    let alive = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(d);
      if (e.dying) {
        e.dieT -= d;
        e.alpha = Math.max(0, e.dieT / 0.7);
        if (e.dieT <= 0) { e.dead = true; }
        continue;
      }
      alive++;
      if (e.y < e.stopY) {
        e.y += e.speed * d;
        const t = (e.y - MIN_SCALE_Y) / (MAX_SCALE_Y - MIN_SCALE_Y);
        e.scale = e.base * lerp(0.62, 1.0, Math.max(0, Math.min(1, t)));
      } else {
        // 到墙了就砸墙
        e.atkT = (e.atkT || 0) - d;
        if (e.atkT <= 0) {
          e.atkT = 1.0;
          this.castleHP = Math.max(0, this.castleHP - 12);
          this.shake = 0.25;
          this.g.playSfx('sfx_hit', 0.3);
          if (this.castleHP <= 0) this.gameOver(false);
        }
        if (e.info.anims.includes('Attack_01')) e.state.setAnimation(0, 'Attack_01', false);
      }
    }

    // 英雄自动射击
    this.fireTimer = (this.fireTimer || 0) - d;
    if (this.fireTimer <= 0 && alive > 0) {
      const target = this.enemies.filter(e => !e.dead && !e.dying).sort((a, b) => b.y - a.y)[0];
      if (target) {
        this.shoot(target);
        this.fireTimer = 1 / this.g.heroAtkRate;
      }
    }

    // 箭矢
    for (const a of this.arrows) {
      if (a.dead) continue;
      const dx = a.tx - a.x, dy = a.ty - a.y;
      const dist = Math.hypot(dx, dy);
      a.rot = Math.atan2(dy, dx);
      if (dist < 26) { a.dead = true; this.hitTarget(a); continue; }
      const step = a.speed * d;
      a.x += dx / dist * step;
      a.y += dy / dist * step;
    }
    this.arrows = this.arrows.filter(a => !a.dead);

    // 飘字 / 金币飞
    for (const f of this.floats) { f.life -= d; f.y -= 42 * d; }
    this.floats = this.floats.filter(f => f.life > 0);
    for (const c of this.coinPops) {
      c.t += d;
      if (c.t > 0.75 && !c.counted) { c.counted = true; this.coins += 3; }
    }
    this.coinPops = this.coinPops.filter(c => c.t < 1.2);

    // 英雄动画 & 冷却
    this.hero.update(d);
    if (this.skillCD > 0) this.skillCD -= d;
    if (this.shake > 0) this.shake -= dt;

    // 波次推进
    if (this.spawnLeft === 0 && alive === 0) {
      if (this.dyingCount() === 0) {
        if (this.wave >= this.waveCount) { this.gameOver(true); }
        else {
          this.wave++;
          this.spawnLeft = 4 + this.wave;
          this.spawnTimer = 1.2;
        }
      }
    }
  }

  dyingCount() { return this.enemies.filter(e => e.dying && !e.dead).length; }

  gameOver(win) {
    this.state = 'over';
    this.winFlag = win;
    this.g.playSfx(win ? 'sfx_win' : 'sfx_lose', 0.6);
  }

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (this.state === 'title') { this.drawTitle(); return; }

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6);

    ctx.drawImage(this.bg, 0, 0);

    // 敌人（远的先画）
    const sorted = [...this.enemies].filter(e => !e.dead).sort((a, b) => a.y - b.y);
    for (const e of sorted) {
      e.draw(ctx, this.renderer);
      if (!e.dying) this.drawEnemyHP(e);
    }

    // 英雄
    this.hero.draw(ctx, this.renderer);
    if (this.g.debug) {
      const s = this.hero.scale, i = this.hero_info;
      ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2;
      ctx.strokeRect(HERO_X - i.w * s / 2, HERO_FEET - i.h * s, i.w * s, i.h * s);
      ctx.fillStyle = '#ff0'; ctx.font = '18px sans-serif';
      ctx.fillText('hero s=' + s.toFixed(2), 20, HERO_FEET - i.h * s);
    }

    // 箭
    for (const a of this.arrows) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot + Math.PI / 2);
      const s = 0.5;
      ctx.drawImage(this.tex.arrow, -this.tex.arrow.width * s / 2, -this.tex.arrow.height * s / 2,
        this.tex.arrow.width * s, this.tex.arrow.height * s);
      ctx.restore();
    }

    // 飘字
    for (const f of this.floats) {
      text(ctx, String(f.v), f.x, f.y, f.crit ? 34 : 26, '#ffffff', 'center', '#2a1200');
    }
    // 金币飞出
    for (const c of this.coinPops) {
      const t = Math.min(1, c.t / 0.75);
      const x = lerp(c.x, W - 42, t), y = lerp(c.y, 44, t * t);
      drawIcon(ctx, this.tex.gold, x, y, 0.45, 1 - t * 0.2);
    }
    ctx.restore();

    this.drawHud();

    if (this.state === 'pause') this.drawPause();
    if (this.state === 'over') this.drawResult();
  }

  drawEnemyHP(e) {
    const ctx = this.ctx;
    const w = 62 * e.scale, h = 7;
    const x = e.x - w / 2, y = e.y - (e.info.h * e.scale) - 14;
    ctx.fillStyle = 'rgba(10,10,10,0.85)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#e33a2c';
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
  }

  // ---------- HUD（对齐原版布局） ----------
  drawHud() {
    const ctx = this.ctx;
    // —— 顶部：Stage 条 + 城墙血条 ——
    const barY = 22, barH = 54, barX = 12, barW = W - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, barX - 4, barY - 4, barW + 8, barH + 8, 10, 'rgba(0,0,0,0.45)');

    // 左侧红色 Stage 段
    const redW = barW * 0.47;
    roundRect(ctx, barX, barY, redW, barH, 8, '#a8121b');
    // 右侧绿色血条
    const hpRatio = this.castleHP / this.castleMax;
    roundRect(ctx, barX + redW, barY, barW - redW, barH, 8, '#1d2a16');
    roundRect(ctx, barX + redW, barY, (barW - redW) * hpRatio, barH, 8, '#4b7d2a');

    text(ctx, 'Stage ' + this.stage, barX + 18, barY + barH / 2, 30, '#ffffff', 'left', '#5a1010');
    text(ctx, String(Math.round(this.castleHP)), barX + barW - 104, barY + barH / 2, 34, '#ffffff', 'right', '#243a14');

    // 四段推进小条
    const pipY = barY + barH + 10, pipH = 10, pipW = (barW - 24) / 4;
    for (let i = 0; i < 4; i++) {
      const fill = i < this.wave ? 1 : 0;
      roundRect(ctx, barX + 6 + i * (pipW + 6), pipY, pipW, pipH, 4,
        fill ? '#f0c23a' : '#22303f');
      if (i === 3) {   // 最后一段做成蓝色高亮，跟原版一致
        roundRect(ctx, barX + 6 + i * (pipW + 6), pipY, pipW, pipH, 4, '#2f6fb0');
      }
    }

    // 右上角金币
    drawIcon(ctx, this.tex.gold, W - 38, 30, 0.8);
    text(ctx, String(this.coins), W - 78, 30, 30, '#ffd45e', 'right', '#3a2500');

    // —— 底部操作栏 ——
    const by = H - 96;
    ctx.fillStyle = 'rgba(14,20,32,0.92)';
    ctx.fillRect(0, by, W, 96);
    ctx.fillStyle = 'rgba(90,130,190,0.5)';
    ctx.fillRect(0, by, W, 2);

    // 左一：武器（自动攻击开关示意）
    this.btn(ctx, 34, by + 48, 46, this.tex.sword, 0.36, '#2f7ad6');
    // 左二：技能
    this.btn(ctx, 108, by + 48, 46, this.tex.gem, 0.62, '#2f7ad6');

    // 中间：英雄血条
    const hx = 150, hw = W - 150 - 170, hy = by + 30, hh = 36;
    roundRect(ctx, hx, hy, hw, hh, 8, '#3a0c0c');
    roundRect(ctx, hx, hy, hw * (this.heroHP / this.heroMax), hh, 8, '#b3202a');
    text(ctx, String(Math.round(this.heroHP)), hx + hw / 2, hy + hh / 2, 26, '#fff', 'center', '#520a0a');

    // 右二：加速
    this.btn(ctx, W - 130, by + 48, 44, this.tex.speed, 0.55, '#2f7ad6');
    // 右一：暂停
    this.btn(ctx, W - 58, by + 48, 44, this.tex.pause, 0.55, '#c0272d');

    // 底部左侧技能方块（冷却圈）
    const sx = 22, sy = H - 210, ss = 74;
    roundRect(ctx, sx, sy, ss, ss, 10, 'rgba(10,20,14,0.78)', '#6f8f4a');
    drawIcon(ctx, this.tex.magic, sx + ss / 2, sy + ss / 2, 0.72, 1);
    if (this.skillCD > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const p = this.skillCD / 6;
      ctx.fillRect(sx, sy + ss * (1 - p), ss, ss * p);
    }
  }

  btn(ctx, cx, cy, r, img, scale, color) {
    roundRect(ctx, cx - r - 8, cy - r - 8, (r + 8) * 2, (r + 8) * 2, 10, color, '#0d1626', 3);
    drawIcon(ctx, img, cx, cy, scale);
  }

  drawTitle() {
    const ctx = this.ctx;
    ctx.drawImage(this.tex.splash, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    const pw = 300, ph = pw * this.tex.play.height / this.tex.play.width;
    ctx.drawImage(this.tex.play, (W - pw) / 2, H * 0.62, pw, ph);
    text(ctx, '点击开始（原美术重建）', W / 2, H * 0.62 + ph + 46, 22, '#dfe9f5', 'center', '#000');
  }

  drawPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    text(ctx, '已暂停', W / 2, H / 2 - 30, 44, '#fff', 'center', '#000');
    text(ctx, '点击继续', W / 2, H / 2 + 30, 24, '#cfd8e3', 'center', '#000');
  }

  drawResult() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, W, H);
    const img = this.winFlag ? this.tex.win : this.tex.lose;
    const iw = 520, ih = iw * img.height / img.width;
    ctx.drawImage(img, (W - iw) / 2, H * 0.28, iw, ih);
    text(ctx, this.winFlag ? '通关  ·  击杀 ' + this.kills + '  ·  金币 +' + this.coins
      : '城墙被攻破  ·  击杀 ' + this.kills, W / 2, H * 0.55, 24, '#fff', 'center', '#000');

    const bw = 260, bh = 74, bx = (W - bw) / 2, by = H * 0.63;
    roundRect(ctx, bx, by, bw, bh, 12, '#2f7ad6', '#8fc4ff', 2);
    text(ctx, '再来一局', W / 2, by + bh / 2, 28, '#fff', 'center', '#123');
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
      const bw = 260, bh = 74, bx = (W - bw) / 2, by = H * 0.63;
      if (p.x > bx && p.x < bx + bw && p.y > by && p.y < by + bh) { this.reset(); this.enemies.length = 0; }
      return;
    }
    if (this.state === 'pause') { this.state = 'play'; return; }
    const by = H - 96;
    // 暂停
    if (p.x > W - 100 && p.y > by) { this.state = 'pause'; return; }
    // 加速
    if (p.x > W - 172 && p.x <= W - 100 && p.y > by) { this.speed = this.speed === 1 ? 2 : 1; return; }
    // 技能方块
    if (p.x < 110 && p.y > H - 220 && p.y < H - 130 && this.skillCD <= 0) {
      this.castSkill();
      return;
    }
  }

  castSkill() {
    this.skillCD = 6;
    this.shake = 0.3;
    for (const e of this.enemies) {
      if (e.dead || e.dying) continue;
      const dmg = this.g.heroDamage * 1.2;
      e.hp -= dmg;
      this.floats.push({ x: e.x, y: e.y - 60 * e.scale, v: Math.round(dmg), life: 0.8 });
      if (e.hp <= 0) this.killEnemy(e);
    }
    this.g.playSfx('sfx_hit', 0.5);
  }
}





