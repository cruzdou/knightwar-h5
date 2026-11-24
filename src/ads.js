/* =========================================================================
   广告 / 内购 适配层（ads.js）
   -------------------------------------------------------------------------
   目的：先把「激励视频 / 插屏 / 内购」的调用点、每日次数、奖励发放全部做成
   可运行的功能，真实 SDK 只需要接进下面的 __provider 里，不用改业务代码。

   接真 SDK 的两种方式：
   1) 在 index.html 里加载 SDK，然后：
        Ads.setProvider({
          rewarded: ({onDone, onFail}) => { ... onDone(true) / onDone(false) },
          interstitial: (cb) => {...}
        });
   2) 抖音小游戏：直接用 tt.createRewardedVideoAd，包一层同样签名的对象。
   ========================================================================= */

const ADS_KEY = 'kw2_h5_ads_v1';   // { date: 'YYYY-MM-DD', count: n }

const Ads = {
  dailyMax: 6,          // 每日激励视频次数上限（可按渠道改）
  _provider: null,      // 真实 SDK 适配器；为 null 时走内置模拟广告
  _busy: false,

  setProvider(p) { this._provider = p; },
  hasRealSdk() { return !!this._provider; },

  // ---------- 每日次数 ----------
  _today() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  },
  _state() {
    try {
      const s = JSON.parse(localStorage.getItem(ADS_KEY) || '{}');
      if (s.date === this._today()) return s;
    } catch (e) { /* 忽略 */ }
    return { date: this._today(), count: 0 };
  },
  used() { return this._state().count; },
  remaining() { return Math.max(0, this.dailyMax - this._state().count); },
  _markUsed() {
    const s = this._state();
    s.count++;
    try { localStorage.setItem(ADS_KEY, JSON.stringify(s)); } catch (e) { /* 忽略 */ }
  },

  // ---------- 播放 ----------
  // opts: { title, seconds, onDone(completed), onFail(reason) }
  show(opts) {
    const o = Object.assign({ title: '看广告领奖励', seconds: 4 }, opts || {});
    if (this._busy) return false;
    if (this.remaining() <= 0) { if (o.onFail) o.onFail('daily_limit'); return false; }

    this._busy = true;
    if (this._provider && this._provider.rewarded) {
      // 真实 SDK：返回值约定 true=看完，false=中途退出
      this._provider.rewarded({
        onDone: ok => {
          this._busy = false;
          if (ok) { this._markUsed(); if (o.onDone) o.onDone(true); }
          else if (o.onFail) o.onFail('abort');
        }
      });
      return true;
    }
    this._simulate(o);
    return true;
  },

  _simulate(o) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999', 'background:rgba(0,0,0,0.86)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:"Microsoft YaHei",system-ui,sans-serif', 'color:#fff'
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'width:min(78vw,520px)', 'background:#111a24', 'border:1px solid #33475e',
      'border-radius:14px', 'padding:18px 20px 20px', 'box-sizing:border-box',
      'text-align:center', 'box-shadow:0 12px 40px rgba(0,0,0,0.6)'
    ].join(';');

    const tag = '<div style="font-size:12px;color:#7fc6ff;letter-spacing:1px;margin-bottom:6px">广告位 · 模拟播放（未接 SDK）</div>';
    const title = '<div style="font-size:17px;color:#ffe9a8;margin-bottom:14px">' + o.title + '</div>';
    // 假画面
    const video = '<div style="height:150px;border-radius:10px;background:linear-gradient(135deg,#1c3350,#0d1723 60%,#203a58);display:flex;align-items:center;justify-content:center;font-size:13px;color:#8aa2bb">' +
      'VIDEO ' + o.seconds + 's</div>';
    const barBg = '<div style="height:6px;border-radius:3px;background:#22303f;margin:14px 0 8px;overflow:hidden">' +
      '<div id="ads-bar" style="height:6px;width:0%;background:linear-gradient(90deg,#7fc6ff,#ffe9a8);transition:width .2s linear"></div></div>';
    const hintHtml = '<div id="ads-hint" style="font-size:13px;color:#9fb2c6">播放中… 请勿关闭</div>';
    const btns = '<div style="margin-top:14px;display:flex;gap:10px;justify-content:center">' +
      '<button id="ads-skip" style="flex:1;height:44px;border-radius:10px;border:1px solid #4a5a70;background:#222f3d;color:#9fb2c6;font-size:15px;cursor:pointer">跳过（无奖励）</button>' +
      '<button id="ads-claim" style="flex:1;height:44px;border-radius:10px;border:1px solid #8fc4ff;background:#2f6fb0;color:#fff;font-size:15px;cursor:pointer;opacity:.45" disabled>播放中</button>' +
      '</div>';

    box.innerHTML = tag + title + video + barBg + hintHtml + btns;
    wrap.appendChild(box);
    document.body.appendChild(wrap);

    const bar = box.querySelector('#ads-bar');
    const hint = box.querySelector('#ads-hint');
    const claim = box.querySelector('#ads-claim');
    const skip = box.querySelector('#ads-skip');
    let left = o.seconds, done = false;

    const tick = setInterval(() => {
      left -= 0.2;
      const pct = Math.min(100, (1 - Math.max(0, left) / o.seconds) * 100);
      bar.style.width = pct + '%';
      if (left > 0) { hint.textContent = '播放中… 还需 ' + Math.ceil(left) + ' 秒'; }
      else {
        clearInterval(tick);
        hint.textContent = '播放完成，可以领取奖励';
        claim.disabled = false;
        claim.style.opacity = 1;
        claim.textContent = '领取奖励';
      }
    }, 200);

    const close = () => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); };

    claim.onclick = () => {
      if (claim.disabled || done) return;
      done = true;
      clearInterval(tick);
      close();
      this._busy = false;
      this._markUsed();
      if (o.onDone) o.onDone(true);
    };
    skip.onclick = () => {
      if (done) return;
      done = true;
      clearInterval(tick);
      close();
      this._busy = false;
      if (o.onDone) o.onDone(false);
    };
  }
};

/* 内购占位：接真实支付 SDK 后在这里实现 buy(sku, cb) */
const IAP = {
  _provider: null,
  setProvider(p) { this._provider = p; },
  hasRealSdk() { return !!this._provider; },
  buy(sku, cb) {
    if (this._provider) return this._provider.buy(sku, cb);
    if (cb) cb({ ok: false, reason: 'not_connected', sku: sku });
  }
};

window.Ads = Ads;
window.IAP = IAP;
