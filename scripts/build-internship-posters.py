#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读核验公开海报示例，不打开或转换任何原始 PDF。

默认与 --verify 均核验 public/模板素材清单.json 登记的
public/internship-clean/ 合成 WebP：哈希、字节数、尺寸、元数据及三档比例。
--probe 额外打印公开示例的尺寸和文件信息。历史原件转换功能已移除。
"""
from __future__ import annotations

import argparse
from importlib import import_module
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
portfolio = import_module("build-portfolio-images")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--verify", action="store_true", help="只读核验公开合成海报（默认）")
    modes.add_argument("--probe", action="store_true", help="核验并打印公开海报尺寸和字节数")
    args = parser.parse_args()
    return portfolio.report(portfolio.load_manifest_images("public/internship-clean"), args.probe)


if __name__ == "__main__":
    raise SystemExit(main())
