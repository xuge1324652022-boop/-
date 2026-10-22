#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把 `作品/摄影-照片/` 与 `作品/海报-设计/八一-个人练习海报/` 里的**36 张原图**生成网页尺寸版本。

    · 作品/摄影-照片/  26 张
    · 作品/海报-设计/八一-个人练习海报/  10 张

为什么需要它：原图是 1.6–27 MB 的相机直出 JPEG（最长边 5000–8000 px），
直接放上网页会让首屏拖到十几秒。这里一次性生成三档 WebP：

    public/portfolio/<id>-400.webp    缩略图（查看器的缩略图导航 / 目录预览）
    public/portfolio/<id>-1600.webp   默认展示（列表 / 作品带 / 展开区 / 画廊）
    public/portfolio/<id>-2560.webp   大图查看器（点击后才加载）

硬约束（方案原文）：
  · **校正图片方向** —— 按 EXIF Orientation 摆正（竖拍照片很多带 Orientation=6）；
  · **转换 sRGB** —— 统一色彩空间，避免某些浏览器把 AdobeRGB 当 sRGB 读出色偏；
  · **等比例缩放** —— 只按比例缩，绝不裁切（海报裁成 16:9 会切掉标题）；
  · **不放大** —— 原图比目标小就原样输出，不插值放大；
  · **不覆盖原图** —— 只往 `public/portfolio/` 写，源目录只读；
  · 竖图**宽和高都不超过目标尺寸**（即 `thumbnail()` 语义：最长边 ≤ 目标）。

用法：
    python scripts/build-portfolio-images.py --probe     # 只读：打印真实尺寸 / EXIF / 是否需旋转
    python scripts/build-portfolio-images.py             # 生成 400 / 1600 / 2560 三档 WebP
    python scripts/build-portfolio-images.py --quality 86
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

# Windows 控制台默认不是 UTF-8，中文标题会直接抛 UnicodeEncodeError
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # pragma: no cover - 非 Windows / 已重定向
    pass

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "portfolio"

# 只更新原片所在目录，网页 id 与 public/portfolio 的资源地址保持稳定。
PHOTO_DIR = "作品/摄影-照片"
# 实习产出是另一组素材，不自动扫描或混入现有的个人练习海报清单。
POSTER_DIR = "作品/海报-设计/八一-个人练习海报"

# ---------------------------------------------------------------------------
# 素材映射表：id ↔ 原始文件（**全量 36 项**）
#
# ⚠️ 这是**唯一**一处把网页用的 id 和磁盘上的原图对起来的地方。
#    原图文件名是中文、目录名也是中文，散落到组件里迟早会因为改名而断链；
#    集中在这里之后，换素材 = 改一行。
#
# ⚠️ 清单是**显式**的，不自动扫描目录：`作品/摄影-照片/` 下 26 张、`POSTER_DIR`
#    下 10 张，自动列目录会把以后随手丢进来的新图静默上线。数量判据写在
#    `assertCollectionCoverage()`（26 / 10），改清单必须同步改那里。
#
# ⚠️ 已存在的 11 个 id **保持不变**（网页资源路径 = `<id>-1600.webp`，
#    改 id 等于让所有引用断链）。特别是：
#      · 滕王阁.jpg      → `pavilion-photo`（/about 04 屏的摄影原片）
#      · 银杏路 (3).jpg  → `ginkgo-road`  （/photo 精选序列里的那一张）
#    银杏路四张是**四个独立作品**，各有各的 id，不能按共同名称去重。
#
# 分组（与 `src/data/visualPortfolio.ts` 一一对应）：
#   ① 八张精选 —— `/about` 03 摄影 / 04 版面 / 05 系列三屏用，判据写死在
#      `assertVisuals()`（3 / 2 / 3 / 8），**不要动**；
#   ② 三张补入 —— `/photo` 横向精选序列用（与 ① 的三张摄影合计 6 张）；
#   ③ 摄影完整集合其余 20 张 —— `/photo` 完整画廊用；
#   ④ 海报完整集合其余 6 张 —— `/poster` 系列浏览与完整目录用。
#
# 清单顺序**不是**页面叙事顺序：叙事顺序在 `photoPage.ts` / `posterPage.ts`。
# ---------------------------------------------------------------------------
MAPPING: list[dict[str, str]] = [
    # ---- ① 八张精选（/about）----
    {"id": "mountain-cloud", "title": "山云", "src": f"{PHOTO_DIR}/山云.jpg"},
    {"id": "sky-mirror", "title": "天空之镜", "src": f"{PHOTO_DIR}/天空之镜.jpg"},
    {"id": "cave", "title": "盗墓笔记", "src": f"{PHOTO_DIR}/盗墓笔记.jpg"},
    {"id": "pavilion-photo", "title": "滕王阁", "src": f"{PHOTO_DIR}/滕王阁.jpg"},
    {"id": "pavilion-cover", "title": "千年楼阁", "src": f"{POSTER_DIR}/千年楼阁.jpg"},
    {"id": "mbt-2000", "title": "MBT-2000", "src": f"{POSTER_DIR}/MBT-2000.jpg"},
    {"id": "plz-05", "title": "PLZ-05榴", "src": f"{POSTER_DIR}/PLZ-05榴.jpg"},
    {"id": "plz-02", "title": "PLZ-02轮", "src": f"{POSTER_DIR}/PLZ-02轮.jpg"},
    # ---- ② /photo 精选序列补入三张 ----
    {"id": "sunward", "title": "向阳", "src": f"{PHOTO_DIR}/向阳.jpg"},
    {"id": "daylight", "title": "天光", "src": f"{PHOTO_DIR}/天光.jpg"},
    {"id": "ginkgo-road", "title": "银杏路 (3)", "src": f"{PHOTO_DIR}/银杏路 (3).jpg"},
    # ---- ③ 摄影完整集合其余 20 张 ----
    {"id": "annual-review-2025", "title": "2025年度总结", "src": f"{PHOTO_DIR}/2025年度总结.jpg"},
    {"id": "binglang-valley", "title": "槟榔谷", "src": f"{PHOTO_DIR}/槟榔谷.jpg"},
    {"id": "urban-village", "title": "城中村", "src": f"{PHOTO_DIR}/城中村.jpg"},
    {"id": "guyong-city", "title": "古庸城", "src": f"{PHOTO_DIR}/古庸城.jpg"},
    {"id": "seaside-sunset", "title": "海边落日", "src": f"{PHOTO_DIR}/海边落日.jpg"},
    {"id": "purple-leaf-plum", "title": "红叶李", "src": f"{PHOTO_DIR}/红叶李.jpg"},
    {"id": "road-to-city", "title": "进城之路", "src": f"{PHOTO_DIR}/进城之路.jpg"},
    {"id": "mazu-overlooking-sea", "title": "妈祖望海", "src": f"{PHOTO_DIR}/妈祖望海.jpg"},
    {"id": "old-village-walk", "title": "漫步老村", "src": f"{PHOTO_DIR}/漫步老村.jpg"},
    {"id": "qingri-molun", "title": "青日摩伦", "src": f"{PHOTO_DIR}/青日摩伦.jpg"},
    {"id": "zhangjiajie-mountains", "title": "青山张家界", "src": f"{PHOTO_DIR}/青山张家界.jpg"},
    {"id": "mountain-bird", "title": "山鸟", "src": f"{PHOTO_DIR}/山鸟.jpg"},
    {"id": "pavilion-photo-2", "title": "滕王阁2", "src": f"{PHOTO_DIR}/滕王阁2.jpg"},
    {"id": "campus", "title": "校园", "src": f"{PHOTO_DIR}/校园.jpg"},
    {"id": "ginkgo-road-1", "title": "银杏路 (1)", "src": f"{PHOTO_DIR}/银杏路 (1).jpg"},
    {"id": "ginkgo-road-2", "title": "银杏路 (2)", "src": f"{PHOTO_DIR}/银杏路 (2).jpg"},
    {"id": "ginkgo-road-4", "title": "银杏路4", "src": f"{PHOTO_DIR}/银杏路4.jpg"},
    {"id": "zhangyuan-panorama", "title": "张院全景", "src": f"{PHOTO_DIR}/张院全景.jpg"},
    {"id": "tall-tree", "title": "长树", "src": f"{PHOTO_DIR}/长树.jpg"},
    # ---- ④ 海报完整集合其余 6 张 ----
    {"id": "aft-09", "title": "AFT-09", "src": f"{POSTER_DIR}/AFT-09.jpg"},
    {"id": "pg4-04a", "title": "PG4-04A", "src": f"{POSTER_DIR}/PG4-04A.jpg"},
    {"id": "pgz-09", "title": "PGZ-09高", "src": f"{POSTER_DIR}/PGZ-09高.jpg"},
    {"id": "ztz-59", "title": "ZTZ-59式", "src": f"{POSTER_DIR}/ZTZ-59式.jpg"},
    {"id": "ztz-96a", "title": "ZTZ-96A", "src": f"{POSTER_DIR}/ZTZ-96A.jpg"},
    {"id": "ztz-96", "title": "ZTZ96式", "src": f"{POSTER_DIR}/ZTZ96式.jpg"},
]

# 只属于 `/about` 八张精选的 id —— 生成后用于打印分组小结，避免以后有人
# 把补入的素材误当成「精选」写进 `assertVisuals` 的判据。
CURATED_IDS = {
    "mountain-cloud",
    "sky-mirror",
    "cave",
    "pavilion-photo",
    "pavilion-cover",
    "mbt-2000",
    "plz-05",
    "plz-02",
}

# 摄影 / 海报两组的**期望数量**：与 `assertCollectionCoverage()` 是同一组判据。
EXPECT_PHOTO = 26
EXPECT_POSTER = 10

# 三档目标尺寸（最长边上限，宽高都不超过）
#   400  → 缩略图导航 / 精选目录的小预览（几十 KB，一次列 6 张也不心疼）
#   1600 → 默认展示（列表 / 作品带 / 展开区 / 画廊）
#   2560 → 大图查看器（点开才加载）
# ⚠️ 加档位时同步改 `src/data/visualPortfolio.ts` 的 `asset()`（那里拼路径）。
SIZES = (400, 1600, 2560)


def load_srgb(path: Path) -> Image.Image:
    """
    读图 → 摆正方向 → 转 sRGB。

    ⚠️ 必须用 `exif_transpose` 而不是读 `Orientation` 自己转：它同时会**清掉**
    EXIF 里的 Orientation 标记。只转像素不清标记的话，浏览器会再转一次，
    竖图就横过来了（或者反过来）。
    """
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        # 相机直出常见 CMYK / 带 alpha 的 PNG；统一到 RGB 再谈 sRGB 配置
        img = img.convert("RGB")
    # `ImageCms` 只有在原图带 ICC 描述文件时才有意义；没有就当作已经是 sRGB
    icc = img.info.get("icc_profile")
    if icc:
        try:
            from io import BytesIO

            from PIL import ImageCms

            src_profile = ImageCms.ImageCmsProfile(BytesIO(icc))
            dst_profile = ImageCms.createProfile("sRGB")
            img = ImageCms.profileToProfile(img, src_profile, dst_profile, outputMode="RGB")
        except Exception as exc:  # 坏 ICC / 不支持的色彩空间：不阻断，如实报告
            print(f"    ! ICC 转换失败（按原样继续）：{exc}")
    return img


def probe() -> int:
    print(f"{'id':<16}{'标题':<26}{'原图尺寸':<14}{'EXIF':<7}{'摆正后':<14}文件大小")
    print("-" * 96)
    rows = []
    for item in MAPPING:
        path = ROOT / item["src"]
        if not path.exists():
            print(f"{item['id']:<16}{item['title']:<26}** 缺失：{item['src']} **")
            return 1
        raw = Image.open(path)
        exif_orientation = raw.getexif().get(0x0112, 1)
        img = load_srgb(path)
        rows.append(
            {
                "id": item["id"],
                "title": item["title"],
                "src": item["src"],
                "raw": f"{raw.width}×{raw.height}",
                "exif": exif_orientation,
                "upright": f"{img.width}×{img.height}",
                "bytes": path.stat().st_size,
            }
        )
        print(
            f"{item['id']:<16}{item['title']:<26}"
            f"{raw.width}×{raw.height}".ljust(14 + 26 + 16)
            + f"{exif_orientation:<7}{img.width}×{img.height}".ljust(14)
            + f"{path.stat().st_size / 1e6:.1f} MB"
        )
    print("-" * 96)
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    return 0


def build(quality: int) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for item in MAPPING:
        path = ROOT / item["src"]
        if not path.exists():
            print(f"** 缺失：{item['src']} **")
            return 1
        img = load_srgb(path)
        print(f"\n{item['id']}  {item['title']}")
        print(f"  原图 {path.stat().st_size / 1e6:.1f} MB · 摆正后 {img.width}×{img.height}")
        for size in SIZES:
            out = img.copy()
            # thumbnail() = 最长边缩到 size，**且永不放大**、且保持比例。
            # 竖图自然满足「宽和高都不超过 size」。
            out.thumbnail((size, size), Image.LANCZOS)
            dest = OUT_DIR / f"{item['id']}-{size}.webp"
            out.save(dest, format="WEBP", quality=quality, method=6)
            kb = dest.stat().st_size / 1024
            total += dest.stat().st_size
            note = "（原图更小，未放大）" if (out.width, out.height) == (img.width, img.height) else ""
            print(f"  → {dest.name:<28} {out.width}×{out.height}  {kb:6.0f} KB {note}")
    photo_n = sum(1 for it in MAPPING if it["src"].startswith(PHOTO_DIR))
    poster_n = len(MAPPING) - photo_n
    print(f"\n合计 {len(MAPPING)} 项（摄影 {photo_n} · 海报 {poster_n}）"
          f" × {len(SIZES)} 档 = {len(MAPPING) * len(SIZES)} 个文件 · {total / 1e6:.1f} MB → public/portfolio/")
    if photo_n != EXPECT_PHOTO or poster_n != EXPECT_POSTER:
        print(f"** 数量不符：期望 摄影 {EXPECT_PHOTO} / 海报 {EXPECT_POSTER} **")
        return 1
    return 0


def frontend_ids() -> set[str]:
    """
    从 `src/data/visualPortfolio.ts` 抽出前端登记的 id 集合。

    ⚠️ 为什么要有这一步：本文件的 `MAPPING` 是 **id ↔ 原始文件** 的唯一真相
        （原图是中文名，只有这里知道），前端则从 id 派生三档 URL。两边一旦
        不同步，症状是**静默**的 —— 前端多一个 id 就是 404 的图，前端少一个
        id 就是「生成了但没人用」，两者都不会让构建失败。

    ⚠️ 前端每条素材都走同一个工厂 `visual('id', title, w, h, alt, note?)`，
        id 是**第一个位置参数**、单独一行、四个空格缩进（`^    'x',$`）。
        这里只截取 `photoCollection` / `posterCollection` 两个数组字面量来扫，
        免得扫到别处同形状的字符串数组。
    ⚠️ 抓不到就返回空集合并由调用方报错，**不静默通过**（正则失效要响）。
    """
    path = ROOT / "src" / "data" / "visualPortfolio.ts"
    if not path.exists():
        return set()
    text = path.read_text(encoding="utf-8")
    start = text.find("export const photoCollection")
    end = text.find("const visualIndex")
    if start < 0 or end <= start:
        return set()
    return set(re.findall(r"^\s{4}'([a-z0-9-]+)',$", text[start:end], flags=re.M))


def verify() -> int:
    """
    只读核对：源路径存在、108 个输出文件存在、输出与**摆正后**源图比例一致、
    以及**前后端两份清单的 id 集合完全相等**。

    ⚠️ 前端 `visualPortfolio.ts` 里的 `width/height` 是**摆正后**的原始像素 ——
        这个模式就是用来核对那一对数字的（避免手工抄错）。
    ⚠️ 比例判据按 **1% 容差**：缩略是等比的，允许 ±1px 的取整误差。
    """
    bad: list[str] = []
    seen_ids: set[str] = set()
    photo_n = 0
    poster_n = 0
    for item in MAPPING:
        pid = item["id"]
        if pid in seen_ids:
            bad.append(f"id 重复：{pid}")
        seen_ids.add(pid)
        if item["src"].startswith(PHOTO_DIR):
            photo_n += 1
        else:
            poster_n += 1

        path = ROOT / item["src"]
        if not path.exists():
            bad.append(f"源文件缺失：{item['src']}")
            continue
        img = load_srgb(path)
        src_ratio = img.width / img.height
        for size in SIZES:
            dest = OUT_DIR / f"{pid}-{size}.webp"
            if not dest.exists():
                bad.append(f"输出缺失：{dest.name}")
                continue
            out = Image.open(dest)
            ratio = out.width / out.height
            if abs(ratio - src_ratio) > 0.01:
                bad.append(
                    f"{dest.name} 比例不符：{out.width}×{out.height} vs 摆正后 {img.width}×{img.height}"
                )
            if out.width > size or out.height > size:
                bad.append(f"{dest.name} 超过 {size} 档上限：{out.width}×{out.height}")

    if photo_n != EXPECT_PHOTO:
        bad.append(f"摄影应为 {EXPECT_PHOTO} 张，实为 {photo_n}")
    if poster_n != EXPECT_POSTER:
        bad.append(f"海报应为 {EXPECT_POSTER} 张，实为 {poster_n}")

    # 前后端两份清单对账（见 frontend_ids 的注释）
    fe = frontend_ids()
    if not fe:
        bad.append("读不到 src/data/visualPortfolio.ts 的 id（路径变了？正则失效？）")
    else:
        for pid in sorted(seen_ids - fe):
            bad.append(f"{pid} 只在生成脚本清单里，前端没登记 ⇒ 生成了没人用")
        for pid in sorted(fe - seen_ids):
            bad.append(f"{pid} 只在前端清单里，生成脚本没有 ⇒ 网页上会是 404")

    print(
        f"摄影 {photo_n} · 海报 {poster_n} · 源 {len(MAPPING)} · "
        f"输出 {len(MAPPING) * len(SIZES)} · 前端 id {len(fe)}"
    )
    if bad:
        print("\n** 自检失败 **")
        for b in bad:
            print(f"  - {b}")
        return 1
    print("自检通过：源路径齐、输出齐、比例一致、未超档、前后端 id 集合相等。")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", action="store_true", help="只读：打印真实尺寸与 EXIF，不写任何文件")
    ap.add_argument("--verify", action="store_true", help="只读：核对源/输出文件与比例一致性")
    ap.add_argument("--quality", type=int, default=82, help="WebP 质量（默认 82）")
    args = ap.parse_args()
    if args.probe:
        return probe()
    if args.verify:
        return verify()
    return build(args.quality)


if __name__ == "__main__":
    raise SystemExit(main())
