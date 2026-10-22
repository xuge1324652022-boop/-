#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 public/portfolio/ 里的 1600 档拼成联系表，用来一眼核对素材都对、没花、没糊。

用法:
    python scripts/_contact-sheet.py            # 摄影 / 海报 两张表
    python scripts/_contact-sheet.py photos     # 只出摄影表
    python scripts/_contact-sheet.py posters    # 只出海报表

输出到 C:/tmp/portfolio-contact-{photos,posters}.png。
id 清单直接读 build-portfolio-images.py 的 MAPPING（单一真相）。
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "portfolio"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module  # noqa: E402

_bp = import_module("build-portfolio-images")
PHOTO_DIR = _bp.PHOTO_DIR
POSTER_DIR = _bp.POSTER_DIR
MAPPING = _bp.MAPPING

PHOTO_IDS = [m["id"] for m in MAPPING if m["src"].startswith(PHOTO_DIR)]
POSTER_IDS = [m["id"] for m in MAPPING if not m["src"].startswith(PHOTO_DIR)]

COLS = 6
CELL_W, CELL_H = 300, 220
PAD = 10
LABEL = 22


def sheet(ids: list[str], out: Path, title: str) -> None:
    rows = (len(ids) + COLS - 1) // COLS
    w = COLS * CELL_W + PAD * (COLS + 1)
    h = rows * (CELL_H + LABEL) + PAD * (rows + 1) + 34
    img_sheet = Image.new("RGB", (w, h), (245, 245, 243))
    draw = ImageDraw.Draw(img_sheet)
    draw.text((PAD, 10), f"{title}  ({len(ids)})", fill=(20, 20, 20))
    for i, pid in enumerate(ids):
        path = SRC / f"{pid}-1600.webp"
        if not path.exists():
            print(f"  缺失 {path.name}")
            continue
        im = Image.open(path).convert("RGB")
        size = im.size
        im.thumbnail((CELL_W, CELL_H), Image.LANCZOS)
        cx = PAD + (i % COLS) * (CELL_W + PAD)
        cy = 34 + PAD + (i // COLS) * (CELL_H + LABEL + PAD)
        img_sheet.paste(im, (cx + (CELL_W - im.width) // 2, cy + (CELL_H - im.height) // 2))
        orient = "横" if size[0] >= size[1] else "竖"
        draw.text((cx + 3, cy + CELL_H + 4), f"{i + 1:02d} {pid} {orient}", fill=(40, 40, 40))
    img_sheet.save(out)
    print(f"→ {out}  {img_sheet.size}")


def main() -> int:
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "photos"):
        sheet(PHOTO_IDS, Path("C:/tmp/portfolio-contact-photos.png"), "PHOTO 摄影-照片")
    if which in ("all", "posters"):
        sheet(POSTER_IDS, Path("C:/tmp/portfolio-contact-posters.png"), "POSTER 海报-设计")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
