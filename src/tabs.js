// ============================================================
//  四个功能页：商店 / 锻造 / 英雄 / 城堡
//  数据全部读原包 data/*.json，贴图全部用 assets/art 里的原包素材
//  顶部资源条 + 底部五标签导航 与选关页共用 core.js 里的公共外框
// ============================================================

// 立绘用的骨架：只挂能完整渲染的（Elf_Archer 会糊成绿色团块，弃用）
const HERO_SKELETONS = { 1: 'Hero_04_Ingame', 2: 'Hero_04_Ingame', 3: 'Ice_Mage', 4: 'Hero_04_Ingame' };
const HERO_AVATARS = { 1: 'Avatar_h01.png', 2: 'Avatar_h02.png', 3: 'Avatar_h03.png', 4: 'avatar_hero4.png' };

// 神器图标（原包 common_item_* 小图，按 itemID 指定）
const ARTIFACT_ICONS = {
  409: 'common_item_life.png', 401: 'common_item_ring.png', 402: 'common_item_ring.png',
  403: 'common_item_ring.png', 404: 'common_item_skull.png', 405: 'common_item_crown.png',
  406: 'common_item_staff.png', 407: 'common_item_ring.png', 408: 'common_item_ring.png'
};

// 武器图标：原包按职业分三套（H01 剑 / H02 弓 / H03 杖），手里拿的那张 140×360 大图就是唯一可用的图标
const pad2 = n => (n < 10 ? '0' + n : '' + n);
const WEAPON_ART = [];
for (let cls = 1; cls <= 3; cls++) {
  for (let n = 1; n <= 9; n++) WEAPON_ART.push('H0' + cls + '-W_H0' + cls + '_' + pad2(n) + '.png');
}
WEAPON_ART.push('W_H01_00.png', 'W_H02_00.png', 'W_H03_01.png');

// 材料图标：原包只有零星几张带真名的（06_Cloth / 07_Steel / 12_Flint / 25_MoonlightTear / 28_FlamedStone）
const MATERIAL_NAMED = ['06_Cloth.png', '06_Cloth_1.png', '07_Steel.png', '12_Flint.png',
  '25_MoonlightTear.png', '28_FlamedStone.png'];

// 装备/材料图标（锻造页与英雄页共用）
const ITEM_ICONS = [
  'item_w_1_01.png', 'item_w_1_02.png', 'item_w_1_03.png', 'item_w_1_04.png',
  'item_w_1_05.png', 'item_w_1_06.png', 'item_w_1_07.png', 'item_w_1_08.png',
  'item_w_1_09.png', 'item_a_1_01.png', 'item_a_1_02.png', 'item_a_1_03.png',
  'item_a_1_04.png', 'item_a_1_05.png', 'item_a_1_06.png', 'item_a_1_07.png',
  'item_a_1_08.png', 'item_a_1_09.png', 'item_a_2_01.png', 'item_a_2_02.png',
  'item_a_2_03.png', 'item_a_2_04.png', 'item_a_2_05.png', 'item_a_2_06.png',
  'item_a_2_07.png', 'item_a_2_08.png', 'item_a_2_09.png',
  'item_misc_01.png', 'item_misc_02.png', 'item_misc_03.png', 'item_misc_04.png',
  'item_misc_05.png', 'item_misc_06.png', 'item_misc_07.png', 'item_misc_08.png',
  'item_misc_09.png', 'item_misc_10.png'
];

class TabScene {
  constructor(game, kind) {
    this.g = game;
    this.ctx = game.ctx;
    this.kind = kind;
    this.time = 0;
    this.hot = [];
    this.toast = '';
    this.toastT = 0;
    this.cat = 0;
    this.itemPage = 0;
    this.castlePage = 0;
    this.hero = null;
    this.renderer = new SP.canvas.SkeletonRenderer(this.ctx);
    this.actor = null;
    this.heroCache = {};
    this.chestResult = null;   // 开箱结果浮层
  }

  async init() {
    const t = {};
    const base = {
      coin: 'UI_cur_coin.png', gem: 'UI_cur_gem.png', stamina: 'UI_cur_stamina.png',
      plus: 'UI2_icon_plus.png', ribbon: 'result_title_ribbon.png',
      btnY: 'common_btn_yellow.png', btnB: 'common_btn_blue.png',
      star: 'result_star.png', starDim: 'result_star_dim.png',
      navShop: 'UI_navibar_shop.png', navCraft: 'UI_navibar_craft.png',
      navFight: 'UI_navibar_fight.png', navHero: 'UI_navibar_hero.png',
      navCastle: 'UI_navibar_castle.png',
      chest: 'common_item_chest.png', crown: 'common_item_crown.png',
      anvil: 'common_item_anvil.png', book: 'common_item_book_skill.png',
      sword: 'common_item_sword.png', shield: 'common_item_shield.png',
      ring: 'common_item_ring.png', potion: 'common_item_potionGreen.png',
      'common_item_ring.png': 'common_item_ring.png', 'common_item_life.png': 'common_item_life.png',
      'common_item_skull.png': 'common_item_skull.png', 'common_item_staff.png': 'common_item_staff.png',
      'common_item_crown.png': 'common_item_crown.png', 'common_item_book_skill.png': 'common_item_book_skill.png',
      castleArt: 'castle_avatar_1.png', wall: 'castle_1.png',
      arrowBack: 'btn_icon_arrow_back.png',
      border: 'Hero_border.png', borderSel: 'Hero_border_select.png', foundation: 'Hero_foundation.png'
    };
    Object.assign(t, base);

    const extra = {
      shop: ['shop_img_chest_0.png', 'shop_img_chest_1.png', 'shop_img_chest_2.png',
             'shop_img_chest_3.png', 'shop_img_chest_4.png', 'shop_pack_gem_6.png',
             'shop_ribbon_1.png', 'shop_ribbon_2.png', 'shop_ribbon_3.png'],
      craft: ITEM_ICONS.concat(WEAPON_ART, MATERIAL_NAMED),
      hero: ['Avatar_h01.png', 'Avatar_h02.png', 'Avatar_h03.png', 'avatar_hero4.png']
        .concat(ITEM_ICONS, WEAPON_ART, MATERIAL_NAMED),
      castle: ['castle_avatar_1.png', 'castle_1.png', 'castle_1_1.png', 'icon_progress_castle.png']
    }[this.kind] || [];

    for (const [k, f] of Object.entries(base)) {
      try { t[k] = await loadImage(f); } catch (e) { t[k] = null; }
    }
    for (const f of extra) {
      try { t[f] = await loadImage(f); } catch (e) { t[f] = null; }
    }
    this.tex = t;
    this.items = await this.loadItems();
  }

  async loadItems() {
    const get = async f => {
      try { return await fetch('data/' + f).then(r => r.json()); } catch (e) { return null; }
    };
    const out = { weapon: [], armor: [], artifact: [], material: [], chars: [], castle: null };
    const w = await get('GameItemsWeapon.json');
    if (w) out.weapon = w.listItemModel;
    const a = await get('GameItemsArmor.json');
    if (a) out.armor = a.listItemModel;
    const ar = await get('GameItemsArtifact.json');
    if (ar) out.artifact = ar.listItemModel;
    const m = await get('GameItemsMaterial.json');
    if (m) out.material = m.listItemModel;
    const c = await get('gameCharacters.json');
    if (c) out.chars = c.listCharacters;
    const ca = await get('gameCastle.json');
    if (ca && ca.listCastle) out.castle = ca.listCastle[0];
    // 四张配方表（原包 game_craft_*_recipe.json）：craftId 就是产出的 itemID
    out.recipes = { weapon: {}, armor: {}, artifact: {}, material: {} };
    for (const key of ['weapon', 'armor', 'artifact', 'material']) {
      const r = await get('game_craft_' + key + '_recipe.json');
      if (r && r.listCraftModel) {
        for (const it of r.listCraftModel) out.recipes[key][it.craftId] = it;
      }
    }
    return out;
  }

  // ---------- 图标映射（原包 item_* 贴图） ----------
  iconOf(cat, i, item) {
    if (cat === 'weapon') {
      // 27 件 = 3 个职业 × 9 级：剑/弓/杖分别对应 H01/H02/H03 的原画大图；剑系缺图时退回 item_w 系列
      const cls = Math.floor(i / 9), n = pad2((i % 9) + 1);
      const raw = 'H0' + (cls + 1) + '-W_H0' + (cls + 1) + '_' + n + '.png';
      if (this.tex[raw]) return raw;
      const small = 'item_w_1_' + n + '.png';
      if (this.tex[small]) return small;
      return 'W_H0' + (cls + 1) + '_0' + (cls === 0 ? '0' : '1') + '.png';
    }
    if (cat === 'armor') {
      // 27 件 = 3 个职业 × 9 级，原包刚好有 item_a_1..3_01..09 共 27 张，一一对应
      return 'item_a_' + (1 + Math.floor(i / 9)) + '_' + pad2((i % 9) + 1) + '.png';
    }
    if (cat === 'material') {
      // 先用原表 spritePath 的真名（01_Iron / 06_Cloth …），没导出图就用 item_misc 轮换
      const sp = item && item.spritePath ? String(item.spritePath).split('/').pop() : '';
      if (sp && this.tex[sp]) return sp;
      return 'item_misc_' + pad2((i % 10) + 1) + '.png';
    }
    if (cat === 'artifact') {
      const m = item && ARTIFACT_ICONS[item.itemID];
      return m || 'common_item_book_skill.png';
    }
    return 'common_item_book_skill.png';
  }

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1018');
    g.addColorStop(0.5, '#0d1520');
    g.addColorStop(1, '#070b11');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    this.hot.length = 0;
    drawTopBar(ctx, this.tex, Player, this.hot);
    this['draw_' + this.kind]();
    drawBottomNav(ctx, this.tex, this.kind, this.hot);
    drawToast(ctx, this.toast, this.toastT);
  }

  title(txt, sub) {
    const ctx = this.ctx, x = 12, y = 84;
    roundRect(ctx, x, y, W - 24, 52, 9, '#141d29', '#6d5a2c', 2);
    text(ctx, txt, x + 16, y + 26, 20, '#ffe9a8', 'left', '#20160a');
    if (sub) text(ctx, sub, W - 28, y + 26, 13, '#8fa3b7', 'right');
  }

  // ================= 商店 =================
  // 6 个真实宝箱（TreasureBox.json 的 id 1/2/3/4 装备箱 + 10/11 盟友箱）
  shopChests() {
    const ids = [1, 2, 3, 4, 10, 11];
    const arts = { 1: 'shop_img_chest_0.png', 2: 'shop_img_chest_1.png', 3: 'shop_img_chest_2.png',
      4: 'shop_img_chest_3.png', 10: 'shop_img_chest_4.png', 11: 'shop_img_chest_4.png' };
    const boxes = (window.Chest && Chest.list) ? Chest.list : [];
    return ids.map(id => boxes.find(b => b.id === id)).filter(Boolean).map(b => ({
      box: b, id: b.id, name: b.name, art: arts[b.id] || 'shop_img_chest_0.png'
    }));
  }

  draw_shop() {
    const ctx = this.ctx;
    const tickets = Player.raidTicketTotal();
    this.title('商店  SHOP', '广告剩余 ' + Ads.remaining() + '/' + Ads.dailyMax + ' 次 · Raid 票 ' + tickets);

    const products = this.shopChests();
    const cw = (W - 24 - 10) / 2, ch = 246, gap = 10;
    const x0 = 12, y0 = 146;
    products.forEach((p, i) => {
      const x = x0 + (i % 2) * (cw + gap);
      const y = y0 + Math.floor(i / 2) * (ch + gap);
      roundRect(ctx, x, y, cw, ch, 10, '#141d29', '#33475e', 2);
      const lg = ctx.createLinearGradient(x, y, x, y + ch);
      lg.addColorStop(0, 'rgba(255,210,120,0.10)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      roundRect(ctx, x + 1, y + 1, cw - 2, ch - 2, 9, lg);

      const img = this.tex[p.art];
      if (img) {
        const hh = 92, ww = Math.min(cw - 60, hh * img.width / img.height);
        ctx.drawImage(img, x + (cw - ww) / 2, y + 8, ww, hh);
      }
      const top = Chest.topRarity(p.box);
      const topC = Chest.rarityColor(
        top === '传说' ? 'super' : top === '史诗' ? 'hard' : top === '稀有' ? 'medium' : 'normal');
      roundRect(ctx, x + 10, y + 10, 74, 20, 5, 'rgba(0,0,0,0.55)', topC, 1);
      text(ctx, '可出' + top, x + 47, y + 20, 11, topC, 'center');

      text(ctx, p.name, x + cw / 2, y + 120, 16, '#e8eef6', 'center', '#0a1018');
      // 内容小字：装备箱 3 槽 / 盟友箱是盟友卡
      const isAlly = p.id === 10 || p.id === 11;
      text(ctx, isAlly ? '盟友卡 x3 · 重复转升级' : '3 槽随机装备 · 重复转强化',
        x + cw / 2, y + 142, 12, '#8fa3b7', 'center');

      const pr = Chest.price(p.box, 1);
      const ic = this.tex[pr.cur === 'gem' ? 'gem' : 'coin'];
      drawIcon(ctx, ic, x + cw / 2 - 30, y + 166, 0.5);
      text(ctx, String(pr.v), x + cw / 2 - 12, y + 166, 18, '#ffe9a8', 'left', '#20160a');
      // 10 连小按钮（价格取 x10）
      const pr10 = Chest.price(p.box, 10);
      if (pr10.v > 0) {
        const bw10 = 78, bh10 = 26, bx10 = x + cw - bw10 - 8, by10 = y + 154;
        roundRect(ctx, bx10, by10, bw10, bh10, 6, '#243448', '#4a7fb5', 1);
        text(ctx, '10× ' + pr10.v + (pr10.cur === 'coin' ? '金' : '宝'), bx10 + bw10 / 2, by10 + bh10 / 2, 11, '#9fd0ff', 'center');
        this.hot.push({ x: bx10, y: by10, w: bw10, h: bh10, act: 'buyChest', id: p.id, n: 10 });
      }

      const bw = cw - 40, bh = 42, bx = x + 20, by = y + ch - 50;
      if (this.tex.btnY) ctx.drawImage(this.tex.btnY, bx, by, bw, bh);
      else roundRect(ctx, bx, by, bw, bh, 8, '#e0a52a');
      text(ctx, 'OPEN', bx + bw / 2, by + bh / 2, 17, '#fff', 'center', '#1a1206');
      this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'buyChest', id: p.id, n: 1 });
    });

    // 广告 / 内购 横向四格
    const ads = [
      { act: 'ad_coin', art: 'coin', t1: '看广告', t2: '+600 金币', btn: '领取' },
      { act: 'ad_gem', art: 'gem', t1: '看广告', t2: '+8 宝石', btn: '领取' },
      { act: 'ad_chest', art: 'shop_img_chest_0.png', t1: '看广告', t2: '免费铜箱', btn: '开箱' },
      { act: 'iap', art: 'shop_pack_gem_6.png', t1: '内购位', t2: '首充礼包 ¥6', btn: '购买' }
    ];
    const aw = (W - 24 - 3 * 8) / 4, ay = 932, ah = 158;
    text(ctx, '广告 / 内购位（' + (Ads.hasRealSdk() ? '已接 SDK' : '模拟播放，未接 SDK') + '）', 14, ay - 12, 13, '#8fa3b7', 'left');
    ads.forEach((p, i) => {
      const x = 12 + i * (aw + 8);
      const off = p.act === 'iap' || Ads.remaining() > 0;
      roundRect(ctx, x, ay, aw, ah, 10, '#141d29', off ? '#3f6a8f' : '#2a3543', 2);
      const img = this.tex[p.art];
      if (img) {
        const hh = 52, ww = Math.min(aw - 24, hh * img.width / img.height);
        ctx.drawImage(img, x + (aw - ww) / 2, ay + 8, ww, hh);
      }
      text(ctx, p.t1, x + aw / 2, ay + 74, 13, '#9fb2c6', 'center');
      text(ctx, p.t2, x + aw / 2, ay + 94, 14, '#ffe9a8', 'center');
      const bw = aw - 20, bh = 34, bx = x + 10, by = ay + ah - 42;
      roundRect(ctx, bx, by, bw, bh, 8, off ? '#e0a52a' : '#3a4654', off ? '#ffdf9a' : '#4a5a70', 1);
      text(ctx, p.act === 'iap' ? (IAP.hasRealSdk() ? p.btn : '未接支付') : (Ads.remaining() > 0 ? p.btn : '今日已用完'),
        bx + bw / 2, by + bh / 2, 13, off ? '#fff' : '#9fb2c6', 'center', '#1a1206');
      this.hot.push({ x: bx, y: by, w: bw, h: bh, act: p.act });
    });

    if (this.chestResult) this.drawChestResult();
  }

  // 开箱结果浮层（全屏点击关闭）
  drawChestResult() {
    const ctx = this.ctx;
    const res = this.chestResult;
    ctx.fillStyle = 'rgba(4,8,12,0.82)';
    ctx.fillRect(0, 0, W, H);

    // 合并同名奖励：label → {n, rarity}
    const map = new Map();
    for (const r of res.rewards) {
      const k = r.label;
      if (map.has(k)) map.get(k).n++;
      else map.set(k, { n: 1, rarity: r.rarity });
    }
    const rows = Array.from(map.entries()).map(([label, v]) => ({ label, ...v }));
    const show = rows.slice(0, 10);
    const ph = 210 + show.length * 34 + (rows.length > 10 ? 26 : 0);
    const pw = 640, px = (W - pw) / 2, py = (H - ph) / 2;

    roundRect(ctx, px, py, pw, ph, 14, '#101a26', '#5a7ea6', 2);
    text(ctx, res.boxName, W / 2, py + 40, 22, '#ffe9a8', 'center', '#000');
    text(ctx, '×' + res.count + ' · 共 ' + res.rewards.length + ' 件', W / 2, py + 68, 14, '#8fa3b7', 'center');

    show.forEach((r, i) => {
      const ry = py + 96 + i * 34;
      roundRect(ctx, px + 24, ry, pw - 48, 28, 6, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)', 1);
      ctx.beginPath();
      ctx.arc(px + 44, ry + 14, 6, 0, Math.PI * 2);
      ctx.fillStyle = Chest.rarityColor(r.rarity);
      ctx.fill();
      text(ctx, Chest.rarityLabel(r.rarity), px + 58, ry + 14, 12, Chest.rarityColor(r.rarity), 'left');
      text(ctx, r.label + (r.n > 1 ? ' x' + r.n : '').slice(0, 30), px + 116, ry + 14, 14, '#e8eef6', 'left');
    });
    if (rows.length > 10) text(ctx, '… 还有 ' + (rows.length - 10) + ' 种奖励', W / 2, py + 96 + 10 * 34 + 14, 12, '#8fa3b7', 'center');

    const tk = Object.keys(res.tickets || {}).filter(k => res.tickets[k] > 0);
    const tkTxt = tk.length ? 'Raid 票：' + tk.map(k => k + ' x' + res.tickets[k]).join('、') : '';
    if (tkTxt) text(ctx, tkTxt, W / 2, py + ph - 86, 15, '#ffcf5c', 'center', '#000');

    const bw = 220, bh = 48, bx = W / 2 - bw / 2, by = py + ph - 62;
    roundRect(ctx, bx, by, bw, bh, 10, '#2f7ad6', '#8fc4ff', 2);
    text(ctx, '收下（点击任意处）', W / 2, by + bh / 2, 16, '#fff', 'center');
  }

  // ================= 锻造 =================
  draw_craft() {
    const ctx = this.ctx;
    this.title('锻造  FORGE', '材料表来自 GameItemsMaterial.json');

    const cats = [
      { key: 'weapon', lbl: '武器' },
      { key: 'armor', lbl: '护甲' },
      { key: 'artifact', lbl: '神器' },
      { key: 'material', lbl: '材料' }
    ];
    const tw = (W - 24 - 3 * 8) / 4;
    cats.forEach((c, i) => {
      const x = 12 + i * (tw + 8), y = 148;
      const on = i === this.cat;
      roundRect(ctx, x, y, tw, 48, 8, on ? '#2c4a70' : '#16202d', on ? '#7fc6ff' : '#33475e', 2);
      text(ctx, c.lbl, x + tw / 2, y + 24, 17, on ? '#ffffff' : '#9fb2c6', 'center');
      this.hot.push({ x, y, w: tw, h: 48, act: 'cat', idx: i });
    });

    const cat = cats[this.cat].key;
    const list = this.items[cat] || [];
    const per = 5;
    const start = this.itemPage * per;
    const rows = list.slice(start, start + per);
    let y = 212;
    const rh = 168;

    rows.forEach((it, i) => {
      const x = 12, w = W - 24;
      roundRect(ctx, x, y, w, rh - 12, 9, '#141d29', '#33475e', 2);
      // 图标格
      roundRect(ctx, x + 12, y + 12, 96, 96, 8, '#0d141c', '#2a3644', 1);
      const iconName = this.iconOf(cat, start + i, list[start + i]);
      const img = this.tex[iconName];
      if (img) {
        const s = Math.min(80 / img.width, 80 / img.height);
        ctx.drawImage(img, x + 60 - img.width * s / 2, y + 60 - img.height * s / 2, img.width * s, img.height * s);
      }
      // 图标已按 spritePath / 职业系列精确映射，不再需要 T1/T2/T3 角标区分
      // 名称 / 强化等级 / 当前主属性（属性按强化等级换算）
      const lv = cat === 'material' ? (it.level || 1) : Player.lvOf(it.itemID);
      const maxLv = it.maxLevelUpgrade || 10;
      const st = cat === 'material' ? null : this.g.itemStats(it);
      const recipe = (this.items.recipes && this.items.recipes[cat] && this.items.recipes[cat][it.itemID]) || null;
      const owns = cat === 'material' ? true : Player.hasItem(it.itemID);
      text(ctx, it.name, x + 124, y + 32, 19, '#e8eef6', 'left');
      text(ctx, cat === 'material' ? '' : (owns ? 'Lv ' + lv + ' / ' + maxLv : '未打造'),
        x + 124, y + 60, 13, owns ? '#9fb2c6' : '#c98a5a', 'left');
      let stat;
      if (cat === 'material') stat = '拥有 x' + Player.matOf(it.itemID);
      else if (cat === 'weapon') stat = '伤害 ' + Math.round(st.damage);
      else if (cat === 'armor') stat = '护甲 +' + Math.round(st.armor) + ' · 血量 +' + Math.round(st.blood);
      else stat = '血量 +' + Math.round(st.blood) + ' · 回复 +' + (Math.round(st.regain * 10) / 10);
      text(ctx, stat, x + 124, y + 84, 14, '#ffe9a8', 'left');

      // 配方需求行（材料名 + 数量，不足标红）；已打造的装备不再占位显示
      if (recipe && recipe.listCraftItems && recipe.listCraftItems.length && (cat === 'material' || !owns)) {
        const need = recipe.listCraftItems.map(x => {
          const nm = this.matName(x.itemId);
          const ok = Player.matOf(x.itemId) >= x.numbItem;
          return { txt: nm + ' x' + x.numbItem, ok };
        });
        let dx = x + 124;
        for (const n of need) {
          text(ctx, n.txt, dx, y + 108, 12, n.ok ? '#8ed6a0' : '#e08a8a', 'left');
          dx += ctx.measureText(n.txt).width + 12;
        }
      } else if (it.description) {
        text(ctx, String(it.description).slice(0, 26), x + 124, y + 108, 11, '#7f93a8', 'left');
      }

      const bw = 120, bh = 44, bx = x + w - bw - 14;
      if (cat === 'material') {
        if (recipe) {
          const byC = y + 18;
          const can = Player.canSpendMats(recipe.listCraftItems);
          roundRect(ctx, bx, byC, bw, bh, 8, can ? '#2f6fb0' : '#3a4654', can ? '#8fc4ff' : '#4a5a70', 2);
          text(ctx, can ? '合成' : '材料不足', bx + bw / 2, byC + bh / 2, 14, can ? '#fff' : '#9fb2c6', 'center', '#0c1016');
          this.hot.push({ x: bx, y: byC, w: bw, h: bh, act: 'craft', recipe, cat });
        } else {
          text(ctx, '材料不可装备', bx + bw / 2, y + 60, 12, '#6f8398', 'center');
        }
      } else if (!owns) {
        // 未打造：只有一个「打造」按钮，材料够了才能点
        const byU = y + 18;
        const can = recipe && Player.canSpendMats(recipe.listCraftItems || []);
        roundRect(ctx, bx, byU, bw, bh, 8, can ? '#c58a1c' : '#3a4654', can ? '#ffdf9a' : '#4a5a70', 2);
        text(ctx, can ? '打造' : '材料不足', bx + bw / 2, byU + bh / 2, 15, can ? '#fff' : '#9fb2c6', 'center', '#1a1206');
        if (can) this.hot.push({ x: bx, y: byU, w: bw, h: bh, act: 'craft', recipe, cat, item: it });
        text(ctx, '打造后可强化 / 穿戴', bx + bw / 2, y + 82, 11, '#6f8398', 'center');
      } else {
        // 升级（满级 / 无升级配置时按钮变灰）
        const byU = y + 18;
        const cost = it.lvUpGold || 0;
        const full = lv >= maxLv;
        const noUp = !cost;
        if (this.tex.btnB && !full && !noUp) ctx.drawImage(this.tex.btnB, bx, byU, bw, bh);
        else roundRect(ctx, bx, byU, bw, bh, 8, (full || noUp) ? '#3a4654' : '#2f6fb0');
        text(ctx, full ? '已满级' : (noUp ? '不可强化' : ('升级 ' + cost)), bx + bw / 2, byU + bh / 2, 15, '#fff', 'center', '#0c1016');
        if (!full && !noUp) this.hot.push({ x: bx, y: byU, w: bw, h: bh, act: 'upgrade', item: it, cat });

        // 装备 / 已装备
        const byE = y + 72;
        const slot = cat;                       // weapon / armor / artifact 与装备格同名
        const on = Player.equippedOf(Player.charID)[slot] === it.itemID;
        if (this.tex.btnY && !on) ctx.drawImage(this.tex.btnY, bx, byE, bw, bh);
        else roundRect(ctx, bx, byE, bw, bh, 8, on ? '#3f6b45' : '#e0a52a', on ? '#8ed6a0' : null, 2);
        text(ctx, on ? '已装备' : '装备', bx + bw / 2, byE + bh / 2, 15, '#fff', 'center', '#1a1206');
        this.hot.push({ x: bx, y: byE, w: bw, h: bh, act: 'equip', item: it, slot });
      }
      y += rh;
    });

    if (list.length > per) {
      const py = y + 12;
      const onPrev = this.itemPage > 0;
      const onNext = this.itemPage < Math.ceil(list.length / per) - 1;
      if (onPrev) this.hot.push({ x: 12, y: py - 20, w: 80, h: 40, act: 'itemPrev' });
      if (onNext) this.hot.push({ x: W - 92, y: py - 20, w: 80, h: 40, act: 'itemNext' });
      roundRect(ctx, W / 2 - 40, py - 20, 80, 40, 8, '#16202d', '#33475e', 1);
      text(ctx, (this.itemPage + 1) + '/' + Math.ceil(list.length / per), W / 2, py, 14, '#9fb2c6', 'center');
      if (onPrev) text(ctx, '◀', 46, py, 20, '#7fc6ff', 'center');
      if (onNext) text(ctx, '▶', W - 52, py, 20, '#7fc6ff', 'center');
    }
  }

  // ================= 英雄 =================
  draw_hero() {
    const ctx = this.ctx;
    this.title('英雄  HEROES', '角色数值来自 gameCharacters.json');

    const chars = this.items.chars || [];
    this.fillHero(chars);

    // 主图面板：优先用原包立绘（高清 Upgrade 骨架运行时渲染不全，改用游戏内头像放大）
    const px = 12, py = 148, pw = 420, ph = 470;
    roundRect(ctx, px, py, pw, ph, 12, '#0d141c', '#6d5a2c', 2);
    ctx.save();
    roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 10, null, null, 0);
    ctx.clip();
    {
      // 背景光晕
      const g = ctx.createRadialGradient(px + pw / 2, py + ph * 0.42, 10, px + pw / 2, py + ph * 0.42, pw * 0.62);
      g.addColorStop(0, 'rgba(90,140,190,0.30)');
      g.addColorStop(1, 'rgba(10,16,24,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
    }
    const av = this.hero && this.tex[HERO_AVATARS[this.hero.charID]];
    if (av) {
      const hh = 330, ww = hh * av.width / av.height;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(av, px + (pw - ww) / 2, py + (ph - hh) / 2 - 30, ww, hh);
    } else if (this.actor) {
      this.actor.draw(ctx, this.renderer);
    } else {
      text(ctx, '立绘未导出', px + pw / 2, py + ph / 2, 16, '#7f93a8', 'center');
    }
    ctx.restore();
    if (this.hero) {
      text(ctx, this.hero.name, px + pw / 2, py + ph - 52, 22, '#ffe9a8', 'center', '#20160a');
      text(ctx, this.hero.description || '', px + pw / 2, py + ph - 24, 12, '#9fb2c6', 'center');
    }

    // 右侧头像栏
    const ax = px + pw + 12, aw = W - ax - 12;
    chars.forEach((c, i) => {
      const y = py + i * 120;
      const on = this.hero && this.hero.charID === c.charID;
      roundRect(ctx, ax, y, aw, 110, 9, on ? '#1d2b3d' : '#141d29', on ? '#7fc6ff' : '#33475e', 2);
      const av = this.tex[HERO_AVATARS[c.charID]];
      if (av) {
        const hh = 78, ww = hh * av.width / av.height;
        ctx.drawImage(av, ax + (aw - ww) / 2, y + 6, ww, hh);
      } else drawIcon(ctx, this.tex.crown, ax + aw / 2, y + 44, 0.44);
      text(ctx, c.name, ax + aw / 2, y + 94, 14, on ? '#ffffff' : '#c9d6e2', 'center', '#0a1018');
      this.hot.push({ x: ax, y, w: aw, h: 110, act: 'char', char: c });
    });

    // 属性表（含装备加成，全部在面板内）
    const sx = 12, sy = py + ph + 12, sw = W - 24, sh = 296;
    roundRect(ctx, sx, sy, sw, sh, 10, '#141d29', '#33475e', 2);
    if (this.hero) {
      const h = this.hero;
      const t = this.g.heroStats ? this.g.heroStats(h.charID) : null;
      const bonus = t ? t.bonus : { damage: 0, armor: 0, blood: 0, crit: 0, atkRange: 0, atkRate: 0, regain: 0 };
      const fm = n => (n > 0 ? ' +' + Math.round(n) : '');
      const rows = [
        ['伤害', Math.round(t ? t.damage : h.damage), fm(bonus.damage), '攻速', (t ? t.atkRate : (h.atkRate || 1)).toFixed(2) + '/s', fm(bonus.atkRate)],
        ['血量', Math.round(t ? t.blood : h.blood), fm(bonus.blood), '暴击', Math.round(t ? t.crit : h.crit) + '%', fm(bonus.crit)],
        ['护甲', Math.round(t ? t.armor : (h.armor || 0)), fm(bonus.armor), '射程', Math.round(t ? t.atkRange : (h.atkRange || 0)), fm(bonus.atkRange)],
        ['回复', Math.round(t ? t.regain : (h.regain || 0)), fm(bonus.regain), '等级', 'Lv ' + (h.level || 1) + '/' + (h.levelMax || 10), '']
      ];
      rows.forEach((r, i) => {
        const y = sy + 32 + i * 44;
        const lx = sx + 22, rx = sx + sw / 2 + 12;
        text(ctx, r[0], lx, y, 14, '#8fa3b7', 'left');
        text(ctx, String(r[1]), lx + 66, y, 19, '#ffe9a8', 'left');
        if (r[2]) text(ctx, r[2], lx + 66 + String(r[1]).length * 12 + 4, y, 12, '#7ce08a', 'left');
        text(ctx, r[3], rx, y, 14, '#8fa3b7', 'left');
        // 等级行：显示训练等级 + 「训练」按钮（花金币升级，战斗里真实生效）
        if (r[3] === '等级') {
          // 等级上限取当前进化阶的 maxLevel（英雄进化会抬高上限）
          const hLv = Player.heroLvOf(h.charID), lvMax = (t && t.levelMax) || h.levelMax || 10;
          text(ctx, 'Lv ' + hLv + '/' + lvMax, rx + 48, y, 17, '#ffe9a8', 'left');
          const evo = (t && t.evo) || 1, evoMax = (t && t.evoMax) || ((h.evolutionList || []).length || 1);
          text(ctx, 'EVO ' + evo + '/' + evoMax, rx + 48, y + 20, 11, '#9fd0ff', 'left');
          const bh = 30, by = y - 15;
          // 训练
          const bwt = 88, bxt = sx + sw - bwt - 14;
          const cost = 120 * hLv;
          if (hLv >= lvMax) {
            roundRect(ctx, bxt, by, bwt, bh, 7, '#1a2431', '#2a3644', 1);
            text(ctx, '已满级', bxt + bwt / 2, by + bh / 2, 12, '#6f8398', 'center');
          } else {
            roundRect(ctx, bxt, by, bwt, bh, 7, Player.coins >= cost ? '#e0a52a' : '#3a4654',
              Player.coins >= cost ? '#ffdf9a' : '#4a5a70', 1);
            text(ctx, '训练 ' + cost, bxt + bwt / 2, by + bh / 2, 12, Player.coins >= cost ? '#fff' : '#9fb2c6', 'center', '#1a1206');
            this.hot.push({ x: bxt, y: by, w: bwt, h: bh, act: 'heroUp', char: h });
          }
          // 进化（花表里的 goldEvolution / gemEvolution，逐阶 8 阶）
          const bxw = 76, bxx = bxt - bxw - 6;
          if (evo >= evoMax) {
            roundRect(ctx, bxx, by, bxw, bh, 7, '#1a2431', '#2a3644', 1);
            text(ctx, '满进化', bxx + bxw / 2, by + bh / 2, 12, '#6f8398', 'center');
          } else {
            const ec = this.evoCostOf(h.charID);
            const can = Player.coins >= ec.gold && Player.gems >= ec.gem;
            roundRect(ctx, bxx, by, bxw, bh, 7, can ? '#2f6fb0' : '#1a2431', can ? '#7fc6ff' : '#2a3644', 1);
            text(ctx, '进化', bxx + bxw / 2, by + 8, 12, can ? '#fff' : '#6f8398', 'center');
            text(ctx, ec.gold + '+' + ec.gem + '宝', bxx + bxw / 2, by + 21, 9, can ? '#cfe8ff' : '#5f7488', 'center');
            if (can) this.hot.push({ x: bxx, y: by, w: bxw, h: bh, act: 'heroEvo', char: h });
          }
        } else {
          text(ctx, String(r[4]), rx + 66, y, 19, '#ffe9a8', 'left');
          if (r[5]) text(ctx, r[5], rx + 66 + String(r[4]).length * 12 + 4, y, 12, '#7ce08a', 'left');
        }
      });
      // 技能（每行右侧带升级按钮：花表里的 goldUpgrade，上限 maxLevel）
      const skills = (h.skillList || []).slice(0, 3);
      skills.forEach((s, i) => {
        const y = sy + 216 + i * 26;
        // 技能行：CD 与增伤都来自 gameCharacters.json 的 skillList
        const cd = Math.max(6, Math.min(25, Math.round(s.coolDown || 12)));
        const kind = s.skillTypes === 'BulfAll' ? '全队增益' : (i === 2 ? '范围箭雨' : '穿透射击');
        const lv = Player.skillLvOf(h.charID, s.skillID);
        text(ctx, '· ' + s.name + '   Lv ' + lv + '   ' + kind + '   CD ' + cd + 's',
          sx + 22, y, 13, '#9fd0ff', 'left');
        const maxLv = s.maxLevel || 160, cost = s.goldUpgrade || 200;
        const bw = 96, bh = 22, bx = sx + sw - bw - 14, by = y - 11;
        if (lv >= maxLv) {
          roundRect(ctx, bx, by, bw, bh, 5, '#1a2431', '#2a3644', 1);
          text(ctx, '满级', bx + bw / 2, by + bh / 2, 11, '#6f8398', 'center');
        } else {
          const can = Player.coins >= cost;
          roundRect(ctx, bx, by, bw, bh, 5, can ? '#2f6fb0' : '#1a2431',
            can ? '#7fc6ff' : '#2a3644', 1);
          text(ctx, '↑ ' + cost, bx + bw / 2, by + bh / 2, 11, can ? '#fff' : '#6f8398', 'center');
          this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'skillUp', char: h, si: i });
        }
      });
    }

    // 装备三格（点一下就卸下；去锻造页装新的）
    const ey = sy + sh + 12, eh = 214;
    roundRect(ctx, 12, ey, W - 24, eh, 10, '#141d29', '#33475e', 2);
    text(ctx, '装备槽位', 34, ey + 26, 15, '#8fa3b7', 'left');
    text(ctx, '在锻造页装备，点了可卸下', W - 34, ey + 26, 12, '#6f8398', 'right');
    const slots = [
      { key: 'weapon', lbl: '武器' },
      { key: 'armor', lbl: '护甲' },
      { key: 'artifact', lbl: '神器' }
    ];
    const cw3 = (W - 24 - 24 - 16) / 3;
    slots.forEach((s, i) => {
      const x = 12 + 12 + i * (cw3 + 8), y = ey + 46, hh = 152;
      const id = Player.equippedOf(this.hero ? this.hero.charID : Player.charID)[s.key];
      const it = id && this.g.itemByID ? this.g.itemByID[id] : null;
      roundRect(ctx, x, y, cw3, hh, 9, '#0f1720', it ? '#c8a13c' : '#2a3644', it ? 2 : 1);
      text(ctx, s.lbl, x + cw3 / 2, y + 18, 12, '#8fa3b7', 'center');
      if (it) {
        const iconName = this.iconOf(s.key === 'weapon' ? 'weapon' : (s.key === 'armor' ? 'armor' : 'artifact'),
          this.catIndexOf(s.key, it), it);
        const img = this.tex[iconName];
        if (img) {
          const sc = Math.min(64 / img.width, 64 / img.height);
          ctx.drawImage(img, x + cw3 / 2 - img.width * sc / 2, y + 62 - img.height * sc / 2, img.width * sc, img.height * sc);
        }
        text(ctx, String(it.name).slice(0, 12), x + cw3 / 2, y + 104, 12, '#e8eef6', 'center');
        const st = this.g.itemStats(it);
        const statTxt = s.key === 'weapon' ? 'Lv ' + st.lv + '  伤害 ' + Math.round(st.damage)
          : (s.key === 'armor' ? 'Lv ' + st.lv + '  护甲 +' + Math.round(st.armor) + ' 血 +' + Math.round(st.blood)
            : 'Lv ' + st.lv + '  血 +' + Math.round(st.blood) + ' 回复 +' + (Math.round(st.regain * 10) / 10));
        text(ctx, statTxt, x + cw3 / 2, y + 130, 10, '#7ce08a', 'center');
        this.hot.push({ x, y, w: cw3, h: hh, act: 'unequip', slot: s.key, itemID: id, name: it.name });
      } else {
        text(ctx, '空', x + cw3 / 2, y + 76, 14, '#5c6f83', 'center');
        text(ctx, '去锻造页装配', x + cw3 / 2, y + 104, 10, '#4f6072', 'center');
      }
    });
  }

  // 装备在分类列表里的下标（用于取原包图标）
  catIndexOf(slot, item) {
    const list = this.items[slot === 'weapon' ? 'weapon' : (slot === 'armor' ? 'armor' : 'artifact')] || [];
    const i = list.findIndex(x => x.itemID === item.itemID);
    return i < 0 ? 0 : i;
  }

  // 英雄下一阶进化成本（取 gameCharacters.json 的 evolutionList[evo]）
  evoCostOf(charID) {
    const chars = this.items.chars || [];
    const c = chars.find(x => x.charID === charID);
    const evo = Player.heroEvoOf(charID);
    const next = (c && c.evolutionList) ? c.evolutionList[evo] : null;
    return { gold: (next && next.goldEvolution) || 1000, gem: (next && next.gemEvolution) || 50 };
  }

  fillHero(chars) {    if (!this.hero) this.hero = chars.find(c => c.charID === Player.charID) || chars[0];
    if (!this.hero) return;
    const skName = HERO_SKELETONS[this.hero.charID];
    if (!skName) { this.actor = null; return; }
    const cached = this.heroCache[this.hero.charID];
    if (cached) { this.actor = cached; return; }
    if (this._loadingHero) return;
    this._loadingHero = true;
    loadSpine(skName).then(info => {
      const a = new Actor(info, { anim: 'Idle' });
      a.x = 12 + 420 / 2;
      a.y = 148 + 470 - 46;
      a.scale = 300 / info.h;
      this.heroCache[this.hero.charID] = a;
      this._loadingHero = false;
    }).catch(() => { this._loadingHero = false; this.heroCache[this.hero.charID] = null; });
  }

  // ================= 城堡 =================
  draw_castle() {
    const ctx = this.ctx;
    const c = this.items.castle;
    this.title('城堡  CASTLE', '数值来自 gameCastle.json');

    // 主图
    const px = 12, py = 148, pw = W - 24, ph = 320;
    roundRect(ctx, px, py, pw, ph, 12, '#0d141c', '#6d5a2c', 2);
    ctx.save();
    roundRect(ctx, px + 3, py + 3, pw - 6, ph - 6, 10, null, null, 0);
    ctx.clip();
    if (this.tex.castleArt) {
      const iw = pw - 6, ih = iw * this.tex.castleArt.height / this.tex.castleArt.width;
      ctx.drawImage(this.tex.castleArt, px + 3, py + 3 + (ph - 6 - ih) * 0.5, iw, ih);
    }
    const fade = ctx.createLinearGradient(0, py, 0, py + ph);
    fade.addColorStop(0, 'rgba(8,12,18,0.65)');
    fade.addColorStop(0.6, 'rgba(8,12,18,0.25)');
    fade.addColorStop(1, 'rgba(8,12,18,0.75)');
    ctx.fillStyle = fade; ctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
    if (this.tex.wall) {
      const ww = pw - 40, wh = ww * this.tex.wall.height / this.tex.wall.width;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.tex.wall, px + 20, py + ph - wh - 26, ww, wh);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    const lvl = Player.castleLevel;
    text(ctx, 'Castle  Lv ' + lvl, px + 20, py + 30, 20, '#ffe9a8', 'left', '#0a1018');
    if (c) {
      const row = (c.listLevelUp || []).find(x => x.level === lvl) || c;
      const stats = [
        ['血量', Math.round(lvl === 1 ? c.blood : row.blood || c.blood)],
        ['护甲', Math.round(row.armor !== undefined ? row.armor : c.armor)],
        ['回复', Math.round(row.regain !== undefined ? row.regain : c.regain)],
        ['槽位', row.slot || c.slot]
      ];
      stats.forEach((s, i) => {
        const x = px + 24 + i * 160;
        text(ctx, s[0], x, py + ph - 62, 13, '#9fb2c6', 'left');
        text(ctx, String(s[1]), x, py + ph - 36, 22, '#ffe9a8', 'left', '#0a1018');
      });
    }

    // 升级按钮
    const next = c ? (c.listLevelUp || []).find(x => x.level === lvl + 1) : null;
    const bw = W - 24, bh = 62, bx = 12, by = py + ph + 12;
    if (next) {
      if (this.tex.btnY) ctx.drawImage(this.tex.btnY, bx, by, bw, bh);
      else roundRect(ctx, bx, by, bw, bh, 10, '#e0a52a');
      text(ctx, '升到 Lv ' + next.level + '   ' + next.coinUpgrade + ' 金币' +
        (next.gemUpgrade ? ' / ' + next.gemUpgrade + ' 宝石' : ''), bx + bw / 2, by + bh / 2, 19, '#fff', 'center', '#1a1206');
      this.hot.push({ x: bx, y: by, w: bw, h: bh, act: 'castleUp', next });
    } else {
      roundRect(ctx, bx, by, bw, bh, 10, '#243040', '#3b4a5c', 2);
      text(ctx, '已满级（Lv 15）', bx + bw / 2, by + bh / 2, 18, '#9fb2c6', 'center');
    }

    // 等级表
    const ty = by + bh + 12;
    const per = 8;
    const levels = c ? c.listLevelUp || [] : [];
    const start = this.castlePage * per;
    let y = ty;
    roundRect(ctx, 12, ty, W - 24, 44, 8, '#16202d', '#33475e', 1);
    text(ctx, 'Lv', 34, ty + 22, 14, '#8fa3b7', 'left');
    text(ctx, '血量', 130, ty + 22, 14, '#8fa3b7', 'left');
    text(ctx, '护甲', 260, ty + 22, 14, '#8fa3b7', 'left');
    text(ctx, '回复', 360, ty + 22, 14, '#8fa3b7', 'left');
    text(ctx, '升级消耗', W - 34, ty + 22, 14, '#8fa3b7', 'right');
    y += 48;
    levels.slice(start, start + per).forEach(l => {
      const on = l.level === lvl;
      roundRect(ctx, 12, y, W - 24, 44, 6, on ? '#2c4a70' : '#141d29', on ? '#7fc6ff' : '#2a3644', 1);
      text(ctx, String(l.level), 34, y + 22, 15, on ? '#ffffff' : '#c9d6e2', 'left');
      text(ctx, String(Math.round(l.blood)), 130, y + 22, 15, '#ffe9a8', 'left');
      text(ctx, String(Math.round(l.armor)), 260, y + 22, 15, '#c9d6e2', 'left');
      text(ctx, String(Math.round(l.regain)), 360, y + 22, 15, '#c9d6e2', 'left');
      text(ctx, (l.coinUpgrade || 0) + (l.gemUpgrade ? ' / ' + l.gemUpgrade + 'G' : ''), W - 34, y + 22, 14, '#9fb2c6', 'right');
      y += 50;
    });

    if (levels.length > per) {
      const py2 = y + 12;
      const onPrev = this.castlePage > 0;
      const onNext = this.castlePage < Math.ceil(levels.length / per) - 1;
      roundRect(ctx, W / 2 - 40, py2 - 20, 80, 40, 8, '#16202d', '#33475e', 1);
      text(ctx, (this.castlePage + 1) + '/' + Math.ceil(levels.length / per), W / 2, py2, 14, '#9fb2c6', 'center');
      if (onPrev) { text(ctx, '◀', 46, py2, 20, '#7fc6ff', 'center'); this.hot.push({ x: 12, y: py2 - 20, w: 80, h: 40, act: 'castlePrev' }); }
      if (onNext) { text(ctx, '▶', W - 52, py2, 20, '#7fc6ff', 'center'); this.hot.push({ x: W - 92, y: py2 - 20, w: 80, h: 40, act: 'castleNext' }); }
    }
  }

  // ---------- 交互 ----------
  update(dt) {
    this.time += dt;
    if (this.toastT > 0) this.toastT += dt;
    if (this.actor) this.actor.update(dt);
  }

  say(msg) { this.toast = msg; this.toastT = 0.001; }

  // 材料 ID → 名称（材料表 43 条 + 三系打造材料 641/642/643）
  matName(itemID) {
    const m = (this.items && this.items.material) || [];
    const hit = m.find(x => x.itemID === itemID);
    return hit ? hit.name : ('#' + itemID);
  }

  // 宝箱 / 礼包的真实发放：货币直接入账，强化点加到当前等级最低的一件装备上
  giveChest(p) {
    const parts = [];
    if (p.coins) { Player.addCoins(p.coins); parts.push('金币 +' + p.coins); }
    if (p.gems) { Player.addGems(p.gems); parts.push('宝石 +' + p.gems); }
    if (p.up) {
      const t = this.pickUpgradeTarget();
      if (t) {
        const max = (t.maxLevelUpgrade || 10);
        const lv = Math.min(max, Player.lvOf(t.itemID) + p.up);
        Player.setLv(t.itemID, lv);
        parts.push(t.name + ' → Lv ' + lv);
      }
    }
    return parts.length ? parts.join('，') : '空箱';
  }

  pickUpgradeTarget() {
    // 优先当前英雄已穿戴的三件，否则退回武器表里等级最低的一件
    const eq = Player.equipped[Player.charID] || {};
    const all = { weapon: this.items.weapon, armor: this.items.armor, artifact: this.items.artifact };
    const cands = [];
    for (const slot of ['weapon', 'armor', 'artifact']) {
      const id = eq[slot];
      const list = all[slot] || [];
      const it = list.find(x => x.itemID === id);
      if (it) cands.push(it);
    }
    if (!cands.length) cands.push(...(this.items.weapon || []));
    if (!cands.length) return null;
    let best = null;
    for (const it of cands) {
      const lv = Player.lvOf(it.itemID), max = it.maxLevelUpgrade || 10;
      if (lv >= max) continue;
      if (!best || lv < Player.lvOf(best.itemID)) best = it;
    }
    return best;
  }

  toLocal(ev) {
    const r = this.g.cv.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left) / r.width * W,
      y: (ev.clientY - r.top) / r.height * H
    };
  }

  ptDown(p) {
    this.g.audioUnlock();
    if (this.chestResult) {
      this.chestResult = null;
      this.g.playSfx('sfx_click', 0.3);
      return;
    }
    for (const b of this.hot) {
      if (p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) continue;
      switch (b.act) {
        case 'nav':
          if (b.kind === 'fight') this.g.showSelect();
          else this.g.showTab(b.kind);
          return;
        case 'cat':
          this.cat = b.idx;
          this.itemPage = 0;
          this.g.playSfx('sfx_click', 0.3);
          return;
        case 'itemPrev': this.itemPage = Math.max(0, this.itemPage - 1); this.g.playSfx('sfx_click', 0.26); return;
        case 'itemNext': this.itemPage++; this.g.playSfx('sfx_click', 0.26); return;
        case 'castlePrev': this.castlePage = Math.max(0, this.castlePage - 1); this.g.playSfx('sfx_click', 0.26); return;
        case 'castleNext': this.castlePage++; this.g.playSfx('sfx_click', 0.26); return;
        case 'buyChest': {
          // 真实开箱：扣货币 → 按 TreasureBox.json 的概率与池子发奖
          const box = Chest.box(b.id);
          if (!box) { this.say('宝箱表未加载'); return; }
          const pr = Chest.price(box, b.n);
          const ok = pr.cur === 'gem' ? Player.spendGems(pr.v) : Player.spendCoins(pr.v);
          if (!ok) {
            this.say((pr.cur === 'gem' ? '宝石' : '金币') + '不足，需要 ' + pr.v);
            this.g.playSfx('sfx_equipfail', 0.36);
            return;
          }
          const res = Chest.open(b.id, b.n);
          this.chestResult = res;
          this.g.playSfx('sfx_buy', 0.36);
          this.g.playSfx('sfx_openbox', 0.24);
          return;
        }
        case 'closeChest':
          this.chestResult = null;
          this.g.playSfx('sfx_click', 0.3);
          return;
        case 'ad_coin':
        case 'ad_gem':
        case 'ad_chest': {
          if (Ads.remaining() <= 0) { this.say('今日广告次数已用完，明天再来'); this.g.playSfx('sfx_equipfail', 0.3); return; }
          const kind = b.act;
          this.g.playSfx('sfx_click', 0.3);
          Ads.show({
            title: kind === 'ad_coin' ? '看广告领 600 金币'
              : kind === 'ad_gem' ? '看广告领 8 宝石' : '看广告免费开 Common Chest',
            seconds: 4,
            onDone: done => {
              if (!done) { this.say('广告未看完，没有奖励'); return; }
              if (kind === 'ad_coin') { Player.addCoins(600); this.say('奖励到账：金币 +600'); }
              else if (kind === 'ad_gem') { Player.addGems(8); this.say('奖励到账：宝石 +8'); }
              else {
                this.chestResult = Chest.open(1, 1);   // 免费开 #1 Common Chest
                this.g.playSfx('sfx_openbox', 0.26);
              }
              this.g.playSfx('sfx_buy', 0.32);
            },
            onFail: r => this.say(r === 'daily_limit' ? '今日次数已用完' : '广告未完成')
          });
          return;
        }
        case 'iap':
          IAP.buy('first_pack_6', r => {
            if (r && r.ok) { Player.addGems(60); Player.addCoins(2000); this.say('内购成功：宝石 +60 / 金币 +2000'); }
            else this.say('未接入支付 SDK，IAP.buy() 里挂真实现即可');
            this.g.playSfx(r && r.ok ? 'sfx_buy' : 'sfx_equipfail', 0.3);
          });
          return;

        case 'craft': {
          const r = b.recipe;
          if (!Player.canSpendMats(r.listCraftItems || [])) {
            this.say('材料不足：需要 ' + (r.listCraftItems || []).map(x => this.matName(x.itemId) + ' x' + x.numbItem).join('、'));
            this.g.playSfx('sfx_equipfail', 0.3);
            return;
          }
          Player.spendMats(r.listCraftItems || []);
          if (b.cat === 'material') {
            Player.addMat(r.craftId, 1);
            this.say('合成成功：' + r.name.replace(' Recipe', '') + ' x1');
          } else {
            Player.ownItem(r.craftId);
            this.say('打造成功：' + (b.item ? b.item.name : r.name.replace(' Recipe', '')) + ' 可以强化和穿戴了');
          }
          this.g.playSfx('sfx_craft', 0.4);
          this.g.playSfx('sfx_buy', 0.28);
          return;
        }

        case 'upgrade': {
          const it = b.item;
          const lv = Player.lvOf(it.itemID);
          const maxLv = it.maxLevelUpgrade || 10;
          if (lv >= maxLv) { this.say(it.name + ' 已满级'); this.g.playSfx('sfx_equipfail', 0.3); return; }
          const cost = it.lvUpGold || 0;
          if (!cost) { this.say('该装备没有升级配置（lvUpGold=0）'); return; }
          if (Player.spendCoins(cost)) {
            Player.setLv(it.itemID, lv + 1);
            if (window.Daily) Daily.count('itemUp', 1);
            this.say(it.name + ' 强化到 Lv ' + (lv + 1));
            this.g.playSfx('sfx_levelup', 0.36);
            this.g.playSfx('sfx_craft', 0.28);
          } else {
            this.say('金币不足，需要 ' + cost);
            this.g.playSfx('sfx_equipfail', 0.3);
          }
          return;
        }
        case 'equip': {
          const on = Player.setEquip(Player.charID, b.slot, b.item.itemID);
          this.say((on ? '已装备 ' : '已卸下 ') + b.item.name);
          this.g.playSfx(on ? 'sfx_equip' : 'sfx_close', 0.34);
          return;
        }
        case 'unequip': {
          Player.setEquip(Player.charID, b.slot, b.itemID);
          this.say('已卸下 ' + (b.name || '装备'));
          this.g.playSfx('sfx_close', 0.3);
          return;
        }
        case 'char':
          this.hero = b.char;
          Player.charID = b.char.charID;
          Player.save();
          this.actor = null;
          this.fillHero(this.items.chars || []);
          this.g.playSfx('sfx_claim', 0.3);
          return;
        case 'heroUp': {
          const h = b.char;
          const lv = Player.heroLvOf(h.charID), max = h.levelMax || 10;
          if (lv >= max) { this.say(h.name + ' 已满级'); return; }
          const cost = 120 * lv;
          if (!Player.spendCoins(cost)) { this.say('金币不足，训练到 Lv ' + (lv + 1) + ' 需要 ' + cost); this.g.playSfx('sfx_equipfail', 0.3); return; }
          Player.setHeroLv(h.charID, lv + 1);
          if (window.Daily) Daily.count('heroUp', 1);
          this.g.playSfx('sfx_levelup', 0.4);
          this.say(h.name + ' 训练到 Lv ' + (lv + 1) + '（伤害 +12% / 血量 +10%）');
          return;
        }
        case 'heroEvo': {
          const h = b.char;
          const evo = Player.heroEvoOf(h.charID), evoMax = (h.evolutionList || []).length || 1;
          if (evo >= evoMax) { this.say(h.name + ' 已满进化'); return; }
          const ec = this.evoCostOf(h.charID);
          if (!Player.spendCoins(ec.gold)) { this.say('金币不足，进化需要 ' + ec.gold); this.g.playSfx('sfx_equipfail', 0.3); return; }
          if (ec.gem && !Player.spendGems(ec.gem)) {
            Player.addCoins(ec.gold);
            this.say('宝石不足，进化需要 ' + ec.gem);
            this.g.playSfx('sfx_equipfail', 0.3);
            return;
          }
          Player.setHeroEvo(h.charID, evo + 1);
          if (window.Daily) Daily.count('heroUp', 1);
          const nl = (h.evolutionList || [])[evo];
          this.g.playSfx('sfx_levelup', 0.44);
          this.g.playSfx('sfx_star', 0.3);
          this.say(h.name + ' 进化到 EVO ' + (evo + 1) + '，等级上限 ' + ((nl && nl.maxLevel) || '') );
          return;
        }
        case 'skillUp': {
          const h = b.char, s = (h.skillList || [])[b.si];
          if (!s) return;
          const lv = Player.skillLvOf(h.charID, s.skillID), max = s.maxLevel || 160, cost = s.goldUpgrade || 200;
          if (lv >= max) { this.say(s.name + ' 已满级'); return; }
          if (!Player.spendCoins(cost)) { this.say('金币不足，升级 ' + s.name + ' 需要 ' + cost); this.g.playSfx('sfx_equipfail', 0.3); return; }
          Player.setSkillLv(h.charID, s.skillID, lv + 1);
          if (window.Daily) Daily.count('skillUp', 1);
          this.g.playSfx('sfx_levelup', 0.36);
          this.say(s.name + ' 升到 Lv ' + (lv + 1));
          return;
        }
        case 'castleUp': {
          const n = b.next;
          const okC = n.coinUpgrade ? Player.spendCoins(n.coinUpgrade) : true;
          const okG = okC && n.gemUpgrade ? Player.spendGems(n.gemUpgrade) : true;
          if (okC && okG) {
            Player.castleLevel = n.level;
            Player.save();
            this.say('城堡升到 Lv ' + n.level);
            this.g.playSfx('sfx_levelup', 0.36);
          } else {
            this.say('资源不足：' + n.coinUpgrade + ' 金币' + (n.gemUpgrade ? ' / ' + n.gemUpgrade + ' 宝石' : ''));
            this.g.playSfx('sfx_equipfail', 0.3);
          }
          return;
        }
      }
    }
  }
}
