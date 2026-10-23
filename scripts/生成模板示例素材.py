"""将公开图片、视频预览和简历替换为不含个人资料的几何示例。

原件逐文件保存到忽略目录“本机私有资料/公开素材原件”，先校验 SHA-256
再替换；重复运行只接受已经登记的生成结果，避免覆盖未识别的新原件。
视频使用 --ffmpeg 指定的现有工具编码，绝不从原视频读取画面或音轨。
使用 --static-images-only 可只刷新已登记的合成图片，不改动 PDF 和视频。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent.parent
PRIVATE = ROOT / "本机私有资料" / "公开素材原件"
RECEIPT = PRIVATE / "原件与替换校验.json"
IMAGE_FOLDERS = (
    "public/about", "public/portfolio", "public/internship-clean",
    "public/color-previews", "src/assets/color-frames",
)
PALETTES = (
    ("#101923", "#f9e04e", "#ee6b46", "#e8ebe7"),
    ("#162c37", "#9dd8ce", "#efb969", "#edf2ea"),
    ("#382b47", "#d9c1ed", "#fa9866", "#f3e7db"),
    ("#202a29", "#c8e59b", "#d37f65", "#f1eee5"),
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_receipt(records: dict) -> None:
    PRIVATE.mkdir(parents=True, exist_ok=True)
    RECEIPT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def preserve_original(path: Path, records: dict) -> dict:
    relative = path.relative_to(ROOT).as_posix()
    current_sha = digest(path)
    previous = records.get(relative)
    # 私有凭据可记录已泛化文件名所对应的原始归档路径，不写入公开清单。
    archive = PRIVATE / (previous.get("originalPath", relative) if previous else relative)
    if archive.exists():
        archived_sha = digest(archive)
        if previous and archived_sha != previous["originalSha256"]:
            raise RuntimeError(f"原件校验失败：{relative}")
        accepted = {archived_sha}
        if previous and previous.get("generatedSha256"):
            accepted.add(previous["generatedSha256"])
        if current_sha not in accepted:
            raise RuntimeError(f"文件出现未登记修改，保留现场：{relative}")
    else:
        archive.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, archive)
        archived_sha = digest(archive)
        if archived_sha != current_sha:
            raise RuntimeError(f"原件复制校验失败：{relative}")
    record = previous or {"originalSha256": archived_sha, "originalBytes": archive.stat().st_size}
    records[relative] = record
    save_receipt(records)
    return record


def family_seed(path: Path) -> int:
    family = re.sub(r"-(?:400|900|1448|1600|2560)$", "", path.stem)
    return int.from_bytes(hashlib.sha256(family.encode("utf-8")).digest()[:4], "big")


def geometric_image(size: tuple[int, int], seed: int, phase: float = 0) -> Image.Image:
    width, height = size
    dark, primary, secondary, pale = PALETTES[seed % len(PALETTES)]
    art = Image.new("RGB", size, dark)
    draw = ImageDraw.Draw(art)
    unit = min(width, height)
    spacing = max(12, round(unit / 15))
    for x in range(0, width, spacing):
        draw.line((x, 0, x, height), fill="#354148", width=max(1, round(unit / 700)))
    for y in range(0, height, spacing):
        draw.line((0, y, width, y), fill="#354148", width=max(1, round(unit / 700)))
    sweep = math.sin(phase * math.tau) * 0.035
    # 横竖图共用水平、垂直边界；避免按宽高分别拉伸斜边而产生不同倾角。
    draw.rectangle((width * (.08 + sweep), height * .16,
                    width * (.92 + sweep), height * .86), fill=primary)
    center_x, center_y = width * (.59 + sweep), height * .45
    radius = unit * .225
    draw.ellipse((center_x - radius, center_y - radius, center_x + radius, center_y + radius), fill=dark)
    draw.ellipse((center_x - radius * .64, center_y - radius * .64,
                  center_x + radius * .64, center_y + radius * .64), outline=pale,
                 width=max(2, round(unit * .018)))
    draw.rounded_rectangle((width * .07, height * .62, width * .61, height * .76),
                           radius=max(2, round(unit * .025)), fill=secondary)
    draw.rectangle((width * .12, height * .67, width * .43, height * .69), fill=dark)
    draw.rectangle((width * .12, height * .71, width * .32, height * .725), fill=dark)
    font = ImageFont.load_default(size=max(10, round(unit * .045)))
    # 摄影舞台沿用 3:2 cover；宽图两侧可能裁切，标签留在居中的安全画幅内。
    label_x = max(width * .06, (width - min(width, height * 1.5)) / 2 + unit * .06)
    draw.text((label_x, height * .04), "SAMPLE / TEMPLATE", font=font, fill=pale)
    draw.text((label_x, height * .92), "GEOMETRY STUDY", font=font, fill=pale)
    return art


def replace_image(path: Path, records: dict) -> None:
    record = preserve_original(path, records)
    with Image.open(path) as source:
        size = source.size
    generated = geometric_image(size, family_seed(path))
    suffix = path.suffix.lower()
    if suffix == ".webp":
        generated.save(path, format="WEBP", quality=88, method=6, exact=True)
    elif suffix in {".jpg", ".jpeg"}:
        generated.save(path, format="JPEG", quality=92, optimize=True, progressive=True)
    elif suffix == ".png":
        generated.save(path, format="PNG", optimize=True)
    else:
        raise RuntimeError(f"未支持的图片类型：{path.relative_to(ROOT)}")
    with Image.open(path) as check:
        if check.size != size or check.getexif() or check.info.get("xmp"):
            raise RuntimeError(f"尺寸或元数据验证失败：{path.relative_to(ROOT)}")
    record.update(generatedSha256=digest(path), generatedBytes=path.stat().st_size,
                  dimensions=list(size), kind="generated-geometric-image")
    save_receipt(records)


def verify_registered_images(paths: list[Path], records: dict) -> None:
    """整批预检，仅允许重建已登记的程序图片，不接收新原片或未知修改。"""
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        record = records.get(relative, {})
        if (record.get("kind") != "generated-geometric-image"
                or digest(path) != record.get("generatedSha256")):
            raise RuntimeError(f"图片未登记或出现未知修改，保留现场：{relative}")
        archive = PRIVATE / record.get("originalPath", relative)
        if not archive.is_file() or digest(archive) != record.get("originalSha256"):
            raise RuntimeError(f"原件归档校验失败，保留现场：{relative}")


def read_mp4_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()

    def boxes(start: int, end: int):
        while start + 8 <= end:
            length, kind = struct.unpack_from(">I4s", data, start)
            header = 8
            if length == 1:
                length = struct.unpack_from(">Q", data, start + 8)[0]
                header = 16
            elif length == 0:
                length = end - start
            if length < header or start + length > end:
                return
            yield kind, start + header, start + length
            start += length

    for kind, begin, end in boxes(0, len(data)):
        if kind != b"moov":
            continue
        for child_kind, child_begin, child_end in boxes(begin, end):
            if child_kind != b"trak":
                continue
            for track_kind, track_begin, track_end in boxes(child_begin, child_end):
                if track_kind == b"tkhd":
                    width, height = struct.unpack_from(">II", data, track_end - 8)
                    width, height = width >> 16, height >> 16
                    if width > 0 and height > 0:
                        return width, height
    raise RuntimeError(f"未读取到视频尺寸：{path.relative_to(ROOT)}")


def replace_video(path: Path, records: dict, ffmpeg: str,
                  new_size: tuple[int, int] | None = None) -> None:
    relative = path.relative_to(ROOT).as_posix()
    if new_size is None:
        record = preserve_original(path, records)
        size = read_mp4_dimensions(path)
    else:
        size = new_size
        record = records.get(relative, {})
        if path.exists() and digest(path) != record.get("generatedSha256"):
            raise RuntimeError(f"生成目标已有未登记文件，保留现场：{relative}")
        path.parent.mkdir(parents=True, exist_ok=True)
        records[relative] = record
    if size[0] % 2 or size[1] % 2:
        raise RuntimeError(f"H.264 yuv420p 需要偶数尺寸：{path.relative_to(ROOT)}")
    seed = family_seed(path)
    work_root = ROOT / "tmp" / "template-media"
    work_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="geometry-", dir=work_root) as temporary:
        work = Path(temporary)
        # 帧完全程序生成；不读取原片的帧、字幕、音轨或元数据。
        for frame in range(24):
            geometric_image(size, seed, frame / 24).save(work / f"frame-{frame:03d}.png")
        candidate = work / "generated.mp4"
        subprocess.run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
            "-framerate", "12", "-i", str(work / "frame-%03d.png"),
            "-an", "-map_metadata", "-1", "-c:v", "libx264", "-threads", "2",
            "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
            "-metadata", "title=Geometric template", "-metadata", "comment=Fictional sample",
            "-movflags", "+faststart", str(candidate),
        ], check=True)
        if read_mp4_dimensions(candidate) != size:
            raise RuntimeError(f"生成视频尺寸不一致：{path.relative_to(ROOT)}")
        shutil.copyfile(candidate, path)
    record.update(generatedSha256=digest(path), generatedBytes=path.stat().st_size,
                  dimensions=list(size), kind="generated-silent-geometric-video")
    save_receipt(records)


def replace_resume(records: dict) -> None:
    path = ROOT / "public/resume.pdf"
    record = preserve_original(path, records)
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    document = canvas.Canvas(str(path), pagesize=(595.276, 841.89), invariant=1, pageCompression=1)
    document.setTitle("示例求职者 - 空白简历模板")
    document.setAuthor("Template example")
    document.setSubject("虚构示例，仅含填写提示，不包含个人履历")
    document.setCreator("Template example generator")
    for page in (1, 2):
        document.setFillColor(colors.HexColor("#152a34"))
        document.rect(0, 757, 596, 85, fill=1, stroke=0)
        document.setFillColor(colors.white)
        document.setFont("STSong-Light", 26)
        document.drawString(42, 792, "示例求职者")
        document.setFont("STSong-Light", 10)
        document.drawString(43, 772, "空白简历模板 / 虚构示例")
        document.setFillColor(colors.HexColor("#32444b"))
        document.setFont("STSong-Light", 11)
        document.drawString(43, 727, "填写提示：请使用你自己的公开资料替换以下空白区域。")
        sections = (("联系信息", "填写提示：个人联系方式；示例域名 example.com。"),
                    ("求职意向", "填写提示：目标岗位、技能方向和可到岗时间。"),
                    ("教育背景", "填写提示：学校、专业和学习经历。")) if page == 1 else (
                    ("项目经历", "填写提示：项目名称、本人职责和可公开成果。"),
                    ("能力与工具", "填写提示：技能名称、熟练程度和使用场景。"),
                    ("补充说明", "填写提示：公开作品链接、证书或其他自愿公开的信息。"))
        for index, (title, prompt) in enumerate(sections):
            top = 675 - index * 190
            document.setFillColor(colors.HexColor("#152a34"))
            document.setFont("STSong-Light", 16)
            document.drawString(43, top, title)
            document.setStrokeColor(colors.HexColor("#d5dfdf"))
            document.line(43, top - 12, 552, top - 12)
            document.setFillColor(colors.HexColor("#52636a"))
            document.setFont("STSong-Light", 10)
            document.drawString(43, top - 36, prompt)
            for line in range(3):
                document.setStrokeColor(colors.HexColor("#e8eded"))
                document.line(43, top - 64 - line * 24, 552, top - 64 - line * 24)
        document.setFillColor(colors.HexColor("#52636a"))
        document.setFont("STSong-Light", 9)
        document.drawString(43, 34, "填写提示：本文件不包含真实姓名、履历、联系方式或照片。")
        document.setFont("Helvetica", 9)
        document.drawRightString(552, 34, f"{page} / 2")
        document.showPage()
    document.save()
    from pypdf import PdfReader
    check = PdfReader(path)
    if len(check.pages) != 2 or any("示例求职者" not in (page.extract_text() or "") for page in check.pages):
        raise RuntimeError("模板 PDF 页数或可搜索文字验证失败")
    record.update(generatedSha256=digest(path), generatedBytes=path.stat().st_size,
                  pages=2, kind="fictional-blank-resume-template")
    save_receipt(records)


def export_public_manifest(records: dict) -> None:
    public_records = []
    for relative, record in sorted(records.items()):
        if "generatedSha256" not in record:
            continue
        item = {"path": relative, "sha256": record["generatedSha256"],
                "bytes": record["generatedBytes"], "kind": record["kind"]}
        if "dimensions" in record:
            item["dimensions"] = record["dimensions"]
        if "pages" in record:
            item["pages"] = record["pages"]
        public_records.append(item)
    (ROOT / "public" / "模板素材清单.json").write_text(json.dumps(
        {"description": "公开模板素材全部由程序生成，不含真实人物、作品、履历或音轨。",
         "files": public_records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--images-only", action="store_true", help="先替换图片与 PDF，稍后提供 ffmpeg 再处理视频")
    modes.add_argument("--videos-only", action="store_true", help="只生成视频，不重复处理已完成的图片和 PDF")
    modes.add_argument("--static-images-only", action="store_true",
                       help="仅刷新已登记的合成静态图片，不改动 PDF、视频或私人原件")
    args = parser.parse_args()
    if not (args.images_only or args.static_images_only) and not args.ffmpeg:
        parser.error("找不到 ffmpeg；请传入 --ffmpeg，或使用 --images-only / --static-images-only")
    records = json.loads(RECEIPT.read_text(encoding="utf-8")) if RECEIPT.exists() else {}
    image_count = 0
    pdf_pages = 0
    if not args.videos_only:
        images = [path for folder in IMAGE_FOLDERS for path in sorted((ROOT / folder).glob("*"))
                  if path.is_file() and path.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}]
        if args.static_images_only:
            verify_registered_images(images, records)
        for path in images:
            replace_image(path, records)
            image_count += 1
        if not args.static_images_only:
            replace_resume(records)
            pdf_pages = 2
    video_count = 0
    if not (args.images_only or args.static_images_only):
        previews = sorted((ROOT / "public/color-previews").glob("*.mp4"))
        for path in previews:
            replace_video(path, records, args.ffmpeg)
            video_count += 1
        # 完整作品播放器同样只使用新合成的公开模板，不复用本机私有原片。
        numbers = []
        for preview in previews:
            match = re.fullmatch(r"clip-(\d+)", preview.stem)
            if not match:
                raise RuntimeError(f"未登记的预览编号：{preview.name}")
            numbers.append(int(match.group(1)))
        for number in sorted(numbers):
            replace_video(ROOT / "public/color" / f"color grade-{number}.mp4", records,
                          args.ffmpeg, new_size=(1920, 1080))
            video_count += 1
    export_public_manifest(records)
    print(json.dumps({"images": image_count, "pdfPages": pdf_pages, "videos": video_count,
                      "originalsVerified": sum("originalSha256" in value for value in records.values()),
                      "videoPending": args.images_only}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
