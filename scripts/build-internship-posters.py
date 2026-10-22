"""Render the explicitly approved PDF pages. Originals are always read-only.

python scripts/build-internship-posters.py --pdftoppm /path/to/pdftoppm
python scripts/build-internship-posters.py --verify
The V10L document's blank yellow page 20 is intentionally not published.
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
# 这里保存完整的 PDF 网页转换基线；线上筛选和去品牌结果由另外的清单/脚本管理。
SOURCE = ROOT / '作品/海报-设计/示例组织甲-实习产出/产品-介绍海报'
OUTPUT = ROOT / '参考资料/实习原始转换预览'
PLAN = ROOT / 'src/data/internship-poster-plan.json'
MANIFEST = ROOT / 'src/data/internship-poster-assets.json'
SIZES = (400, 1600, 2560)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdftoppm', default=shutil.which('pdftoppm'))
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    manifest = []
    if not args.verify and not args.pdftoppm:
        parser.error('Pass --pdftoppm with the installed Poppler executable.')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    temp_root = ROOT / 'tmp/pdfs'
    if not args.verify:
        temp_root.mkdir(parents=True, exist_ok=True)
    for group in plan:
        source = SOURCE / group['file']
        reader = PdfReader(source)
        for item in group['pages']:
            number = item['page']
            page = reader.pages[number - 1]
            # PDF 页号从 1 开始；manifest 的宽高使用百分之一 PDF point，不能当像素宽度。
            width, height = float(page.mediabox.width), float(page.mediabox.height)
            asset_id = f"{group['id']}-{number:02d}"
            if not args.verify:
                # Render once at the viewer size; all smaller variants keep the full page.
                prefix = str(temp_root / asset_id)
                subprocess.run([args.pdftoppm, '-f', str(number), '-l', str(number),
                                '-singlefile', '-scale-to', '2560', '-png',
                                str(source), prefix], check=True)
                with Image.open(prefix + '.png') as rendered:
                    for size in SIZES:
                        image = rendered.convert('RGB')
                        image.thumbnail((size, size), Image.Resampling.LANCZOS)
                        image.save(OUTPUT / f'{asset_id}-{size}.webp',
                                   quality=88, method=6)
                Path(prefix + '.png').unlink()
            for size in SIZES:
                with Image.open(OUTPUT / f'{asset_id}-{size}.webp') as image:
                    assert max(image.size) <= size
                    assert abs(image.width / image.height - width / height) < .01
            manifest.append({'id': asset_id, 'group': group['id'], 'page': number,
                             'width': round(width * 100), 'height': round(height * 100)})
    assert len(manifest) == 28 and len({item['id'] for item in manifest}) == 28
    if args.verify:
        # 只核对原比例和既有清单，不重新渲染，也不覆盖 PDF 原件。
        assert manifest == json.loads(MANIFEST.read_text(encoding='utf-8'))
    else:
        MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(f'Verified {len(manifest)} pages, {len(manifest) * len(SIZES)} WebP variants.')


if __name__ == '__main__':
    main()
