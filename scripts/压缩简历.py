"""Create a smaller resume PDF while retaining searchable text, pages and links.

Only large embedded raster images are recompressed. Text is never rasterized.
Usage: python scripts/压缩简历.py input.pdf output.pdf
"""
import json
import sys
from pathlib import Path
from pypdf import PdfReader, PdfWriter


def snapshot(reader):
    return {
        'text': [page.extract_text() for page in reader.pages],
        'boxes': [list(page.mediabox) for page in reader.pages],
        'links': [[str(annotation.get_object().get('/A', '')) for annotation in page.get('/Annots', [])] for page in reader.pages],
        'fields': reader.get_fields() or {},
    }


def main():
    source, target = map(Path, sys.argv[1:])
    if source.resolve() == target.resolve() or target.exists():
        raise ValueError('Output must be a new file; preserve the source document.')
    reader = PdfReader(source)
    before = snapshot(reader)
    writer = PdfWriter(clone_from=source)
    replaced = 0
    for page in writer.pages:
        for image in page.images:
            if len(image.data) > 128_000 and image.image.mode == 'RGB':
                image.replace(image.image, quality=88, optimize=True)
                replaced += 1
        page.compress_content_streams(level=9)
    writer.compress_identical_objects()
    target.parent.mkdir(parents=True, exist_ok=True)
    writer.write(target)
    after = snapshot(PdfReader(target))
    if before != after:
        raise ValueError('Searchable text, page boxes, links or form data changed.')
    print(json.dumps({'sourceBytes': source.stat().st_size, 'outputBytes': target.stat().st_size, 'pages': len(reader.pages), 'recompressedImages': replaced, 'textAndLinksPreserved': True}, ensure_ascii=False))


if __name__ == '__main__':
    main()
