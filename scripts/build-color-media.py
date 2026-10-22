"""从作品/调色-成片生成 H.264 网页视频；不覆盖原片。

用法：python scripts/build-color-media.py --clip 15 --ffmpeg <ffmpeg 路径>
省略 --clip 会处理所有原片；未更新的已有网页版本会跳过。
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "作品" / "调色-成片"
OUTPUT = ROOT / "media" / "color"


def main() -> int:
    # 产物保留原文件名，使 Vite 中间件和静态部署共享 /color/<文件名> 契约。
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clip", type=int, action="append", help="仅处理指定编号，可重复传入")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"), help="ffmpeg 可执行文件路径")
    parser.add_argument("--force", action="store_true", help="重新生成已有网页版本")
    parser.add_argument("--preset", default="medium", help="H.264 编码速度，默认 medium")
    args = parser.parse_args()
    if not args.ffmpeg:
        parser.error("找不到 ffmpeg，请用 --ffmpeg 指定路径")
    sources = ([SOURCE / f"color grade-{n}.mp4" for n in args.clip]
               if args.clip else sorted(SOURCE.glob("color grade-*.mp4")))
    if not sources or any(not source.is_file() for source in sources):
        parser.error("原片目录为空或指定编号不存在：作品/调色-成片")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    for source in sources:
        dest = OUTPUT / source.name
        if not args.force and dest.exists() and dest.stat().st_mtime >= source.stat().st_mtime:
            print(f"Skip: {source.name}")
            continue
        # 先写临时文件，成功后替换：正在访问的页面不会读到半段编码结果。
        temp = OUTPUT / f".{source.stem}.tmp.mp4"
        clip_started = time.perf_counter()
        subprocess.run([
            # 完整作品与首屏预览分开：保持全长及可选音轨，按比例压至 1080p/30fps。
            args.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
            "-threads", "4", "-i", str(source), "-map", "0:v:0", "-map", "0:a?",
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=30",
            "-c:v", "libx264", "-threads", "4", "-preset", args.preset, "-crf", "22", "-pix_fmt", "yuv420p",
            "-maxrate", "8M", "-bufsize", "16M",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(temp),
        ], check=True)
        temp.replace(dest)
        print(f"Built: {source.name} -> {dest.stat().st_size / 1e6:.1f} MB | {time.perf_counter() - clip_started:.1f}s", flush=True)
    print(f"Finished in {time.perf_counter() - started:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
