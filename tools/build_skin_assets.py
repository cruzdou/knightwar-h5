# -*- coding: utf-8 -*-
"""
把 CraftPix《Castle Guards》素材包（AI/EPS/PNG/Spine）转成本工程可用的 webp：
  1) UI 单图  -> assets/skin/*.webp
  2) 战场背景 -> assets/bg/ga*.webp
  3) 角色逐帧 -> assets/anim/<unit>_<anim>.webp（横向条带）+ assets/anim/index.json
用法：
  python tools/build_skin_assets.py "E:\Downloads\CastleGuards"
"""
import json
import os
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else r"E:\Downloads\CastleGuards"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
os.makedirs(os.path.join(OUT, "skin"), exist_ok=True)
os.makedirs(os.path.join(OUT, "bg"), exist_ok=True)
os.makedirs(os.path.join(OUT, "anim"), exist_ok=True)

PNG = os.path.join(SRC, "Png")

# ---------- 1) UI 单图 ----------
UI_MAP = {
    # 面板 / 底图
    "PopUp/Box.png": "sk_panel_box.png",
    "PopUp/Bg_Light.png": "sk_panel_light.png",
    "PopUp/Bonus_Box.png": "sk_bonus_box.png",
    "PopUp/Booster_Box.png": "sk_booster_box.png",
    "PopUp/Lose_Box.png": "sk_lose_box.png",
    "PopUp/Paused_Box.png": "sk_paused_box.png",
    "PopUp/Upgrade_PopUp_Box.png": "sk_upgrade_box.png",
    "PopUp/Wind_Box.png": "sk_wind_box.png",
    "PopUp/Ads_Icon.png": "sk_ads_icon.png",
    # 按钮
    "PopUp/Btn_Green.png": "sk_btn_green.png",
    "PopUp/Btn_Green_P.png": "sk_btn_green_p.png",
    "PopUp/Btn_Blue.png": "sk_btn_blue.png",
    "PopUp/Btn_Blue_P.png": "sk_btn_blue_p.png",
    "PopUp/Btn_Orange.png": "sk_btn_orange.png",
    "PopUp/Btn_Orange_P.png": "sk_btn_orange_p.png",
    "PopUp/Btn_Close.png": "sk_btn_close.png",
    "PopUp/Btn_Close_P.png": "sk_btn_close_p.png",
    # 主界面 / 通用 UI
    "Castel Guard Ui/Screen_BG.png": "sk_screen_bg.png",
    "Castel Guard Ui/Status_BG.png": "sk_status_bg.png",
    "Castel Guard Ui/Top_Title_BG.png": "sk_top_title.png",
    "Castel Guard Ui/Stage_Bar.png": "sk_stage_bar.png",
    "Castel Guard Ui/Gem_Bar.png": "sk_gem_bar.png",
    "Castel Guard Ui/Coin_Bar.png": "sk_coin_bar.png",
    "Castel Guard Ui/Bot_Bar.png": "sk_bot_bar.png",
    "Castel Guard Ui/Home_Slot_Bg.png": "sk_home_slot.png",
    "Castel Guard Ui/Card_Slot.png": "sk_card_slot.png",
    "Castel Guard Ui/Card_Sc_BG.png": "sk_card_bg.png",
    "Castel Guard Ui/Shop_Box1.png": "sk_shop_box1.png",
    "Castel Guard Ui/Shop_Box2.png": "sk_shop_box2.png",
    "Castel Guard Ui/Shop_Blue_Btn.png": "sk_shop_blue.png",
    "Castel Guard Ui/Shop_Blue_Btn_P.png": "sk_shop_blue_p.png",
    "Castel Guard Ui/Shop_Green_Btn.png": "sk_shop_green.png",
    "Castel Guard Ui/Shop_Green_Btn_P.png": "sk_shop_green_p.png",
    "Castel Guard Ui/Small_Green_Btn.png": "sk_small_green.png",
    "Castel Guard Ui/Small_Green_Btn_P.png": "sk_small_green_p.png",
    "Castel Guard Ui/Btn_Play.png": "sk_btn_play.png",
    "Castel Guard Ui/Btn_Play_P.png": "sk_btn_play_p.png",
    "Castel Guard Ui/Btn_Close_Big.png": "sk_btn_close_big.png",
    "Castel Guard Ui/Btn_Close_Big_P.png": "sk_btn_close_big_p.png",
    "Castel Guard Ui/Btn_Settings.png": "sk_btn_settings.png",
    "Castel Guard Ui/Btn_Settings_P.png": "sk_btn_settings_p.png",
    "Castel Guard Ui/Setting_Bg_Box.png": "sk_setting_box.png",
    "Castel Guard Ui/Settings_Bg_Btn.png": "sk_settings_bg_btn.png",
    "Castel Guard Ui/Volume_Bar.png": "sk_volume_bar.png",
    "Castel Guard Ui/Volume_Box.png": "sk_volume_box.png",
    "Castel Guard Ui/Volume_Btn.png": "sk_volume_btn.png",
    "Castel Guard Ui/Star_Empty.png": "sk_star_empty.png",
    "Castel Guard Ui/Star_Filled.png": "sk_star_filled.png",
    "Castel Guard Ui/Icon_Home.png": "sk_icon_home.png",
    "Castel Guard Ui/Icon_Shop.png": "sk_icon_shop.png",
    "Castel Guard Ui/Icon_Challange.png": "sk_icon_challenge.png",
    "Castel Guard Ui/Icon_Achievment.png": "sk_icon_achv.png",
    "Castel Guard Ui/Icon_Card.png": "sk_icon_card.png",
    "Castel Guard Ui/Icon_Hp.png": "sk_icon_hp.png",
    "Castel Guard Ui/Icon_Damage.png": "sk_icon_dmg.png",
    "Castel Guard Ui/Icon_Armor.png": "sk_icon_armor.png",
    "Castel Guard Ui/Icon_At_Speed.png": "sk_icon_speed.png",
    "Castel Guard Ui/Gem_Icon.png": "sk_gem_icon.png",
    "Castel Guard Ui/Achiev_Bg_Bar.png": "sk_achv_bar_bg.png",
    "Castel Guard Ui/Achiev_Fg_Bar.png": "sk_achv_bar_fg.png",
    "Castel Guard Ui/Achiev_Box_Completed.png": "sk_achv_done.png",
    "Castel Guard Ui/Achiev_Box_UnCompleted.png": "sk_achv_undone.png",
    "Castel Guard Ui/Achiev_Btn_Green.png": "sk_achv_btn.png",
    "Castel Guard Ui/Achiev_Btn_Green_P.png": "sk_achv_btn_p.png",
    "Castel Guard Ui/Achiev_Btn_Disable.png": "sk_achv_btn_dis.png",
    "Castel Guard Ui/Achiev_Icon.png": "sk_achv_icon.png",
    "Castel Guard Ui/Tab_Slot_Active1.png": "sk_tab_active1.png",
    "Castel Guard Ui/Tab_Slot_Active2.png": "sk_tab_active2.png",
    "Castel Guard Ui/Tab_Slot_NotActive1.png": "sk_tab_inactive1.png",
    "Castel Guard Ui/Tab_Slot_NotActive2.png": "sk_tab_inactive2.png",
    "Castel Guard Ui/Tab_Bot_Icon_Bg_Active.png": "sk_tab_icon_bg.png",
    "Castel Guard Ui/Shop_Ads_Icon.png": "sk_shop_ads_icon.png",
    "Castel Guard Ui/Get_Gems_Ads.png": "sk_get_gems_ads.png",
    "Castel Guard Ui/Load_Bar_BG.png": "sk_load_bar_bg.png",
    "Castel Guard Ui/Load_Bar_FG.png": "sk_load_bar_fg.png",
    "Castel Guard Ui/Load_Sc_Bg.png": "sk_load_sc_bg.png",
    "Castel Guard Ui/Castel_Guards_Logo.png": "sk_logo.png",
    # HUD / 战斗
    "Hud and Gameplay Area/Castle.png": "sk_castle.png",
    "Hud and Gameplay Area/Ship.png": "sk_ship.png",
    "Hud and Gameplay Area/Tree.png": "sk_tree.png",
    "Hud and Gameplay Area/Tree2.png": "sk_tree2.png",
    "Hud and Gameplay Area/Bg_Bot_Hud.png": "sk_bottom_hud.png",
    "Hud and Gameplay Area/Coin_Icon.png": "sk_coin_icon.png",
    "Hud and Gameplay Area/Exp_Icon.png": "sk_exp_icon.png",
    "Hud and Gameplay Area/Exp_Bar_Bg.png": "sk_exp_bg.png",
    "Hud and Gameplay Area/Exp_Bar_Fg.png": "sk_exp_fg.png",
    "Hud and Gameplay Area/Hp_Bar_Bg.png": "sk_hp_bg.png",
    "Hud and Gameplay Area/Hp_Bar_Fg.png": "sk_hp_fg.png",
    "Hud and Gameplay Area/Coin_Persec_Bar_Bg.png": "sk_cps_bg.png",
    "Hud and Gameplay Area/Coin_Persec_Bar_Fg.png": "sk_cps_fg.png",
    "Hud and Gameplay Area/Slot_Tab_Active.png": "sk_slot_active.png",
    "Hud and Gameplay Area/Slot_Tab_DeActive.png": "sk_slot_inactive.png",
    "Hud and Gameplay Area/Tower_Bg.png": "sk_tower_bg.png",
    "Hud and Gameplay Area/Btn_Pause.png": "sk_btn_pause.png",
    "Hud and Gameplay Area/Btn_Pause_P.png": "sk_btn_pause_p.png",
    "Hud and Gameplay Area/Btn_Up_Coin.png": "sk_btn_up_coin.png",
    "Hud and Gameplay Area/Btn_Up_Coin_P.png": "sk_btn_up_coin_p.png",
    "Hud and Gameplay Area/Arrow_Up_Tower.png": "sk_arrow_up.png",
    # 塔升级
    "Tower Upgrades/Base.png": "sk_tower_base.png",
    "Tower Upgrades/Tower_Lv0.png": "sk_tower_lv0.png",
    "Tower Upgrades/Tower_Lv1.png": "sk_tower_lv1.png",
    "Tower Upgrades/Tower_Lv2.png": "sk_tower_lv2.png",
    "Tower Upgrades/Tower_Lv3.png": "sk_tower_lv3.png",
    "Tower Upgrades/Tower_Lv4.png": "sk_tower_lv4.png",
    "Tower Upgrades/Tower_Lv5.png": "sk_tower_lv5.png",
    "Tower Upgrades/Up_Notif.png": "sk_up_notif.png",
    # 弹道 / 特效单图
    "Projectile and IceFx/Arrow.png": "sk_arrow.png",
    "Projectile and IceFx/Arrow_Fire.png": "sk_arrow_fire.png",
    "Projectile and IceFx/Arrow_Ice.png": "sk_arrow_ice.png",
    "Projectile and IceFx/Axe1.png": "sk_axe1.png",
    "Projectile and IceFx/Axe2.png": "sk_axe2.png",
    "Projectile and IceFx/Ice_Fx.png": "sk_ice_fx.png",
    "Projectile and IceFx/Mage_Fireball.png": "sk_fireball.png",
}

for src, dst in UI_MAP.items():
    p = os.path.join(PNG, src)
    if not os.path.exists(p):
        print("缺文件:", src)
        continue
    im = Image.open(p).convert("RGBA")
    im.save(os.path.join(OUT, "skin", dst.replace(".png", ".webp")), "WEBP", quality=88, method=6)

# 商店图 / 关卡区域图 / 加速道具图标
for i in range(1, 7):
    p = os.path.join(PNG, "Castel Guard Ui", "Shop_Image%d.png" % i)
    if os.path.exists(p):
        Image.open(p).convert("RGBA").save(os.path.join(OUT, "skin", "sk_shop%d.webp" % i), "WEBP", quality=85, method=6)
for i in range(1, 6):
    p = os.path.join(PNG, "Castel Guard Ui", "Area%d.png" % i)
    if os.path.exists(p):
        Image.open(p).convert("RGBA").save(os.path.join(OUT, "skin", "sk_area%d.webp" % i), "WEBP", quality=85, method=6)
for i in range(1, 11):
    p = os.path.join(PNG, "Booster Icons", "Booster_Icon_%d.png" % i)
    if os.path.exists(p):
        Image.open(p).convert("RGBA").save(os.path.join(OUT, "skin", "sk_booster%d.webp" % i), "WEBP", quality=88, method=6)
# 兵种卡片（启用态）
for f in os.listdir(os.path.join(PNG, "Army Cards", "Enable")):
    if f.lower().endswith(".png"):
        im = Image.open(os.path.join(PNG, "Army Cards", "Enable", f)).convert("RGBA")
        im.save(os.path.join(OUT, "skin", "sk_card_" + f.lower().replace(".png", ".webp")), "WEBP", quality=85, method=6)

# ---------- 2) 战场背景 ----------
for i in range(1, 11):
    p = os.path.join(PNG, "Gameplay Backgrounds", "Ga%d.png" % i)
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGB")
    im = im.resize((1024, int(1024 * im.height / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, "bg", "ga%d.webp" % i), "WEBP", quality=80, method=6)

# ---------- 3) 角色逐帧 ----------
ARMY_CLASSES = ["Archer", "Assasin", "Axeman", "Executor", "Horseman",
                "Ice Archer", "Knight", "Mage", "Paretorian", "Warrior"]
ANIM_MAP = {"Idle": "idle", "Walk": "walk", "Attack": "attack",
            "Special Attack": "special", "Dead": "dead"}
SAMPLE_EVERY = 2          # 隔帧取样，体积减半，动作看不出差别
FPS = 15

index = {}


def strip(files, w, h):
    n = len(files)
    cv = Image.new("RGBA", (w * n, h), (0, 0, 0, 0))
    for i, f in enumerate(files):
        cv.paste(Image.open(f).convert("RGBA"), (i * w, 0))
    return cv


def build_unit(unit_id, base_dir):
    anims = {}
    w = h = None
    for d in sorted(os.listdir(base_dir)):
        sub = os.path.join(base_dir, d)
        if not os.path.isdir(sub) or d not in ANIM_MAP:
            continue
        files = sorted(f for f in os.listdir(sub) if f.lower().endswith(".png"))[::SAMPLE_EVERY]
        if not files:
            continue
        im0 = Image.open(os.path.join(sub, files[0]))
        w, h = im0.size
        cv = strip([os.path.join(sub, f) for f in files], w, h)
        name = ANIM_MAP[d]
        out = "%s_%s.webp" % (unit_id, name)
        cv.save(os.path.join(OUT, "anim", out), "WEBP", quality=72, method=6)
        anims[name] = {"file": out, "frames": len(files)}
    if anims:
        index[unit_id] = {"w": w, "h": h, "fps": FPS, "anims": anims}


for cls in ARMY_CLASSES:
    for lv in range(4):
        d = os.path.join(PNG, "Army", cls, "Lv%d" % lv)
        if os.path.isdir(d):
            build_unit("%s_lv%d" % (cls.lower().replace(" ", "_"), lv), d)
for i in range(1, 16):
    d = os.path.join(PNG, "Enemies", "E%d" % i)
    if os.path.isdir(d):
        build_unit("e%d" % i, d)

# 特效逐帧
for src, uid in [("Fire Burn Fx", "fx_fire"), ("Heal Fx", "fx_heal"), ("Hit Fx/Fx1", "fx_hit1"),
                 ("Hit Fx/Fx2", "fx_hit2"), ("Ship", "fx_ship"), ("Up Notif", "fx_up")]:
    d = os.path.join(PNG, src)
    if not os.path.isdir(d):
        continue
    files = sorted(f for f in os.listdir(d) if f.lower().endswith(".png"))[::2]
    if not files:
        continue
    im0 = Image.open(os.path.join(d, files[0]))
    cv = strip([os.path.join(d, f) for f in files], *im0.size)
    out = uid + ".webp"
    cv.save(os.path.join(OUT, "anim", out), "WEBP", quality=72, method=6)
    index[uid] = {"w": im0.size[0], "h": im0.size[1], "fps": FPS, "anims": {"loop": {"file": out, "frames": len(files)}}}

with open(os.path.join(OUT, "anim", "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, separators=(",", ":"))

total = 0
for root, _, fs in os.walk(OUT):
    for f in fs:
        if f.endswith(".webp"):
            total += os.path.getsize(os.path.join(root, f))
print("完成，webp 合计 %.1f MB，单位数 %d" % (total / 1048576.0, len(index)))
