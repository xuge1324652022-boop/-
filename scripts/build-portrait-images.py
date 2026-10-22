"""Build responsive WebP copies of the existing portrait without crop or layout changes."""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '参考资料/头像源文件/portrait-hd.png'
if not SOURCE.exists():
    SOURCE = ROOT / 'public/about/portrait-hd.png'


def main():
    with Image.open(SOURCE) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        if image.size != (1448, 1086):
            raise ValueError('Portrait aspect ratio changed; verify the animation geometry first.')
        rows = []
        for width in (400, 900, 1448):
            variant = image.copy()
            variant.thumbnail((width, round(width * 3 / 4)), Image.Resampling.LANCZOS)
            target = ROOT / f'public/about/portrait-{width}.webp'
            variant.save(target, 'WEBP', quality=92, method=6, icc_profile=original.info.get('icc_profile', b''))
            rows.append({'path': str(target.relative_to(ROOT)), 'width': variant.width, 'height': variant.height, 'bytes': target.stat().st_size})
        print(json.dumps(rows, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
