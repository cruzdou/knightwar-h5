// ============================================================
//  入口：画布缩放、资源与数据加载、主循环、输入转发
// ============================================================
class Game {
  constructor() {
    this.cv = document.getElementById('game');
    this.ctx = this.cv.getContext('2d');
    this.cv.width = W;
    this.cv.height = H;
    this.audio = {};
    this.heroDamage = 15 * (window.CONFIG ? CONFIG.balance.damageMult : 3);
    this.heroAtkRate = 1 * (window.CONFIG ? CONFIG.balance.fireRateMult : 3);
    this.fit();
    window.addEventListener('resize', () => this.fit());

    this.cv.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      if (this.scene) this.scene.ptDown(this.scene.toLocal(ev));
    });
  }

  // 等比缩放铺满窗口（竖屏）
  fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    const cw = W * s, ch = H * s;
    this.cv.style.width = cw + 'px';
    this.cv.style.height = ch + 'px';
    this.cv.style.position = 'absolute';
    this.cv.style.left = ((vw - cw) / 2) + 'px';
    this.cv.style.top = ((vh - ch) / 2) + 'px';
  }

  async boot() {
    // 读原表里的英雄数值（以存档里选中的英雄为准）
    try {
      const chars = await fetch('data/gameCharacters.json').then(r => r.json());
      this.chars = chars.listCharacters;
      const cur = this.chars.find(c => c.charID === Player.charID) || this.chars[0];
      if (cur) {
        this.heroDamage = cur.damage * (window.CONFIG ? CONFIG.balance.damageMult : 3);
        this.heroAtkRate = cur.atkRate * (window.CONFIG ? CONFIG.balance.fireRateMult : 3);
      }
    } catch (e) { /* 数据缺失时用默认值 */ }

    // 装备/材料四张表 + itemID 索引（换装和战斗加成都要用）
    const files = {
      weapon: 'GameItemsWeapon.json', armor: 'GameItemsArmor.json',
      artifact: 'GameItemsArtifact.json', material: 'GameItemsMaterial.json'
    };
    this.itemTables = {};
    this.itemByID = {};
    for (const [k, f] of Object.entries(files)) {
      try {
        const d = await fetch('data/' + f).then(r => r.json());
        this.itemTables[k] = d.listItemModel || [];
      } catch (e) { this.itemTables[k] = []; }
      for (const it of this.itemTables[k]) this.itemByID[it.itemID] = it;
    }

    // 音频不再阻塞启动：后台并行拉取+解码，就绪前 playSfx 自动跳过
    this.loadAudio().catch(() => {});
    this.select = new LevelSelectScene(this);
    await this.select.init();
    this.battle = new BattleScene(this);
    await this.battle.init();
    this.scene = this.select;

    const qs = new URLSearchParams(location.search);
    this.debug = qs.get('debug') === '1';

    // ?tab=shop|craft|hero|castle 直接进功能页（验收用）
    if (qs.get('tab')) {
      await this.showTab(qs.get('tab'));
    }

    // ?auto=1 直接开一局（验收/快速试玩）；?stage=1-3 从指定关卡进
    if (qs.get('auto') === '1' || qs.get('stage')) {
      const want = qs.get('stage');
      const st = want ? this.select.levels.find(l => l.name === want)
                      : this.select.levels[this.select.levels.length - 1];
      this.startBattle(st || this.select.levels[0]);
      if (qs.get('over')) {
        this.battle.state = 'over';
        this.battle.winFlag = qs.get('over') === 'win';
        this.battle.kills = 18;
        this.battle.coins = 96;
      }
    }

    const boot = document.getElementById('boot');
    if (boot) { boot.classList.add('hide'); setTimeout(() => boot.remove(), 400); }

    let last = performance.now();
    const loop = t => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.scene.update(dt);
      this.scene.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  showSelect() {
    this.scene = this.select;
    this.audioUnlock();
  }

  // 单件装备在某等级下的实际属性（原包：base + (lv-1)*lvUpXxx）
  itemStats(it) {
    const lv = Player.lvOf(it.itemID);
    const g = (base, up) => (base || 0) + (lv - 1) * (up || 0);
    return {
      lv,
      damage: g(it.damage, it.lvUpDamage),
      armor: g(it.armorBulf, it.lvUpArmorBulf),
      blood: g(it.bloodBulf, it.lvUpBloodBulf),
      crit: g(it.crit, it.lvUpCrit),
      atkRange: g(it.atkRange, it.lvUpAtkRange),
      atkRate: g(it.atkRate, it.lvUpAtkRate),
      regain: g(it.regainBulf, it.lvUpRegainBulf)
    };
  }

  // 含装备加成的英雄最终数值（战斗 / 英雄页共用）
  heroStats(charID) {
    const chars = this.chars || [];
    const c = chars.find(x => x.charID === charID) || chars[0];
    const b = { damage: 0, armor: 0, blood: 0, crit: 0, atkRange: 0, atkRate: 0, regain: 0 };
    const eq = Player.equippedOf(charID);
    for (const slot of ['weapon', 'armor', 'artifact']) {
      const it = this.itemByID ? this.itemByID[eq[slot]] : null;
      if (!it) continue;
      const s = this.itemStats(it);
      b.damage += s.damage;
      b.armor += s.armor;
      b.blood += s.blood;
      b.crit += s.crit;
      b.atkRange += s.atkRange;
      b.atkRate += s.atkRate;
      b.regain += s.regain;
    }
    const c0 = c || {};
    return {
      char: c, bonus: b,
      damage: (c0.damage || 15) + b.damage,
      blood: (c0.blood || 1000) + b.blood,
      armor: (c0.armor || 0) + b.armor,
      crit: (c0.crit || 0) + b.crit,
      atkRange: (c0.atkRange || 0) + b.atkRange,
      atkRate: (c0.atkRate || 1) + b.atkRate,
      regain: (c0.regain || 0) + b.regain
    };
  }

  // 打开功能页（商店/锻造/英雄/城堡）：首次进入时初始化，之后复用
  async showTab(kind) {
    this.audioUnlock();
    if (!this.tabs) this.tabs = {};
    const s = this.tabs[kind] || new TabScene(this, kind);
    this.tabs[kind] = s;
    if (!s.ready) {
      const loading = document.getElementById('boot');
      if (loading) { loading.classList.remove('hide'); }
      await s.init();
      s.ready = true;
      if (loading) { loading.classList.add('hide'); }
    }
    this.scene = s;
    this.playSfx('sfx_tab', 0.3);
  }

  startBattle(stage) {
    this.battle.reset(stage);
    this.scene = this.battle;
    this.audioUnlock();
    this.playSfx('sfx_enter', 0.3);
    this.playSfx('sfx_footstep', 0.18);
  }

  async loadAudio() {    const files = {
      sfx_shoot: 'assets/audio/hero_01_attack_sfx_hero_01_attack_sfx.mp3',
      sfx_hit: 'assets/audio/beinghit_beinghit.mp3',
      sfx_coin: 'assets/audio/Coins ingame_Coins ingame.mp3',
      sfx_win: 'assets/audio/You Win_You Win.mp3',
      sfx_lose: 'assets/audio/You Lose_You Lose.mp3',
      // ---- 本轮补的 UI / 战斗音效（全部原包 WAV）----
      sfx_click: 'assets/audio/button_click_button_click.mp3',
      sfx_back: 'assets/audio/Back_Back.mp3',
      sfx_tab: 'assets/audio/Change_tab_Change_tab.mp3',
      sfx_close: 'assets/audio/Close_screen_sfx_Close_screen_sfx.mp3',
      sfx_buy: 'assets/audio/buy_buy.mp3',
      sfx_openbox: 'assets/audio/Open box_Open box.mp3',
      sfx_craft: 'assets/audio/craft_hit_sfx_craft_hit_sfx.mp3',
      sfx_levelup: 'assets/audio/Level up item_Level up item.mp3',
      sfx_equip: 'assets/audio/Equip_sfx_Equip_sfx.mp3',
      sfx_equipfail: 'assets/audio/Failed_Equip_sfx_Failed_Equip_sfx.mp3',
      sfx_claim: 'assets/audio/claim_item_claim_item.mp3',
      sfx_enter: 'assets/audio/Enter_game_Sfx_Enter_game_Sfx.mp3',
      sfx_footstep: 'assets/audio/foot_step_foot_step.mp3',
      sfx_wallstone: 'assets/audio/rock_impact_small_hit_01_rock_impact_small_hit_01.mp3',
      sfx_skill: 'assets/audio/skill 1_ 02_skill 1_ 02.mp3',
      sfx_blood: 'assets/audio/BloodExplosion_BloodExplosion.mp3',
      sfx_explosion: 'assets/audio/Explosion2_Explosion2.mp3',
      sfx_star: 'assets/audio/star_explore_star_explore.mp3',
      // 怪物死亡（按骨架名挑，见 battle.js 的 DIE_SFX）
      sfx_die_goblin: 'assets/audio/Goblin die_Goblin die.mp3',
      sfx_die_gnoll: 'assets/audio/Gnom die_Gnom die.mp3',
      sfx_die_orc: 'assets/audio/Orc die_Orc die.mp3',
      sfx_die_wolf: 'assets/audio/wolf die_wolf die.mp3',
      sfx_die_thorn: 'assets/audio/thorn die_thorn die.mp3',
      sfx_die_spider: 'assets/audio/Giant spider_Giant spider.mp3',
      sfx_die_lizard: 'assets/audio/lizard_rider die_lizard_rider die.mp3',
      sfx_die_snake: 'assets/audio/snake_die_snake_die.mp3'
    };
    this.actx = new (window.AudioContext || window.webkitAudioContext)();
    this.bufs = {};
    // 并行拉取，避免 30+ 个音效串行等待（线上首次加载的最大瓶颈）
    await Promise.all(Object.entries(files).map(async ([k, f]) => {
      try {
        const res = await fetch(f);
        if (!res.ok) return;
        this.audio[k] = await res.arrayBuffer();
      } catch (e) { /* 音频可选 */ }
    }));
    for (const [k, ab] of Object.entries(this.audio)) {
      try { this.bufs[k] = await this.actx.decodeAudioData(ab.slice(0)); } catch (e) {}
    }
  }

  audioUnlock() {
    if (this.actx && this.actx.state === 'suspended') this.actx.resume();
  }

  playSfx(key, vol) {
    if (!this.actx || !this.bufs[key] || this.actx.state !== 'running') return;
    const src = this.actx.createBufferSource();
    src.buffer = this.bufs[key];
    const gain = this.actx.createGain();
    gain.gain.value = vol === undefined ? 0.4 : vol;
    src.connect(gain).connect(this.actx.destination);
    src.start(0);
  }
}

const game = new Game();
window.game = game;   // 调试用：控制台里可以直接看 game.bufs / game.scene
game.boot().catch(err => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;right:0;background:#8b1b1b;color:#fff;padding:10px;font:13px monospace;z-index:99';
  d.textContent = '启动失败: ' + err.message + ' || ' + String(err.stack).slice(0, 500);
  document.body.appendChild(d);
});




