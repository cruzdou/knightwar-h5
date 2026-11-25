/* =========================================================================
   抖音小游戏运行环境适配（adapter.js）
   -------------------------------------------------------------------------
   引擎本身还是那套 canvas 2D 代码，这里只负责把浏览器 API 换成小游戏的：
   - window / document：最小壳子（getElementById('game') 返回 tt.createCanvas()）
   - Image：直接用 tt.createImage()（原生支持包内相对路径 + onload/onerror）
   - fetch：包内文件走 FileSystemManager.readFile('utf8')，远程走 tt.request
   - requestAnimationFrame：setTimeout(16ms)
   - AudioContext 不提供 → main.js 会自动跳过解码，playSfx 静默

   注意：这个文件只在构建产物 build/minigame/game.js 里被拼在业务脚本之前，
   H5 的 index.html 不加载它。
   ========================================================================= */
(function (g) {
  if (typeof g.document !== 'undefined' && typeof g.window !== 'undefined') return;   // 已经在浏览器里
  const tt = g.tt;
  if (!tt) return;

  g.window = g;
  g.self = g;
  g.GameGlobal = g;

  const canvas = tt.createCanvas();
  const stubEl = () => ({
    style: {}, textContent: '', innerHTML: '',
    appendChild() {}, removeChild() {}, querySelector() { return null; },
    addEventListener() {}, focus() {}, remove() {}
  });

  g.document = {
    body: stubEl(),
    createElement(tag) {
      if (tag === 'canvas') return tt.createCanvas();
      if (tag === 'img' || tag === 'image') return tt.createImage();
      return stubEl();
    },
    getElementById(id) { return id === 'game' ? canvas : null; },
    querySelector() { return null; },
    addEventListener() {}
  };

  g.location = { search: '', href: '', protocol: 'https:', hash: '' };
  if (!g.performance) g.performance = { now() { return Date.now(); } };
  g.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
  g.cancelAnimationFrame = id => clearTimeout(id);
  g.setTimeout = g.setTimeout || setTimeout;
  g.clearTimeout = g.clearTimeout || clearTimeout;

  // tt.createImage 原生支持包内相对路径，直接返回即可，不要包一层 src 代理
  g.Image = function () { return tt.createImage(); };

  if (!g.URLSearchParams) {
    g.URLSearchParams = function () { this.get = function () { return null; }; };
  }
  if (!g.navigator) g.navigator = {};
  if (!g.navigator.clipboard) g.navigator.clipboard = { writeText() { return Promise.reject(new Error('mini')); } };

  g.fetch = function (url) {
    return new Promise((resolve, reject) => {
      const ok = data => ({
        ok: true,
        status: 200,
        text: () => Promise.resolve(typeof data === 'string' ? data : ''),
        json: () => { try { return Promise.resolve(typeof data === 'string' ? JSON.parse(data) : data); } catch (e) { return Promise.reject(e); } },
        arrayBuffer: () => Promise.resolve(data)
      });
      if (/^https?:/i.test(url)) {
        tt.request({
          url,
          responseType: 'arraybuffer',
          success: r => resolve(ok(r.data)),
          fail: err => reject(new Error('request fail: ' + (err && err.errMsg)))
        });
      } else if (tt.getFileSystemManager) {
        tt.getFileSystemManager().readFile({
          filePath: url,
          encoding: 'utf8',
          success: r => resolve(ok(r.data)),
          fail: err => reject(new Error('readFile fail: ' + (err && err.errMsg)))
        });
      } else {
        reject(new Error('no file system'));
      }
    });
  };
})(typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis);
