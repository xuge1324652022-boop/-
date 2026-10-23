#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""兼容旧命令名：仅核验公开合成海报，不再处理原始文件或移除标志。

参数与 build-internship-posters.py 一致，默认及 --verify 只读核验，
--probe 打印审核后的公开样图信息。去除标志本身不能保证资料已经脱敏。
"""
from __future__ import annotations

from importlib import import_module
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))


def main() -> int:
    return import_module("build-internship-posters").main()


if __name__ == "__main__":
    raise SystemExit(main())
