/* =========================================================================
   平台适配层（tt.js）
   -------------------------------------------------------------------------
   H5 与抖音小游戏共用一套业务代码，差异全部收在这里：
   - 存储：小游戏没有 localStorage → 用 tt.getStorageSync/setStorageSync 兜底
   - 分享：tt.shareAppMessage；H5 走 navigator.share / 复制文案
   - 广告：tt.createRewardedVideoAd 包成 Ads.setProvider 需要的签名
   - 震动：tt.vibrateShort（打击感）
   - 尺寸/安全区：tt.getSystemInfoSync 的 screen 与 safeArea

   注意：广告位 ID 必须在抖音开发者后台创建后替换 AD_UNIT_ID，否则真实环境
   拉不到广告会直接 onDone(false) 走「没看完」分支，不会卡流程。
   ========================================================================= */

const TT = {
  raw: window.tt || null,
  isMini: !!(window.tt && window.tt.createRewardedVideoAd),
  platform: (window.tt && window.tt.getSystemInfoSync) ? 'tt' : 'h5',
  adUnitId: 'REPLACE_WITH_AD_UNIT_ID',   // TODO: 后台创建激励视频广告位后替换

  info() {
    try { return (this.raw && this.raw.getSystemInfoSync) ? this.raw.getSystemInfoSync() : null; } catch (e) { return null; }
  },


  // ---------- 分包资源路径 ----------
  // 构建脚本会注入 PKG_MAP = { 'assets/spine/Bandit.png': 'pkg_battle', ... }
  // H5 下没有 PKG_MAP，assetPath 原样返回，行为完全不变。
  _loadedPkgs: {},

  pkgOf(path) {
    const m = window.PKG_MAP;
    return (m && m[path]) || null;
  },

  // 返回当前应使用的真实路径：分包已加载则加前缀
  assetPath(path) {
    const pkg = this.pkgOf(path);
    if (pkg && this._loadedPkgs[pkg]) return 'subpackages/' + pkg + '/' + path;
    return path;
  },

  // 确保 path 所属分包已下载（H5 直接 resolve）
  ensureAsset(path) {
    const pkg = this.pkgOf(path);
    if (!pkg || this.isMini === false || this._loadedPkgs[pkg]) return Promise.resolve();
    if (!this.raw || !this.raw.loadSubpackage) return Promise.resolve();
    if (this._pkgPending && this._pkgPending[pkg]) return this._pkgPending[pkg];
    this._pkgPending = this._pkgPending || {};
    this._pkgPending[pkg] = new Promise(res => {
      this.raw.loadSubpackage({
        name: pkg,
        success: () => { this._loadedPkgs[pkg] = true; res(true); },
        fail: () => { res(false); }
      });
    });
    return this._pkgPending[pkg];
  },

  async loadAllPkgs() {
    const m = window.PKG_MAP || {};
    const names = Object.keys(m).reduce((a, k) => (m[k] && a.indexOf(m[k]) < 0 ? a.concat(m[k]) : a), []);
    await Promise.all(names.map(n => this.ensureAsset(Object.keys(m).find(k => m[k] === n))));
    return names;
  },

  // ---------- 存储 ----------
  // 小游戏里没有 localStorage，这里做一个同名同签名的内存 + tt 存储壳，
  // 让 state.js / ads.js 一行都不用改。
  installStorage() {
    if (typeof window === 'undefined' || window.localStorage || !this.raw) return;
    const raw = this.raw;
    const cache = {};
    const read = k => {
      if (k in cache) return cache[k];
      try { const v = raw.getStorageSync(k); cache[k] = v; return v; } catch (e) { return null; }
    };
    const shim = {
      getItem(k) { const v = read(k); return (v === null || v === undefined || v === '') ? null : String(v); },
      setItem(k, v) { cache[k] = String(v); try { raw.setStorageSync(k, String(v)); } catch (e) { /* 忽略 */ } },
      removeItem(k) { delete cache[k]; try { raw.removeStorageSync(k); } catch (e) { /* 忽略 */ } }
    };
    window.localStorage = shim;
  },

  // ---------- 分享 ----------
  // 返回 true 表示已交给平台，false 表示当前环境不支持（调用方回落复制文案）
  share(opts) {
    const o = Object.assign({ title: '骑士战争 · 原美术重建', query: '' }, opts || {});
    if (this.raw && this.raw.shareAppMessage) {
      try {
        this.raw.shareAppMessage({
          title: o.title,
          desc: o.desc || '',
          imageUrl: o.imageUrl || '',
          query: o.query
        });
        this.haptic();
        return true;
      } catch (e) { return false; }
    }
    if (navigator.share && location.protocol === 'https:') {
      try {
        navigator.share({ title: o.title, text: o.desc || SHARE_TEXT, url: location.href }).catch(() => {});
        return true;
      } catch (e) { return false; }
    }
    return false;
  },

  // ---------- 震动（漏怪撞墙时打手感） ----------
  haptic(heavy) {
    try {
      if (this.raw && this.raw.vibrateShort) this.raw.vibrateShort({ type: heavy ? 'heavy' : 'light' });
    } catch (e) { /* 忽略 */ }
  },

  // ---------- 激励视频 ----------
  // Ads.setProvider 需要的签名：rewarded({ onDone(ok) })
  buildAdProvider() {
    const self = this;
    return {
      rewarded({ onDone }) {
        let ad = null;
        try { ad = self.raw.createRewardedVideoAd({ adUnitId: self.adUnitId }); } catch (e) { onDone(false); return; }
        let finished = false;
        const settle = ok => {
          if (finished) return;
          finished = true;
          try { ad.offClose && ad.offClose(onClose); } catch (e) { /* 忽略 */ }
          try { ad.offError && ad.offError(onErr); } catch (e) { /* 忽略 */ }
          onDone(ok);
        };
        const onClose = res => settle(!!(res && res.isEnded !== false));
        const onErr = () => settle(false);
        try {
          ad.onClose(onClose);
          ad.onError(onErr);
          const p = ad.show();
          if (p && p.catch) {
            p.catch(() => {
              const lp = ad.load && ad.load();
              if (lp && lp.then) lp.then(() => ad.show()).catch(() => settle(false));
              else settle(false);
            });
          }
        } catch (e) { settle(false); }
      }
    };
  },

  // 启动时调用：装存储壳、接广告 provider
  init() {
    this.installStorage();
    if (this.isMini && window.Ads && window.Ads.setProvider) {
      window.Ads.setProvider(this.buildAdProvider());
    }
  }
};

window.TT = TT;
// 尽早装存储壳：state.js 在下面几个 script 里就会 new PlayerState()
TT.init();

