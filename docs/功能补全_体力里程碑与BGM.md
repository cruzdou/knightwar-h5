# 功能补全：体力系统 / 星级里程碑奖励 / 背景音乐

本轮（2026-11-25）补齐三项影响留存与节奏的功能，全部落在 H5 工程本体（抖音小游戏沿用同一份逻辑）。

## 一、体力系统（`src/state.js` + `src/main.js` + `src/ui.js`）
- 存档新增 `staminaMax`（默认 50）、`staminaTs`（恢复计时起点）。
- 规则：进关消耗 5 点；**每 3 分钟恢复 1 点**，离线也恢复（用时间戳补算，`staminaRegen()` 幂等，主循环每帧调用）。
- 进关门槛：`main.startBattle` 先 `Player.spendStamina(5)`，失败则弹 `Popup.open('stamina')` 并中止；Raid（`opts.raid`）走票不扣体力。
- 体力不足弹窗（`ui.drawStamina`）：
  - `看广告 · 回满体力`（受每日 6 次广告上限约束，`Ads.remaining()`）
  - `50 宝石 · 回满体力`（宝石不足自动置灰）
  - 显示剩余恢复倒计时 `下一点体力 mm:ss`。
- 顶栏体力数值随恢复实时变化。

## 二、星级里程碑奖励（`src/select.js`）
- 原实现只画 4 个奖杯 + 硬编码进度条，不可领取。
- 现改为**按本区星数领取**，每区四档、各能领一次：
  - 阈值按本区星数上限等比切（35% / 55% / 75% / 100%），**小区（如 2 关的 Mirkwood，上限 6 星）自动缩放到 2/3/5/6**，不会出现永远领不到的档位。
  - 奖励：800 金币 / 15 宝石 / 2500 金币 / 40 宝石。
  - 卡片状态三态：未达标（灰）、可领取（金边 + “可领取” + 可点）、已领（绿框“已领”）。
  - 进度条按真实星数比例；右上角 `★ 当前 / 上限`。
- 领取记录存 `starClaims[zoneIdx][i]`，防重复领取；领取后有底部提示条（`select.say`）。

## 三、背景音乐（`src/main.js` + `src/ui.js`）
- 复用包内现有 BGM：`Back_Back.mp3`（菜单）、`InGame1`（普通战斗）、`InGame2`（Boss 战）。
- `playMusic(key)` / `stopMusic()` / `refreshMusic()`：`AudioContext` 循环播放，音量 0.22 不压 SFX；`refreshMusic` 按当前场景选曲（Boss 关切成 `bgm_boss`），设置里切开关即时生效。
- 设置面板新增「音乐 开/关」开关行（`Player.musicOn`，入存档），面板高度 420 → 494。

## 四、验证
本地断言（chromium，`_check_stamina.html`）17/17 通过：6 分钟 +2 点与计时推进、上限封顶、扣点成功/不足失败、0 体力不开战并弹面板（按钮 `close/staminaAd/staminaBuy`）、回满、未达标无按钮、达标领取 +800 金币、防重复领取、音乐开关、BGM buffer 加载。冒烟 8 入口（shop/craft/hero/castle/daily/ally/auto 1-1/auto 5-5 win）全部有场景。实机战斗：体力 50 → 45，`_bgmKey = bgm_boss`。

## 五、仍未做（候选下一轮）
离线收益结算、装备出售/背包排序、新手引导、成就系统、排行榜/好友（需后端，建议等抖音接入）。
