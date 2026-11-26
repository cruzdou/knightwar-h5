// ============================================================
//  皮肤层：CraftPix《Castle Guards》卡通素材
//  - 单图预加载（assets/skin/*.webp）
//  - 九宫格面板 / 按钮 / 进度条绘制
//  - 拿不到图时回退到原来的圆角矩形，保证不白屏
// ============================================================

const SKIN_DIR = 'assets/skin/';
const skinCache = {};      // 文件 → {img} 或 null
const skinPending = {};

function skinLoad(file) {
  if (skinCache[file] !== undefined) return skinCache[file];
  if (skinPending[file]) return skinPending[file];
  skinPending[file] = new Promise(res => {
    const im = new Image();
    const timer = setTimeout(() => { skinCache[file] = null; res(null); }, 10000);
    im.onload = () => { clearTimeout(timer); skinCache[file] = im; res(im); };
    im.onerror = () => { clearTimeout(timer); skinCache[file] = null; res(null); };
    im.src = SKIN_DIR + file;
  });
  return skinPending[file];
}

function skinGet(file) {
  const v = skinCache[file];
  return v && v.width ? v : null;
}

// 预加载一批（UI 主界面 + 战斗常用）
const SKIN_PRELOAD = [
  'sk_panel_box.webp', 'sk_panel_light.webp', 'sk_btn_green.webp', 'sk_btn_green_p.webp',
  'sk_btn_blue.webp', 'sk_btn_blue_p.webp', 'sk_btn_orange.webp', 'sk_btn_orange_p.webp',
  'sk_btn_close.webp', 'sk_btn_close_p.webp', 'sk_screen_bg.webp', 'sk_status_bg.webp',
  'sk_top_title.webp', 'sk_stage_bar.webp', 'sk_gem_bar.webp', 'sk_bot_bar.webp',
  'sk_home_slot.webp', 'sk_card_slot.webp', 'sk_card_bg.webp', 'sk_shop_box1.webp',
  'sk_shop_box2.webp', 'sk_shop_blue.webp', 'sk_shop_blue_p.webp', 'sk_shop_green.webp',
  'sk_shop_green_p.webp', 'sk_small_green.webp', 'sk_small_green_p.webp',
  'sk_btn_play.webp', 'sk_btn_play_p.webp', 'sk_star_empty.webp', 'sk_star_filled.webp',
  'sk_icon_home.webp', 'sk_icon_shop.webp', 'sk_icon_challenge.webp', 'sk_icon_achv.webp',
  'sk_icon_card.webp', 'sk_gem_icon.webp', 'sk_coin_icon.webp', 'sk_coin_bar.webp',
  'sk_hp_bg.webp', 'sk_hp_fg.webp', 'sk_exp_bg.webp', 'sk_exp_fg.webp',
  'sk_bottom_hud.webp', 'sk_castle.webp', 'sk_btn_pause.webp', 'sk_btn_pause_p.webp',
  'sk_achv_bar_bg.webp', 'sk_achv_bar_fg.webp', 'sk_achv_done.webp', 'sk_achv_undone.webp',
  'sk_upgrade_box.webp', 'sk_paused_box.webp', 'sk_bonus_box.webp', 'sk_booster_box.webp',
  'sk_lose_box.webp', 'sk_wind_box.webp', 'sk_arrow.webp', 'sk_arrow_fire.webp',
  'sk_arrow_ice.webp', 'sk_fireball.webp', 'sk_tab_active1.webp', 'sk_tab_inactive1.webp',
  'sk_screen_bg.webp'
];
function skinPreload() { SKIN_PRELOAD.forEach(f => skinLoad(f)); }

// ---------- 九宫格 ----------
// m：源图四边不拉伸的像素宽度；缺图时回退圆角矩形
function skinSlice(ctx, file, x, y, w, h, m, tint) {
  const img = skinGet(file);
  if (!img) return false;
  if (w <= 0 || h <= 0) return true;
  m = Math.min(m || 24, Math.floor(Math.min(img.width, img.height) / 2));
  const sx = img.width - m * 2, sy = img.height - m * 2;
  const dx = Math.max(1, w - m * 2), dy = Math.max(1, h - m * 2);
  const parts = [
    [0, 0, m, m, x, y, m, m],
    [img.width - m, 0, m, m, x + w - m, y, m, m],
    [0, img.height - m, m, m, x, y + h - m, m, m],
    [img.width - m, img.height - m, m, m, x + w - m, y + h - m, m, m],
    [m, 0, sx, m, x + m, y, dx, m],
    [m, img.height - m, sx, m, x + m, y + h - m, dx, m],
    [0, m, m, sy, x, y + m, m, dy],
    [img.width - m, m, m, sy, x + w - m, y + m, m, dy],
    [m, m, sx, sy, x + m, y + m, dx, dy]
  ];
  ctx.save();
  for (const p of parts) {
    if (p[6] <= 0 || p[7] <= 0) continue;
    ctx.drawImage(img, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]);
  }
  ctx.restore();
  return true;
}

// 面板（带兜底）
function skinPanel(ctx, x, y, w, h, opts = {}) {
  const file = opts.file || 'sk_panel_box.webp';
  const m = opts.m || 30;
  if (skinSlice(ctx, file, x, y, w, h, m)) return true;
  roundRect(ctx, x, y, w, h, opts.r || 14,
    opts.fill || 'rgba(38,28,18,0.92)', opts.stroke || '#c68b4a', opts.lw || 3);
  return false;
}

// 横向胶囊（按钮/条）：左右端按高度缩放，中段横向拉伸，避免九宫格把细边压烂
function skinHBar(ctx, file, x, y, w, h, capRatio) {
  const img = skinGet(file);
  if (!img || w <= 0 || h <= 0) return false;
  const sy = h / img.height;
  const capSrc = Math.max(4, Math.round(img.height * (capRatio || 0.52)));
  const capDst = Math.min(w / 2, capSrc * sy);
  const midDst = Math.max(1, w - capDst * 2);
  ctx.save();
  ctx.drawImage(img, 0, 0, capSrc, img.height, x, y, capDst, h);
  ctx.drawImage(img, capSrc, 0, img.width - capSrc * 2, img.height, x + capDst, y, midDst, h);
  ctx.drawImage(img, img.width - capSrc, 0, capSrc, img.height, x + w - capDst, y, capDst, h);
  ctx.restore();
  return true;
}

// 按钮：自动按 pressed 换图，缺图回退圆角
function skinButton(ctx, x, y, w, h, style, pressed, label, labelOpt) {
  const map = {
    green: ['sk_btn_green.webp', 'sk_btn_green_p.webp', '#2f7d32'],
    blue: ['sk_btn_blue.webp', 'sk_btn_blue_p.webp', '#1f5fa8'],
    orange: ['sk_btn_orange.webp', 'sk_btn_orange_p.webp', '#c4691f'],
    smallGreen: ['sk_small_green.webp', 'sk_small_green_p.webp', '#2f7d32'],
    shopBlue: ['sk_shop_blue.webp', 'sk_shop_blue_p.webp', '#1f5fa8'],
    shopGreen: ['sk_shop_green.webp', 'sk_shop_green_p.webp', '#2f7d32'],
    achv: ['sk_achv_btn.webp', 'sk_achv_btn_p.webp', '#2f7d32'],
    play: ['sk_btn_play.webp', 'sk_btn_play_p.webp', '#c4691f']
  };
  const cfg = map[style] || map.green;
  const ok = skinHBar(ctx, cfg[pressed ? 1 : 0], x, y, w, h, 0.5);
  if (!ok) roundRect(ctx, x, y, w, h, 12, cfg[2], '#0d1a0f', 2);
  if (label) {
    const o = labelOpt || {};
    ctx.save();
    ctx.font = `bold ${o.size || 26}px "Microsoft YaHei", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = o.color || '#fff8e1';
    if (o.stroke) {
      ctx.lineWidth = o.lw || 4;
      ctx.strokeStyle = o.stroke;
      ctx.strokeText(label, x + w / 2, y + h / 2 + (o.dy || 0));
    }
    ctx.fillText(label, x + w / 2, y + h / 2 + (o.dy || 0));
    ctx.restore();
  }
  return ok;
}

// 横向进度条：底图 + 前景九宫格裁剪
function skinBar(ctx, x, y, w, h, frac, bgFile, fgFile, tint) {
  const bg = skinGet(bgFile || 'sk_hp_bg.webp');
  const fg = skinGet(fgFile || 'sk_hp_fg.webp');
  if (bg) ctx.drawImage(bg, x, y, w, h);
  else roundRect(ctx, x, y, w, h, h / 2, '#1a1208', '#5a3c22', 2);
  const p = Math.max(0, Math.min(1, frac || 0));
  if (p > 0) {
    ctx.save();
    if (fg) {
      const sw = Math.max(2, Math.floor(fg.width * p));
      ctx.drawImage(fg, 0, 0, sw, fg.height, x + (bg ? 4 : 2), y + (bg ? 3 : 2), w - (bg ? 8 : 4), h - (bg ? 6 : 4));
      if (tint) {
        ctx.fillStyle = tint;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x + 4, y + 3, (w - 8) * p, h - 6);
        ctx.globalAlpha = 1;
      }
    } else {
      roundRect(ctx, x + 2, y + 2, (w - 4) * p, h - 4, (h - 4) / 2, tint || '#4fc3f7');
    }
    ctx.restore();
  }
}

// 图标（按文件名，缺图返回 false）
function skinIcon(ctx, file, x, y, size, alpha) {
  const img = skinGet(file);
  if (!img) return false;
  const r = img.width / img.height;
  const w = size * r, h = size;
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
  return true;
}

// 背景（战场 / 主界面）
const BG_DIR = 'assets/bg/';
const bgCache = {};
function bgLoadAsync(n) {
  if (bgCache[n] && bgCache[n].width) return Promise.resolve(bgCache[n]);
  return new Promise(res => {
    const im = new Image();
    const timer = setTimeout(() => res(null), 10000);
    im.onload = () => { clearTimeout(timer); bgCache[n] = im; res(im); };
    im.onerror = () => { clearTimeout(timer); res(null); };
    im.src = BG_DIR + 'ga' + n + '.webp';
  });
}
function bgGet(n) {
  if (bgCache[n] === undefined) { bgCache[n] = null; bgLoadAsync(n); }
  return bgCache[n] && bgCache[n].width ? bgCache[n] : null;
}
