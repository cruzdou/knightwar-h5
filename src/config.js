// ============================================================
//  可调参数区 —— 改玩法基本都在这个文件里
//  改完刷新浏览器即可，不需要重新打包
// ============================================================
window.CONFIG = {

  // 用 gameCharacters.json 里的哪个英雄（charID）：1=Mel 2=Maximus 3=Sam 4=Crimson
  heroCharID: 1,

  balance: {
    damageMult:      3.0,   // 英雄伤害倍率（原表 15 → 45）
    fireRateMult:    3.0,   // 攻速倍率（表中 atkRate 1.0 → 每秒 3 箭）
    rangePerUnit:    26,    // atkRange 每单位换算多少像素（20 → 800px）
    speedPerUnit:    12,    // 敌人 speed 每单位换算多少像素/秒
    hpMultPerWave:   1.22,  // 每波敌人血量递增
    castleHP:        1200,  // 城堡血量（漏怪就扣）
    coinMult:        1.0,   // 金币倍率
    critMult:        1.5    // 暴击伤害倍率
  },

  // 关卡节奏（原版波次在 Level_XX.json 里，这里用 ListAllLevel 的总量生成）
  level: {
    index:        0,     // 取 ListAllLevel.json 的第几关（0 起）
    waves:        5,     // 波数
    enemiesStart: 6,     // 第一波怪数
    enemiesStep:  3,     // 每波递增
    spawnGapMs:   800,   // 同波内出怪间隔
    waveGapMs:    1400   // 波与波之间间隔
  },

  // 资源路径（换美术就改这里，或者直接覆盖同名文件）
  art: {
    bg:        'assets/art/bg_battle.png',           // 1280x720 战场背景（自绘，可覆盖）
    ground:    'assets/art/ground_custom.png',       // 256x256 可平铺草皮
    castle:    'assets/art/castle_1.png',            // 1024x384 城堡
    hero:      'assets/char/hero_knight.png',        // 占位英雄（后续换皮覆盖即可）
    enemyA:    'assets/char/enemy_goblin.png',       // 小怪
    enemyB:    'assets/char/enemy_orc.png',          // 精英怪
    bullet:    'assets/art/bullet_arrow.png',        // 箭矢
    spark:     'assets/art/sparks.png',              // 命中火花
    coin:      'assets/art/icon_gold.png',           // 金币图标
    win:       'assets/art/victory.png',
    lose:      'assets/art/defeatbanner.png'
  },

  audio: {
    shoot: 'assets/audio/hero_01_attack_sfx_hero_01_attack_sfx.mp3',
    hit:   'assets/audio/beinghit_beinghit.mp3',
    coin:  'assets/audio/Coins ingame_Coins ingame.mp3',
    win:   'assets/audio/You Win_You Win.mp3',
    lose:  'assets/audio/You Lose_You Lose.mp3'
  },

  debug: {
    showFps: true,
    godMode: false      // true = 城堡不掉血，方便测玩法
  }
};


