#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""只读核验公开模板摄影、海报图片，不转换或读取私人原片。

默认与 --verify 均核对 public/模板素材清单.json 登记的哈希、尺寸、
元数据与 400/1600/2560 三档完整性；--probe 额外打印公开图片信息。
新增示例应先通过生成器及隐私审核登记，本工具不会把目录中新文件自动公开。
MAPPING 供联系表复用，从 sample-photo-/sample-poster- 编号动态构建。
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys

from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
PHOTO_DIR = "public/portfolio"
OUT_DIR = ROOT / PHOTO_DIR
MANIFEST = ROOT / "public/模板素材清单.json"
SIZES = (400, 1600, 2560)
ID_PATTERN = re.compile(r"(sample-(photo|poster)-\d+)-(400|1600|2560)\.webp")


def load_manifest_images(folder: str) -> list[dict]:
    """只接受两个公开目录中的直接子文件，拒绝越界路径和符号链接。"""
    if folder not in {PHOTO_DIR, "public/internship-clean"}:
        raise ValueError("只允许检查已知公开模板目录")
    public_root = ROOT / "public"
    directory = ROOT / folder
    if public_root.is_symlink() or directory.is_symlink():
        raise ValueError("公开素材目录不能是符号链接")
    document = json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries = []
    seen = set()
    for item in document["files"]:
        relative = item["path"]
        if not isinstance(relative, str) or not relative.startswith(folder + "/"):
            continue
        parts = PurePosixPath(relative).parts
        if ("\\" in relative or ".." in parts or PurePosixPath(relative).is_absolute()
                or len(parts) != 3 or item.get("kind") != "generated-geometric-image"
                or PurePosixPath(relative).suffix.lower() != ".webp"):
            raise ValueError("公开图片清单包含不允许的路径或类型")
        if relative in seen:
            raise ValueError("公开图片清单存在重复路径")
        path = ROOT.joinpath(*parts)
        if path.is_symlink() or path.resolve().parent != directory.resolve():
            raise ValueError("公开图片清单路径越界")
        seen.add(relative)
        entries.append(item)
    return sorted(entries, key=lambda item: item["path"])


def mapping_from_manifest() -> list[dict]:
    families = {}
    for item in load_manifest_images(PHOTO_DIR):
        match = ID_PATTERN.fullmatch(PurePosixPath(item["path"]).name)
        if not match:
            continue
        asset_id, kind, tier = match.groups()
        family = families.setdefault(asset_id, {
            "id": asset_id,
            "title": f"{'摄影' if kind == 'photo' else '海报'}示例 {asset_id.rsplit('-', 1)[1]}",
            "group": "photos" if kind == "photo" else "posters",
            "variants": {},
        })
        family["variants"][int(tier)] = item["path"]
        if int(tier) == 1600:
            family["src"] = item["path"]
    return [families[key] for key in sorted(families)]


MAPPING = mapping_from_manifest()


def inspect_entries(entries: list[dict]) -> tuple[list[dict], list[str]]:
    """哈希通过后才解码图片；不会读清单之外的文件。"""
    rows, errors, families = [], [], {}
    if not entries:
        return rows, ["公开清单未登记待核验图片"]
    for item in entries:
        relative = item["path"]
        path = ROOT / relative
        if not path.is_file():
            errors.append(f"公开图片缺失：{relative}")
            continue
        data = path.read_bytes()
        if (hashlib.sha256(data).hexdigest() != item.get("sha256")
                or len(data) != item.get("bytes")):
            errors.append(f"公开图片未通过审核哈希或字节数：{relative}")
            continue
        try:
            with Image.open(path) as image:
                width, height = image.size
                if image.format != "WEBP" or list(image.size) != item.get("dimensions"):
                    errors.append(f"格式或尺寸与清单不符：{relative}")
                if image.getexif() or any(image.info.get(key) for key in ("xmp", "icc_profile")):
                    errors.append(f"公开图片含未允许的元数据：{relative}")
        except (OSError, ValueError):
            errors.append(f"公开图片无法解码：{relative}")
            continue
        match = re.fullmatch(r"(.+)-(400|1600|2560)\.webp", path.name)
        if not match:
            errors.append(f"公开图片不是三档资源：{relative}")
            continue
        asset_id, tier_text = match.groups()
        tier = int(tier_text)
        if max(width, height) > tier:
            errors.append(f"公开图片超过尺寸档位：{relative}")
        families.setdefault(asset_id, {})[tier] = (width, height)
        rows.append({"path": relative, "width": width, "height": height,
                     "bytes": len(data), "tier": tier})
    for asset_id, variants in sorted(families.items()):
        if set(variants) != set(SIZES):
            errors.append(f"三档资源不完整：{asset_id}")
            continue
        reference = variants[1600][0] / variants[1600][1]
        if any(abs(width / height - reference) > .01 for width, height in variants.values()):
            errors.append(f"三档图片比例不一致：{asset_id}")
    return rows, errors


def report(entries: list[dict], probe: bool = False, expected_ids: set[str] | None = None) -> int:
    rows, errors = inspect_entries(entries)
    if expected_ids is not None:
        registered = {re.sub(r"-(400|1600|2560)\.webp$", "", PurePosixPath(item["path"]).name)
                      for item in entries}
        if not expected_ids or registered != expected_ids:
            errors.append("公开摄影/海报清单必须全部采用 sample-photo-/sample-poster- 编号")
    result = {"images": len(rows), "families": len(rows) // len(SIZES), "errors": errors}
    if probe:
        result["files"] = rows
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--verify", action="store_true", help="只读核验公开图片（默认）")
    modes.add_argument("--probe", action="store_true", help="核验并打印公开图片尺寸和字节数")
    args = parser.parse_args()
    return report(load_manifest_images(PHOTO_DIR), args.probe, {item["id"] for item in MAPPING})


if __name__ == "__main__":
    raise SystemExit(main())
