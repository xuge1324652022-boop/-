#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""已审核公开示例图片的联系表，固定输出到仓库 tmp/contact-sheets/。

python scripts/_contact-sheet.py [all|photos|posters]
复用公开 manifest 的动态编号清单；生成前校验哈希、尺寸及元数据，
不读取私人图片或目录，不改动 public 中的原文件。
"""
from __future__ import annotations

import argparse
from importlib import import_module
from pathlib import Path
import sys

from PIL import Image, ImageDraw

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
portfolio = import_module("build-portfolio-images")
PHOTO_DIR = portfolio.PHOTO_DIR
MAPPING = portfolio.MAPPING
OUTPUT = ROOT / "tmp/contact-sheets"
COLS, CELL_W, CELL_H, PAD, LABEL = 6, 300, 220, 10, 22


def sheet(items: list[dict], output: Path, title: str) -> None:
    if not items:
        raise ValueError("公开清单中没有对应分组的示例图片")
    rows = (len(items) + COLS - 1) // COLS
    canvas = Image.new("RGB", (COLS * CELL_W + PAD * (COLS + 1),
                               rows * (CELL_H + LABEL) + PAD * (rows + 1) + 34), (245, 245, 243))
    draw = ImageDraw.Draw(canvas)
    draw.text((PAD, 10), f"{title} ({len(items)})", fill=(20, 20, 20))
    for index, item in enumerate(items):
        # src 来自已经核验的公开 manifest 中的 1600 档。
        with Image.open(ROOT / item["src"]) as source:
            image = source.convert("RGB")
        image.thumbnail((CELL_W, CELL_H), Image.Resampling.LANCZOS)
        x = PAD + (index % COLS) * (CELL_W + PAD)
        y = 34 + PAD + (index // COLS) * (CELL_H + LABEL + PAD)
        canvas.paste(image, (x + (CELL_W - image.width) // 2, y + (CELL_H - image.height) // 2))
        draw.text((x + 3, y + CELL_H + 4), item["id"], fill=(40, 40, 40))
    if output.is_symlink() or output.resolve().parent != OUTPUT.resolve():
        raise ValueError("联系表输出不能离开仓库 tmp/contact-sheets")
    canvas.save(output)
    print(f"已生成：{output.relative_to(ROOT).as_posix()}，{canvas.width}×{canvas.height}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("group", choices=("all", "photos", "posters"), default="all", nargs="?")
    args = parser.parse_args()
    if portfolio.report(portfolio.load_manifest_images(PHOTO_DIR),
                        expected_ids={item["id"] for item in MAPPING}):
        return 1
    if (ROOT / "tmp").is_symlink() or OUTPUT.is_symlink() or not OUTPUT.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError("联系表目录不能通过符号链接离开仓库")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for group in ("photos", "posters"):
        if args.group in ("all", group):
            sheet([item for item in MAPPING if item["group"] == group],
                  OUTPUT / f"portfolio-contact-{group}.png", group.upper())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
