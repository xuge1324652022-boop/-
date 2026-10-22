"""Preserve the existing reference research without moving its live preview."""
from pathlib import Path
import hashlib
import json
import shutil

project = Path(__file__).resolve().parents[1]
archive = project / "参考资料" / "Squarespace-Foundations" / "2026-10-14"
previous = archive / "01-已有分析"
previous.mkdir(parents=True, exist_ok=True)
pairs = [(project / "outputs/reference-analysis/2026-10-14", previous / "完整研究包")]
for name in ("docs/参考站逆向分析.md", "outputs/reference-motion-grammar.md"):
    source = project / name
    if source.exists():
        pairs.append((source, previous / source.name))
rows = []
# 同路径已存在的归档必须逐字节相同；拒绝覆盖历史证据，以 SHA256 清单支持复查。
for source, destination in pairs:
    files = list(source.rglob("*")) if source.is_dir() else [source]
    for original in files:
        if not original.is_file():
            continue
        copy = destination / original.relative_to(source) if source.is_dir() else destination
        copy.parent.mkdir(parents=True, exist_ok=True)
        if copy.exists():
            if original.read_bytes() != copy.read_bytes():
                raise RuntimeError(f"Archive exists with different contents: {copy}")
        else:
            shutil.copy2(original, copy)
        digest = hashlib.sha256(original.read_bytes()).hexdigest()
        assert hashlib.sha256(copy.read_bytes()).hexdigest() == digest
        rows.append({"original": str(original.relative_to(project)), "archived": str(copy.relative_to(archive)), "bytes": copy.stat().st_size, "sha256": digest})
(archive / "已有资料-校验清单.json").write_text(json.dumps({"date": "2026-10-14", "method": "copy2 + SHA256 comparison; originals retained", "files": rows}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"folder": str(archive), "files": len(rows), "bytes": sum(row["bytes"] for row in rows), "all_copies_verified": True}, ensure_ascii=False))
