"""为调色首屏生成完整时长的轻量预览与首帧，不覆盖作品原片。

用法：python scripts/build-color-previews.py --ffmpeg <ffmpeg 路径>
"""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "作品" / "调色-成片"
OUTPUT = ROOT / "public" / "color-previews"


def main() -> int:
    # 清单编号与 ColorView 的 PREVIEWS 对应，不扫描其它视频以免意外发布新作品。
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    parser.add_argument("--clip", type=int, action="append", help="只处理指定编号，可重复使用")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if not args.ffmpeg:
        parser.error("找不到 ffmpeg，请用 --ffmpeg 指定路径")
    numbers = args.clip or list(range(1, 16))
    sources = [(number, SOURCE / f"color grade-{number}.mp4") for number in numbers]
    if any(not source.is_file() for _, source in sources):
        parser.error("指定原片不存在：作品/调色-成片")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    for number, source in sources:
        video = OUTPUT / f"clip-{number}.mp4"
        poster = OUTPUT / f"clip-{number}.jpg"
        if not args.force and all(path.exists() and path.stat().st_mtime >= source.stat().st_mtime for path in (video, poster)):
            print(f"Skip: {source.name}", flush=True)
            continue
        temporary_video = OUTPUT / f".clip-{number}.tmp.mp4"
        temporary_poster = OUTPUT / f".clip-{number}.tmp.jpg"
        clip_started = time.perf_counter()
        try:
            # 首屏仅需 640px 静音预览；H.264 和 faststart 减少同时弹出多层的解码/探测成本。
            subprocess.run([
                args.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-threads", "4", "-i", str(source), "-map", "0:v:0", "-an",
                "-vf", "scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24",
                "-c:v", "libx264", "-threads", "4", "-preset", "veryfast", "-crf", "26",
                "-pix_fmt", "yuv420p", "-maxrate", "1200k", "-bufsize", "2400k",
                "-g", "48", "-movflags", "+faststart", str(temporary_video),
            ], check=True)
            subprocess.run([
                args.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-threads", "2", "-i", str(temporary_video), "-map", "0:v:0",
                "-frames:v", "1", "-q:v", "3", "-update", "1", str(temporary_poster),
            ], check=True)
            # 两个命令都成功后再替换正式文件；编码失败时保留上一次可用资源。
            temporary_video.replace(video)
            temporary_poster.replace(poster)
        finally:
            temporary_video.unlink(missing_ok=True)
            temporary_poster.unlink(missing_ok=True)
        print(f"Built: clip-{number} | video {video.stat().st_size / 1e6:.3f} MB | poster {poster.stat().st_size / 1e3:.1f} KB | {time.perf_counter() - clip_started:.1f}s", flush=True)
    print(f"Finished in {time.perf_counter() - started:.1f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
