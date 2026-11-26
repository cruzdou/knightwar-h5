// ============================================================
//  骑士战争 H5（原美术重建）· 基础层
//  - 资源加载（图片 / Spine 3.6 骨架）
//  - Spine 角色封装（包围盒自动对齐脚底）
//  - UI 绘制小工具
// ============================================================

const W = 720, H = 1280;
const ART = 'assets/art/';
const SPINE_DIR = 'assets/spine/';
const SP = window.spine;

// ---------- 图片加载 ----------
const imgCache = {};
// 单张图片超时（线上 CDN 慢时避免整页启动被一张图卡死）；?imgto=30 可调
const IMG_TIMEOUT = (() => {
  const q = new URLSearchParams(location.search).get('imgto');
  const v = q ? parseInt(q, 10) : NaN;
  return Number.isFinite(v) && v > 0 ? v * 1000 : 8000;
})();

// 1x1 透明占位图：线上某张贴图慢/缺失时用它兜底，保证 drawImage 不会抛错
const BLANK_IMG = (() => {
  const im = new Image();
  im.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  return im;
})();

// 全局兜底：贴图未加载完（naturalWidth=0）时跳过 drawImage，避免整帧抛错
(function () {
  const proto = CanvasRenderingContext2D.prototype;
  const orig = proto.drawImage;
  proto.drawImage = function (img) {
    if (!img) return;
    if (img instanceof HTMLImageElement && !img.naturalWidth) return;
    return orig.apply(this, arguments);
  };
})();

// 城堡数值（战斗与城堡页共用一套换算）：以 Lv1 血量为基准，0.35 次方压平，基准城墙 561
function castleStatsFor(cd, level) {
  const base = 561;
  if (!cd) return { hp: base, armor: 0, regain: 0, slot: 1, blood: 1000 };
  const rows = cd.listLevelUp || [];
  const row = rows.find(r => r.level === level) || {};
  const b1 = (rows[0] && rows[0].blood) || cd.blood || 1000;
  const blood = row.blood || cd.blood || b1;
  const k = Math.max(0.8, Math.min(8, Math.pow((blood / b1) || 1, 0.3)));
  return {
    hp: Math.round(base * k),
    armor: Math.max(0, row.armor !== undefined ? row.armor : (cd.armor || 0)),
    regain: Math.max(0, row.regain !== undefined ? row.regain : (cd.regain || 0)),
    slot: row.slot || cd.slot || 1,
    blood: blood
  };
}

function loadImage(name) {
  if (imgCache[name]) return imgCache[name];
  imgCache[name] = new Promise(res => {
    const im = new Image();
    let done = false;
    let retried = false;
    const arm = (ms) => setTimeout(() => {
      if (done) return;
      if (!retried) {
        retried = true;
        console.warn('图片加载超时，重试一次: ' + name);
        try { const im2 = new Image(); im2.onload = () => { if (done) return; done = true; res(im2); }; im2.src = im.src; arm(28000); return; } catch (e) { /* fallthrough */ }
      }
      done = true;
      console.warn('图片加载超时，用透明占位: ' + name);
      res(BLANK_IMG);
    }, ms);
    const timer = arm(IMG_TIMEOUT);
    let triedFallback = false;
    im.onload = () => { if (done) return; done = true; clearTimeout(timer); res(im); };
    // 抖音分包：资源可能还没下载，先确保分包就绪再用真实路径
    const start = () => {
      im.src = /\.png$/i.test(name) ? (ART + name.replace(/\.png$/i, '.webp')) : (ART + name);
    };
    const usePath = () => {
      if (window.TT && window.TT.isMini) {
        const p = /\.png$/i.test(name) ? (ART + name.replace(/\.png$/i, '.webp')) : (ART + name);
        window.TT.ensureAsset(p).then(() => { im.src = window.TT.assetPath(p); }).catch(start);
      } else start();
    };
    im.onerror = () => {
      if (done) return;
      // 首选 webp（体积约 1/3）；个别未转换的贴图回退到原 png
      if (!triedFallback && /\.png$/i.test(name)) {
        triedFallback = true;
        const p2 = ART + name;
        if (window.TT && window.TT.isMini) window.TT.ensureAsset(p2).then(() => { im.src = window.TT.assetPath(p2); }).catch(() => {});
        else im.src = p2;
        return;
      }
      done = true;
      clearTimeout(timer);
      res(BLANK_IMG);
    };
    usePath();
  });
  return imgCache[name];
}

// ---------- Spine 加载 ----------
const spineCache = {};

function texWrap(im) {
  return { getImage: () => im, setFilters() {}, setWraps() {}, width: im.width, height: im.height };
}

// 带超时的 fetch：慢网络下别让一个骨架把启动流程吊死
function fetchText(url, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms || SPINE_TIMEOUT);
  return fetch(url, { signal: ctl.signal }).then(r => r.text()).finally(() => clearTimeout(timer));
}
const SPINE_TIMEOUT = 12000;

async function loadSpine(name) {
  if (spineCache[name]) return spineCache[name];
  const base = SPINE_DIR + name;
  // 抖音分包：骨架整包在 pkg_battle，先确保下载完再取文件
  if (window.TT && window.TT.ensureAsset) {
    await window.TT.ensureAsset(base + '.atlas');
    await window.TT.ensureAsset(base + '.json');
  }
  const real = (window.TT && window.TT.assetPath) ? (x => window.TT.assetPath(x)) : (x => x);
  const [atlasText, jsonText] = await Promise.all([
    fetchText(real(base + '.atlas')),
    fetchText(real(base + '.json'))
  ]);
  const jsonObj = JSON.parse(jsonText);
  const pageNames = [...atlasText.matchAll(/^([^\n]+\.(?:png|webp))\s*$/gm)].map(m => m[1]);
  const pages = {};
  await Promise.all(pageNames.map(async p => {
    const full = SPINE_DIR + p;
    if (window.TT && window.TT.ensureAsset) await window.TT.ensureAsset(full);
    const url = (window.TT && window.TT.assetPath) ? window.TT.assetPath(full) : full;
    pages[p] = texWrap(await new Promise((res, rej) => {
      const im = new Image();
      const timer = setTimeout(() => rej(new Error('贴图超时: ' + p)), SPINE_TIMEOUT);
      im.onload = () => { clearTimeout(timer); res(im); };
      im.onerror = () => { clearTimeout(timer); rej(new Error('贴图缺失: ' + p)); };
      im.src = url;
    }));
  }));
  const atlas = new SP.TextureAtlas(atlasText, p => pages[p]);
  const data = new SP.SkeletonJson(new SP.AtlasAttachmentLoader(atlas)).readSkeletonData(jsonObj);

  // 量一次包围盒（setup pose, scale=1）：区域附件用 bone 版接口，网格附件用 slot 版接口
  const probe = new SP.Skeleton(data);
  probe.setToSetupPose();
  probe.updateWorldTransform();
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, nv = 0;
  for (const slot of probe.slots) {
    const at = slot.attachment;
    if (!at || !at.computeWorldVertices) continue;
    let len, vs;
    if (at.worldVerticesLength && at.computeWorldVertices.length >= 5) {   // MeshAttachment
      len = at.worldVerticesLength;
      if (len < 4) continue;
      vs = new Float32Array(len);
      try { at.computeWorldVertices(slot, 0, len, vs, 0, 2); } catch (err) { continue; }
    } else {                                                              // RegionAttachment
      len = 8; vs = new Float32Array(len);
      try { at.computeWorldVertices(slot.bone, vs, 0, 2); } catch (err) { continue; }
    }
    for (let i = 0; i + 1 < len; i += 2) {
      minX = Math.min(minX, vs[i]); maxX = Math.max(maxX, vs[i]);
      minY = Math.min(minY, vs[i + 1]); maxY = Math.max(maxY, vs[i + 1]);
      nv++;
    }
  }
  if (!nv) { minX = -50; maxX = 50; minY = 0; maxY = 100; }
  const bb = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const info = {
    data,
    name,
    anims: data.animations.map(a => a.name),
    bx: bb.x + bb.width / 2,
    by: bb.y,
    h: bb.height,
    w: bb.width
  };
  spineCache[name] = info;
  return info;
}

// 取出所有顶层骨骼（有些骨架不止一个根骨骼）
function rootBones(sk) {
  const rs = [];
  for (const b of sk.bones) if (!b.parent) rs.push(b);
  return rs;
}

// 量当前姿势的世界包围盒（骨架自身 x/y/scale 必须已归零）
function measurePose(sk) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, nv = 0;
  for (const slot of sk.slots) {
    const at = slot.attachment;
    if (!at || !at.computeWorldVertices) continue;
    let len, vs;
    if (at.worldVerticesLength && at.computeWorldVertices.length >= 5) {
      len = at.worldVerticesLength;
      if (len < 4) continue;
      vs = new Float32Array(len);
      try { at.computeWorldVertices(slot, 0, len, vs, 0, 2); } catch (e) { continue; }
    } else {
      len = 8; vs = new Float32Array(8);
      try { at.computeWorldVertices(slot.bone, vs, 0, 2); } catch (e) { continue; }
    }
    for (let i = 0; i + 1 < len; i += 2) {
      minX = Math.min(minX, vs[i]); maxX = Math.max(maxX, vs[i]);
      minY = Math.min(minY, vs[i + 1]); maxY = Math.max(maxY, vs[i + 1]);
      nv++;
    }
  }
  if (!nv) return { minX: -50, maxX: 50, minY: 0, maxY: 100 };
  return { minX, maxX, minY, maxY };
}

// 一个可绘制的角色实例：Spine 骨架 或 逐帧条带（Castle Guards 素材）
class Actor {
  constructor(info, opts = {}) {
    this.info = info;
    this.x = 0; this.y = 0; this.scale = 1;
    this.alpha = 1;
    this.flip = false;
    // ---- 逐帧单位 ----
    if (info && info.kind === 'frames') {
      this.fx = { anim: null, t: 0, loop: true, base: null, once: false };
      if (opts.anim) this.play(opts.anim, true);
      return;
    }
    this.sk = new SP.Skeleton(info.data);
    this.sk.setSkin(data0(info));
    this.sk.setToSetupPose();
    this.state = new SP.AnimationState(new SP.AnimationStateData(info.data));
    this.queue = [];          // 一次性动画结束后要恢复的动画
    if (opts.anim) this.play(opts.anim, true);
  }

  play(name, loop) {
    if (this.info && this.info.kind === 'frames') {
      const key = ANIM_ALIAS[name] || (this.info.frames[name] ? name : null);
      if (!key || !this.info.frames[key]) return;
      if (this.fx.anim === key && this.fx.loop === !!loop) return;
      this.fx.anim = key; this.fx.loop = !!loop; this.fx.t = 0; this.fx.once = false;
      this.fx.base = !!loop ? key : (this.fx.base || key);
      loadSheet(this.info.unit, key);
      return;
    }
    const anim = this.info.anims.includes(name) ? name : this.info.anims[0];
    this.current = anim;
    this.state.setAnimation(0, anim, !!loop);
  }

  // 播一次性动画，结束后回到 base
  once(name, base) {
    if (this.info && this.info.kind === 'frames') {
      const key = ANIM_ALIAS[name] || (this.info.frames[name] ? name : null);
      if (!key || !this.info.frames[key]) return;
      const bk = ANIM_ALIAS[base] || (this.info.frames[base] ? base : 'idle');
      this.fx.anim = key; this.fx.loop = false; this.fx.t = 0; this.fx.once = true;
      this.fx.base = (bk && this.info.frames[bk]) ? bk : 'idle';
      loadSheet(this.info.unit, key);
      return;
    }
    if (!this.info.anims.includes(name)) return;
    this.state.setAnimation(0, name, false);
    this.state.addAnimation(0, base, true, 0);
  }

  update(dt) {
    if (this.info && this.info.kind === 'frames') {
      if (!this.fx.anim) return;
      const meta = this.info.frames[this.fx.anim];
      const n = meta ? meta.frames : 1;
      this.fx.t += dt * (this.info.fps || 15);
      if (this.fx.t >= n) {
        if (this.fx.loop) this.fx.t %= n;
        else {
          // 一次性动画结束：回基础动画
          const base = this.fx.base || 'idle';
          this.fx.t = 0; this.fx.anim = base; this.fx.loop = true; this.fx.once = false;
          if (this.info.frames[base]) loadSheet(this.info.unit, base);
        }
      }
      return;
    }
    this.state.update(dt);
    this.state.apply(this.sk);
    this.sk.updateWorldTransform();
  }

  draw(ctx, renderer) {
    if (this.info && this.info.kind === 'frames') {
      const key = this.fx.anim || 'idle';
      const sheet = sheetCache[this.info.unit + '|' + key];
      // 条带尚未就绪时用已缓存的 idle 顶一下，避免空帧闪烁
      const ready = sheet && sheet.__v ? sheet.__v : null;
      const idle = sheetCache[this.info.unit + '|idle'];
      const use = ready || (idle && idle.__v);
      if (use && use.img && (use.img.naturalWidth || use.img.width)) {
        const s = this.scale, fw = this.info.w, fh = this.info.h;
        const n = use.frames;
        const f = Math.min(n - 1, Math.max(0, Math.floor(this.fx.t || 0)));
        const dw = fw * s, dh = fh * s;
        // 有 alpha 包围盒时按「可见高度」落地，避免素材四周留白导致人物大小/站位失真
        const hb = this.info.hb || fh, y0 = this.info.y0 || 0;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        if (this.flip) {
          ctx.translate(this.x, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(use.img, f * fw, 0, fw, fh, -dw / 2, this.y - (y0 + hb) * s, dw, dh);
        } else {
          ctx.drawImage(use.img, f * fw, 0, fw, fh, this.x - dw / 2, this.y - (y0 + hb) * s, dw, dh);
        }
        ctx.restore();
        return;
      }
      // 都还没加载好：先触发载入，本帧不画
      if (!sheet) loadSheet(this.info.unit, key);
      return;
    }
    const s = this.scale;
    const roots = rootBones(this.sk);
    // 3.6 的 JS 运行时不用 skeleton.scaleX/Y，缩放必须挂在顶层骨骼上
    // 1) 归零量「当前姿势」包围盒
    for (const b of roots) { b.x = 0; b.y = 0; b.scaleX = 1; b.scaleY = 1; }
    this.sk.x = 0; this.sk.y = 0;
    this.sk.updateWorldTransform();
    const bb = measurePose(this.sk);

    // 2) 缩放 + 翻转 + 定位（脚底落 this.y，水平中心落 this.x）
    for (const b of roots) { b.scaleX = this.flip ? -s : s; b.scaleY = -s; }
    const cx = (bb.minX + bb.maxX) / 2;
    this.sk.x = this.x - s * cx;
    this.sk.y = this.y - s * bb.minY;
    this.sk.updateWorldTransform();

    // 3) 用变换后的真实包围盒校正一次（根骨骼可能带旋转/剪切，解析式不一定准）
    const wb0 = measurePose(this.sk);
    this.sk.x += this.x - (wb0.minX + wb0.maxX) / 2;
    this.sk.y += this.y - wb0.maxY;
    this.sk.updateWorldTransform();

    if (this.debugLog) {
      const wb = measurePose(this.sk);
      console.log('DRAW', this.tag || '?', 's', s.toFixed(2), 'skX', this.sk.x.toFixed(1), 'skY', this.sk.y.toFixed(1),
        'screen y', wb.minY.toFixed(1), '..', wb.maxY.toFixed(1), 'x', wb.minX.toFixed(1), '..', wb.maxX.toFixed(1));
      this.debugLog = false;
    }

    ctx.save();
    ctx.globalAlpha = this.alpha;
    renderer.draw(this.sk);
    ctx.restore();
  }
}

function data0(info) {
  return info.data.defaultSkin || (info.data.skins && info.data.skins[0]) || null;
}

// ---------- UI 小工具 ----------
function roundRect(ctx, x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}

function text(ctx, str, x, y, size, color, align, stroke) {
  ctx.font = `bold ${size}px "Microsoft YaHei", Arial, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineWidth = Math.max(3, size / 7);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function drawIcon(ctx, img, cx, cy, scale, alpha) {
  if (!img || !img.width) return;
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function lerp(a, b, t) { return a + (b - a) * t; }

// 按目标高度等比绘制图标（不同素材尺寸差异大时用它，避免一张图糊满屏）
function drawIconFit(ctx, img, cx, cy, targetH, alpha) {
  if (!img || !img.width) return;
  const h = targetH, w = targetH * img.width / img.height;
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

// ---------- 公共外框：顶部资源条 / 底部五标签导航（选关页和各功能页共用） ----------
function drawTopBar(ctx, tex, pl, hot) {
  const y = 12, h = 54;
  const pills = [
    { x: 8, w: 148, icon: skinGet('sk_icon_hp.webp') || tex.stamina, v: pl.stamina },
    { x: 164, w: 132, icon: skinGet('sk_gem_icon.webp') || tex.gem, v: pl.gems },
    { x: 304, w: 148, icon: skinGet('sk_coin_icon.webp') || tex.coin, v: pl.coins }
  ];
  for (const p of pills) {
    if (!skinHBar(ctx, 'sk_gem_bar.webp', p.x, y, p.w, h, 0.5)) {
      roundRect(ctx, p.x, y, p.w, h, 8, '#241a10', '#8a5a2a', 2);
    }
    drawIconFit(ctx, p.icon, p.x + 20, y + h / 2, 28);
    text(ctx, String(p.v), p.x + 36, y + h / 2, 20, '#fff3c4', 'left', '#4a2a08');
    if (skinGet('sk_small_green.webp')) {
      skinHBar(ctx, 'sk_small_green.webp', p.x + p.w - 26, y + h / 2 - 11, 22, 22, 0.5);
      text(ctx, '+', p.x + p.w - 15, y + h / 2, 16, '#fff8e1', 'center', '#2a4a10');
    } else {
      roundRect(ctx, p.x + p.w - 22, y + h / 2 - 9, 18, 18, 5, '#b8762a', '#f2d79a', 1);
      drawIcon(ctx, tex.plus, p.x + p.w - 13, y + h / 2, 0.34);
    }
  }
  if (skinGet('sk_btn_settings.webp')) drawIcon(ctx, skinGet('sk_btn_settings.webp'), W - 30, y + h / 2, 0.3);
  else text(ctx, '⚙', W - 16, y + h / 2, 26, '#9fb2c6', 'right');
}

const NAV_TABS = [
  { kind: 'shop', img: 'navShop', lbl: '商店' },
  { kind: 'craft', img: 'navCraft', lbl: '锻造' },
  { kind: 'fight', img: 'navFight', lbl: '战斗' },
  { kind: 'hero', img: 'navHero', lbl: '英雄' },
  { kind: 'castle', img: 'navCastle', lbl: '城堡' }
];

function drawBottomNav(ctx, tex, active, hot) {
  const y = H - 100;
  if (!skinSlice(ctx, 'sk_bot_bar.webp', 0, y, W, 100, 60)) {
    roundRect(ctx, 0, y, W, 100, 0, '#3a2716');
    ctx.fillStyle = 'rgba(255,214,140,0.45)';
    ctx.fillRect(0, y, W, 3);
  }
  const step = W / NAV_TABS.length;
  const SK = { shop: 'sk_icon_shop.webp', craft: 'sk_icon_card.webp', fight: 'sk_icon_challenge.webp',
               hero: 'sk_icon_achv.webp', castle: 'sk_icon_home.webp' };
  NAV_TABS.forEach((t, i) => {
    const cx = step * (i + 0.5), cy = y + 44;
    const on = t.kind === active;
    if (on && !skinSlice(ctx, 'sk_tab_active1.webp', cx - 46, cy - 40, 92, 80, 24)) {
      roundRect(ctx, cx - 40, cy - 34, 80, 68, 12, 'rgba(255,214,120,0.28)', '#f0b93b', 2);
    }
    const img = skinGet(SK[t.kind]) || tex[t.img];
    if (img) drawIconFit(ctx, img, cx, cy - 10, on ? 44 : 38, on ? 1 : 0.85);
    text(ctx, t.lbl, cx, y + 74, 14, on ? '#ffe6a8' : '#c68b4a', 'center', on ? '#4a2108' : undefined);
    if (hot && !on) hot.push({ x: cx - 72, y, w: 144, h: 100, act: 'nav', kind: t.kind });
  });
}

// 浅色提示条（购买/升级等占位交互的反馈）
function drawToast(ctx, msg, t) {
  if (!msg) return;
  const a = t > 1.4 ? Math.max(0, 1 - (t - 1.4) / 0.4) : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold 18px "Microsoft YaHei", Arial, sans-serif';
  const w = Math.min(W - 40, ctx.measureText(msg).width + 80);
  roundRect(ctx, (W - w) / 2, H - 210, w, 52, 10, 'rgba(44,26,12,0.94)', '#c68b4a', 2);
  text(ctx, msg, W / 2, H - 184, 18, '#ffe9a8', 'center');
  ctx.restore();
}





