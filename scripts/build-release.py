"""生成已审核的公开模板部署包与源码归档，不收录本机私人资料或 Git 历史。"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DELIVERIES = ROOT / "上线交付"
PRIVATE_ROOTS = {
    ".git", "node_modules", ".codex", ".agents", ".aws", ".ssh", ".workbuddy-ai",
    "本机私有资料", "作品", "参考资料", "个人简历", "outputs", "backups", "tmp",
    "上线交付", "网站部署文件", "逆向工程工具",
}
COMPRESSED_SUFFIXES = {".mp4", ".webm", ".webp", ".png", ".jpg", ".jpeg", ".zip", ".gz", ".7z", ".woff2"}


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def checked_file(folder: Path, relative: str) -> Path:
    """不跟随符号链接或联接；所有输入都必须是根内的普通文件。"""
    parts = relative.split("/")
    if not relative or any(part in {"", ".", ".."} for part in parts) or "\\" in relative or Path(relative).is_absolute():
        raise RuntimeError("归档清单包含无效相对路径")
    current = folder
    for index, part in enumerate(parts):
        current = current / part
        if current.is_symlink() or current.is_junction():
            raise RuntimeError("归档拒绝符号链接或目录联接")
        if index < len(parts) - 1 and not current.is_dir():
            raise RuntimeError("归档父路径不是普通目录")
    if not current.is_file() or not current.resolve().is_relative_to(folder.resolve()):
        raise RuntimeError("归档文件不存在或越界")
    return current


def public_git_files() -> list[str]:
    """源码归档只取隐私门禁审查的 index 文件，不遍历私人工作目录。"""
    result = subprocess.run(["git", "ls-files", "--cached", "-z"], cwd=ROOT, check=True, capture_output=True)
    files = sorted(set(result.stdout.decode("utf-8").split("\0")) - {""})
    if not files:
        raise RuntimeError("没有受版本控制的公开模板源码")
    for relative in files:
        if relative.split("/")[0].casefold() in {name.casefold() for name in PRIVATE_ROOTS} or relative.casefold().startswith("docs/历史说明/"):
            raise RuntimeError("源码归档中存在私人目录，停止交付")
        checked_file(ROOT, relative)
    return files


def files_under(folder: Path):
    for directory, names, files in os.walk(folder, followlinks=False):
        for name in names:
            entry = Path(directory) / name
            if entry.is_symlink() or entry.is_junction():
                raise RuntimeError("部署归档拒绝符号链接或目录联接")
        names.sort()
        for name in sorted(files):
            relative = (Path(directory) / name).relative_to(folder).as_posix()
            yield checked_file(folder, relative)


def write_zip(folder: Path, target: Path, *, source_paths: list[str] | None = None):
    """源码只用显式 Git 文件清单；部署包只读取本次创建的审核快照。"""
    files = [checked_file(folder, relative) for relative in source_paths] if source_paths is not None else list(files_under(folder))
    count = size = 0
    with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for file in files:
            relative = file.relative_to(folder).as_posix()
            archive.write(file, ("job-application-template/" if source_paths is not None else "") + relative,
                          compress_type=zipfile.ZIP_STORED if file.suffix.lower() in COMPRESSED_SUFFIXES else zipfile.ZIP_DEFLATED)
            count += 1
            size += file.stat().st_size
    with zipfile.ZipFile(target) as archive:
        if archive.testzip():
            raise RuntimeError("ZIP CRC 检查失败")
    return {"file": target.name, "files": count, "uncompressedBytes": size,
            "bytes": target.stat().st_size, "sha256": digest(target)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", help="交付日期 YYYY-MM-DD，默认上海日期")
    parser.add_argument("--label", default="", help="同日重新交付时的后缀，不覆盖旧包")
    args = parser.parse_args()
    date = args.date or datetime.now(timezone(timedelta(hours=8))).date().isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date) or not re.fullmatch(r"[\w-]*", args.label):
        parser.error("日期或后缀格式不正确")
    suffix = f"-{args.label}" if args.label else ""
    output = DELIVERIES / f"{date}{suffix}"
    if output.exists():
        parser.error("交付目录已存在；请使用 --label 创建新版本")

    # 门禁会扫描未暂存的新源码；源码归档要求先将这些文件纳入 index。
    subprocess.run(["node", "scripts/检查公开隐私.mjs"], cwd=ROOT, check=True)
    untracked = subprocess.run(["git", "ls-files", "--others", "--exclude-standard", "-z"], cwd=ROOT, check=True, capture_output=True)
    if untracked.stdout:
        raise RuntimeError("存在未纳入版本控制的新文件，请先审查并暂存，避免归档缺少新源码")
    tracked = public_git_files()
    for command in (
        ["node", "scripts/生成动效组件库.mjs", "--check"],
        ["node", "scripts/生成响应式图片清单.mjs", "--check"],
        ["node", "node_modules/vue-tsc/bin/vue-tsc.js", "--noEmit"],
        ["node", "node_modules/vite/bin/vite.js", "build"],
        ["node", "scripts/verify-route-head.mjs", "--dist"],
    ):
        subprocess.run(command, cwd=ROOT, check=True)

    output.mkdir(parents=True)
    # 使用同一审核助手，只能读取 public/color 和本次构建的已审核字节。
    prepared = output / "已审核素材快照"
    subprocess.run(["node", "scripts/cloudflare-assets.mjs", "prepare", str(prepared)], cwd=ROOT, check=True, capture_output=True)
    package = output / "服务器部署包"
    shutil.copytree(prepared / "site", package / "site")
    for relative in tracked:
        if relative.startswith("deploy/"):
            destination = package / "配置" / relative.removeprefix("deploy/")
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(checked_file(ROOT, relative), destination)
    instructions = "docs/服务器上线与归档.md"
    if instructions not in tracked:
        raise RuntimeError("缺少受版本控制的上线说明")
    shutil.copy2(checked_file(ROOT, instructions), package / "上线说明.md")
    site_files = [{"path": file.relative_to(package / "site").as_posix(),
                   "bytes": file.stat().st_size, "sha256": digest(file)}
                  for file in files_under(package / "site")]
    (package / "文件清单.json").write_text(json.dumps({"date": date, "files": site_files}, ensure_ascii=False, indent=2), encoding="utf-8")
    deployment = write_zip(package, output / f"网站上线部署包-{date}{suffix}.zip")
    project = write_zip(ROOT, output / f"公开模板源码-{date}{suffix}.zip", source_paths=tracked)
    report = {"date": date, "deployment": deployment, "sourceArchive": project,
              "privateFilesIncluded": False, "gitHistoryIncluded": False, "siteFiles": len(site_files)}
    (output / "交付清单.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "SHA256SUMS.txt").write_text("\n".join(f"{item['sha256']}  {item['file']}" for item in (deployment, project)) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), **report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
