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

function loadImage(name) {
  if (imgCache[name]) return imgCache[name];
  imgCache[name] = new Promise(res => {
    const im = new Image();
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      console.warn('图片加载超时，用透明占位: ' + name);
      res(BLANK_IMG);
    }, IMG_TIMEOUT);
    im.onload = () => { if (done) return; done = true; clearTimeout(timer); res(im); };
    im.onerror = () => { if (done) return; done = true; clearTimeout(timer); res(BLANK_IMG); };
    im.src = ART + name;
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
  const [atlasText, jsonText] = await Promise.all([
    fetchText(base + '.atlas'),
    fetchText(base + '.json')
  ]);
  const jsonObj = JSON.parse(jsonText);
  const pageNames = [...atlasText.matchAll(/^([^\n]+\.png)\s*$/gm)].map(m => m[1]);
  const pages = {};
  await Promise.all(pageNames.map(async p => {
    pages[p] = texWrap(await new Promise((res, rej) => {
      const im = new Image();
      const timer = setTimeout(() => rej(new Error('贴图超时: ' + p)), SPINE_TIMEOUT);
      im.onload = () => { clearTimeout(timer); res(im); };
      im.onerror = () => { clearTimeout(timer); rej(new Error('贴图缺失: ' + p)); };
      im.src = SPINE_DIR + p;
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

// 一个可绘制的 Spine 角色实例
class Actor {
  constructor(info, opts = {}) {
    this.info = info;
    this.sk = new SP.Skeleton(info.data);
    this.sk.setSkin(data0(info));
    this.sk.setToSetupPose();
    this.state = new SP.AnimationState(new SP.AnimationStateData(info.data));
    this.x = 0; this.y = 0; this.scale = 1;
    this.alpha = 1;
    this.flip = false;
    this.queue = [];          // 一次性动画结束后要恢复的动画
    if (opts.anim) this.play(opts.anim, true);
  }

  play(name, loop) {
    const anim = this.info.anims.includes(name) ? name : this.info.anims[0];
    this.current = anim;
    this.state.setAnimation(0, anim, !!loop);
  }

  // 播一次性动画，结束后回到 base
  once(name, base) {
    if (!this.info.anims.includes(name)) return;
    this.state.setAnimation(0, name, false);
    this.state.addAnimation(0, base, true, 0);
  }

  update(dt) {
    this.state.update(dt);
    this.state.apply(this.sk);
    this.sk.updateWorldTransform();
  }

  draw(ctx, renderer) {
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
  if (!img) return;
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ---------- 公共外框：顶部资源条 / 底部五标签导航（选关页和各功能页共用） ----------
function drawTopBar(ctx, tex, pl, hot) {
  const y = 12, h = 54;
  const pills = [
    { x: 8, w: 148, icon: tex.stamina, v: pl.stamina },
    { x: 164, w: 132, icon: tex.gem, v: pl.gems },
    { x: 304, w: 148, icon: tex.coin, v: pl.coins }
  ];
  for (const p of pills) {
    roundRect(ctx, p.x, y, p.w, h, 8, '#111b26', '#2c3f52', 2);
    const lg = ctx.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, 'rgba(90,130,180,0.18)');
    lg.addColorStop(1, 'rgba(10,16,24,0)');
    roundRect(ctx, p.x + 1, y + 1, p.w - 2, h - 2, 7, lg);
    drawIcon(ctx, p.icon, p.x + 22, y + h / 2, 0.62);
    text(ctx, String(p.v), p.x + 44, y + h / 2, 24, '#ffe9a8', 'left', '#20160a');
    roundRect(ctx, p.x + p.w - 22, y + h / 2 - 9, 18, 18, 5, '#2f6fb0', '#7fc6ff', 1);
    drawIcon(ctx, tex.plus, p.x + p.w - 13, y + h / 2, 0.34);
  }
  text(ctx, '⚙', W - 16, y + h / 2, 26, '#9fb2c6', 'right');
}

const NAV_TABS = [
  { kind: 'shop', img: 'navShop', lbl: '商店' },
  { kind: 'craft', img: 'navCraft', lbl: '锻造' },
  { kind: 'fight', img: 'navFight', lbl: '战斗' },
  { kind: 'hero', img: 'navHero', lbl: '英雄' },
  { kind: 'castle', img: 'navCastle', lbl: '城堡' }
];

function drawBottomNav(ctx, tex, active, hot) {
  const y = H - 92;
  roundRect(ctx, 0, y, W, 92, 0, '#0d151e');
  ctx.fillStyle = 'rgba(120,170,235,0.35)';
  ctx.fillRect(0, y, W, 2);
  const step = W / NAV_TABS.length;
  NAV_TABS.forEach((t, i) => {
    const cx = step * (i + 0.5), cy = y + 44;
    const on = t.kind === active;
    if (on) roundRect(ctx, cx - 40, cy - 34, 80, 68, 12, 'rgba(63,149,224,0.22)', '#3f95e0', 2);
    const img = tex[t.img];
    if (img) drawIcon(ctx, img, cx, cy - 6, on ? 0.46 : 0.38, on ? 1 : 0.72);
    text(ctx, t.lbl, cx, y + 74, 12, on ? '#9fd0ff' : '#6f8398', 'center');
    if (hot && !on) hot.push({ x: cx - 72, y, w: 144, h: 92, act: 'nav', kind: t.kind });
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
  roundRect(ctx, (W - w) / 2, H - 210, w, 52, 10, 'rgba(12,20,28,0.92)', '#4a7fb5', 2);
  text(ctx, msg, W / 2, H - 184, 18, '#ffe9a8', 'center');
  ctx.restore();
}





