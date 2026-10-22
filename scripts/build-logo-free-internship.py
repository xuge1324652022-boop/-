"""Remove independently drawn corner logos from selected internship PDF pages.

Native corner marks and brand text are removed as PDF drawing instructions.
Full-brand mode embeds approved image-generator edits into original bitmap
slots while preserving their native soft masks. Source PDFs and the older
参考资料/实习原始转换预览 stays untouched; model names and technical copy stay.

python scripts/build-logo-free-internship.py --pdftoppm /path/to/pdftoppm
python scripts/build-logo-free-internship.py --verify
python scripts/build-logo-free-internship.py --full-brand-removal --stage-only --pdftoppm /path/to/pdftoppm
python scripts/build-logo-free-internship.py --publish-staged
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path

import pdfplumber
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf._cmap import get_encoding
from pypdf.generic import (ByteStringObject, ContentStream, DecodedStreamObject,
                           ArrayObject, BooleanObject, DictionaryObject, FloatObject,
                           NameObject, NumberObject, TextStringObject)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '作品/海报-设计/示例组织甲-实习产出/产品-介绍海报'
EXPORT = ROOT / '作品/海报-设计/去Logo-导出海报'
OUTPUT = ROOT / 'public/internship-clean'
TEMP = ROOT / 'tmp/pdfs/logo-free'
RECEIPT = EXPORT / '素材清单.json'
SIZES = (400, 1600, 2560)
GROUPS = (
    {'id': 'demo-guidance', 'file': 'EC100.pdf', 'pages': {
        1: ('/X13', 23, 860, 261),
        2: ('/X6', 27, 860, 261),
        3: ('/X7', 38, 860, 261),
    }},
    {'id': 'demo-measure', 'file': 'V10L-EN.pdf', 'pages': {
        1: ('/X21', 38, 645, 196),
        2: ('/X20', 53, 645, 196),
        3: ('/X23', 66, 645, 196),
        12: ('/X19', 176, 645, 196),
        13: ('/X11', 187, 645, 196),
        14: ('/X30', 207, 645, 196),
        15: ('/X33', 220, 645, 196),
    }},
    {'id': 'demo-garden', 'file': 'Vela.pdf', 'pages': {1: None}},
)

# Original PDF bitmap refs -> approved image-generator edits. Identical product
# compositions share the edited RGB while retaining each original PDF soft mask.
PHOTO_EDITS = {
    'EC100.pdf': {29: 'EC100-xref0029.png', 30: 'EC100-xref0030.png',
                  31: 'EC100-xref0031.png', 32: 'EC100-xref0032.png',
                  37: 'EC100-xref0037.png'},
    'V10L-EN.pdf': {70: 'V10L-EN-xref0180.png', 180: 'V10L-EN-xref0180.png',
                    192: 'V10L-EN-xref0180.png', 197: 'V10L-EN-xref0197.png',
                    212: 'V10L-EN-xref0212.png', 1401: 'V10L-EN-xref1401.png',
                    204: 'V10L-EN-xref0204.png', 216: 'V10L-EN-xref0216.png',
                    184: 'V10L-EN-xref0184.png'},
    'Vela.pdf': {115: 'Vela-xref0115.png'},
}
BRAND_SHADOWS = {12: '/X28', 13: '/X15', 14: '/X11', 15: '/X11'}
BRAND_PATTERN = re.compile(r'FJD(?:\s*Trion|ynamics)?\s*', re.IGNORECASE)


def attach_intersection_alpha(page, owner, image_name, original_alpha, edited_alpha, width, height):
    """Compose old and generated cutout alpha in the native PDF compositor.

    Multiplying gray mask Images in an isolated luminosity Form keeps the
    original silhouette and removes generated transparent pixels from its
    interior. No bitmap painting or inpainting is involved.
    """
    model = DecodedStreamObject()
    model.set_data(edited_alpha.resize((width, height), Image.Resampling.LANCZOS).tobytes())
    model.update({NameObject('/Type'): NameObject('/XObject'), NameObject('/Subtype'): NameObject('/Image'),
                  NameObject('/Width'): NumberObject(width), NameObject('/Height'): NumberObject(height),
                  NameObject('/BitsPerComponent'): NumberObject(8), NameObject('/ColorSpace'): NameObject('/DeviceGray')})
    form = DecodedStreamObject()
    form.update({
        NameObject('/Type'): NameObject('/XObject'), NameObject('/Subtype'): NameObject('/Form'),
        NameObject('/BBox'): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(1), NumberObject(1)]),
        NameObject('/Group'): DictionaryObject({NameObject('/S'): NameObject('/Transparency'),
                                               NameObject('/CS'): NameObject('/DeviceGray'),
                                               NameObject('/I'): BooleanObject(True)}),
        NameObject('/Resources'): DictionaryObject({
            NameObject('/XObject'): DictionaryObject({NameObject('/OriginalAlpha'): original_alpha,
                                                      NameObject('/EditedAlpha'): model.flate_encode()}),
            NameObject('/ExtGState'): DictionaryObject({
                NameObject('/MultiplyAlpha'): DictionaryObject({NameObject('/BM'): NameObject('/Multiply')})}),
        }),
    })
    form.set_data(b'q /OriginalAlpha Do Q\nq /MultiplyAlpha gs /EditedAlpha Do Q\n')
    resources = page['/Resources']
    states = DictionaryObject(dict(resources.get('/ExtGState', {}).items()))
    mask_name = NameObject('/UnbrandedProductAlpha')
    states[mask_name] = DictionaryObject({NameObject('/SMask'): DictionaryObject({
        NameObject('/S'): NameObject('/Luminosity'), NameObject('/G'): form,
        NameObject('/BC'): ArrayObject([NumberObject(0)]),
    })})
    resources[NameObject('/ExtGState')] = states
    content = ContentStream(page.get_contents(), owner)
    operations, changed = [], 0
    for arguments, operator in content.operations:
        if operator == b'Do' and str(arguments[0]) == image_name:
            operations.extend([([], b'q'), ([mask_name], b'gs'), (arguments, operator), ([], b'Q')])
            changed += 1
        else:
            operations.append((arguments, operator))
    assert changed == 1
    content.operations = operations
    page[NameObject('/Contents')] = content


def glyph_units(value, font):
    """Decode native font code units without asking a model to redraw type."""
    raw = value.original_bytes if isinstance(value, TextStringObject) else bytes(value)
    encoding, cmap = get_encoding(font)
    unit_width = 2 if encoding == 'utf-16-be' else 1
    assert len(raw) % unit_width == 0
    units = []
    for offset in range(0, len(raw), unit_width):
        code = raw[offset:offset + unit_width]
        encoded = code.decode(encoding) if isinstance(encoding, str) else encoding.get(code[0], chr(code[0]))
        units.append((code, ''.join(cmap.get(character, character) for character in encoded)))
    return units


def strip_native_brand_text(stream, resources, owner, chain, modifications):
    # 在原字体编码单元上删除品牌匹配项，保留其它字形的原生 PDF 绘制指令和清晰度。
    content = ContentStream(stream, owner)
    font_name = None
    units = []
    chunks = []
    removed_operations = set()
    operations = content.operations
    for index, (arguments, operator) in enumerate(operations):
        if operator == b'BT':
            units, chunks = [], []
        elif operator == b'Tf':
            font_name = str(arguments[0])
        elif operator == b'Tj':
            assert font_name and '/Font' in resources
            glyphs = glyph_units(arguments[0], resources['/Font'][font_name])
            chunks.append((index, len(units), len(glyphs), glyphs))
            units.extend(glyphs)
        elif operator == b'TJ':
            # Audited brand runs consist solely of Tj characters. Fail instead
            # of silently shifting type if a later source uses a different run.
            assert not chunks or not BRAND_PATTERN.search(''.join(text for _, text in units))
        elif operator == b'ET':
            text = ''.join(character for _, character in units)
            ranges = [(match.start(), match.end()) for match in BRAND_PATTERN.finditer(text)]
            if not ranges:
                continue
            cursor = 0
            glyph_ranges = []
            for _, character in units:
                glyph_ranges.append((cursor, cursor + len(character)))
                cursor += len(character)
            for operation_index, start, length, glyphs in chunks:
                kept = []
                for delta, (code, _) in enumerate(glyphs):
                    low, high = glyph_ranges[start + delta]
                    if not any(low < end and high > begin for begin, end in ranges):
                        kept.append(code)
                if kept:
                    operations[operation_index] = ([ByteStringObject(b''.join(kept))], b'Tj')
                else:
                    removed_operations.add(operation_index)
            modifications.append({'resourcePath': chain, 'font': font_name,
                                  'before': text, 'after': BRAND_PATTERN.sub('', text)})
    content.operations = [operation for index, operation in enumerate(operations) if index not in removed_operations]
    return content


def rewrite_native_forms(stream, resources, owner, chain, modifications, visited):
    # 品牌可能藏在多层 Form XObject；按对象身份去重，防止共享资源重复改写或递归环。
    content = strip_native_brand_text(stream, resources, owner, chain, modifications)
    xobjects = resources.get('/XObject', {})
    for arguments, operator in content.operations:
        if operator != b'Do':
            continue
        name = arguments[0]
        reference = xobjects.raw_get(name)
        form = reference.get_object()
        if form.get('/Subtype') != '/Form':
            continue
        identity = getattr(reference, 'idnum', id(form))
        if identity in visited:
            continue
        visited.add(identity)
        rewritten = rewrite_native_forms(form, form.get('/Resources', resources), owner,
                                         chain + [str(name)], modifications, visited)
        xobjects[name] = decoded_form(form, rewritten)
    return content


def apply_photo_edits(page, owner, group, edits_directory, cache, replacements):
    # 只回嵌显式映射的已审核编辑图，不在脚本里猜测/涂抹商标；清单记录每张图的哈希。
    mappings = PHOTO_EDITS[group['file']]

    def rewrite(resources, visited, chain):
        xobjects = resources.get('/XObject', {})
        for name in list(xobjects):
            reference = xobjects.raw_get(name)
            original = reference.get_object()
            xref = getattr(reference, 'idnum', None)
            if original.get('/Subtype') == '/Form':
                identity = xref or id(original)
                if identity in visited:
                    continue
                visited.add(identity)
                rewrite(original.get('/Resources', resources), visited, chain + [str(name)])
            elif original.get('/Subtype') == '/Image' and xref in mappings:
                key = (group['file'], xref)
                edited_path = edits_directory / mappings[xref]
                width, height = int(original['/Width']), int(original['/Height'])
                if key not in cache:
                    with Image.open(edited_path) as edited:
                        # PDF stream encoding only: no semantic pixel painting.
                        rgb = edited.convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
                        replacement = DecodedStreamObject()
                        replacement.set_data(rgb.tobytes())
                        if group['file'] == 'V10L-EN.pdf' and xref == 204:
                            assert not chain and edited.mode == 'RGBA'
                            attach_intersection_alpha(page, owner, str(name), original.raw_get('/SMask'),
                                                      edited.getchannel('A'), width, height)
                    replacement.update({
                        NameObject('/Type'): NameObject('/XObject'),
                        NameObject('/Subtype'): NameObject('/Image'),
                        NameObject('/Width'): NumberObject(width),
                        NameObject('/Height'): NumberObject(height),
                        NameObject('/BitsPerComponent'): NumberObject(8),
                        NameObject('/ColorSpace'): NameObject('/DeviceRGB'),
                    })
                    if '/SMask' in original and not (group['file'] == 'V10L-EN.pdf' and xref == 204):
                        replacement[NameObject('/SMask')] = original.raw_get('/SMask')
                    if '/Interpolate' in original:
                        replacement[NameObject('/Interpolate')] = original['/Interpolate']
                    cache[key] = replacement.flate_encode()
                xobjects[name] = cache[key]
                replacements.append({'originalXref': xref, 'resourcePath': chain + [str(name)],
                                     'editedFile': str(edited_path.relative_to(ROOT)),
                                     'editedSha256': digest(edited_path), 'pdfPixelSize': [width, height],
                                     'maskStrategy': ('nativePdfOriginalTimesEditedAlpha'
                                                      if group['file'] == 'V10L-EN.pdf' and xref == 204
                                                      else 'originalPdfAlpha' if '/SMask' in original else 'opaque'),
                                     'originalSoftMaskPreserved': '/SMask' in original})

    rewrite(page['/Resources'], set(), [])


def export_png_name(group, original_page):
    label = {'demo-guidance': 'EC100', 'demo-measure': 'V10L', 'demo-garden': 'Vela'}[group]
    return f'{label}-{original_page:02d}.png'


def center_vela_title(page, owner):
    """Recenter only the retained Vela title; keep the native font and baseline."""
    parent = page['/Resources']['/XObject']['/X27']
    title = parent['/Resources']['/XObject']['/X22']
    content = ContentStream(title, owner)
    # Audited native glyph bbox: x=281.696707..437.039039 pt on a
    # 594.75-pt-wide page. Its remaining title needs -61.9928735 pt.
    # Divide by the existing .23999999 * 3.1232014 text transform.
    shift = -82.70626321503363
    changed = 0
    for arguments, operator in content.operations:
        if operator == b'Tm':
            arguments[4] = FloatObject(float(arguments[4]) + shift)
            changed += 1
    assert changed == 2
    parent['/Resources']['/XObject'][NameObject('/X22')] = decoded_form(title, content)
    return {'resourcePath': ['/X27', '/X22'], 'textMatrixXShift': shift,
            'reason': 'Center the retained Vela model title after removing its brand prefix'}


def nested_text_signatures(stream, resources, owner, path=()):
    # 同时检查顶层和嵌套表单，避免“主页面文字未变”掩盖子资源中的型号文字损坏。
    signatures = {}
    content = ContentStream(stream, owner)
    signature = text_signature(content, owner)
    if signature:
        signatures[path] = signature
    for arguments, operator in content.operations:
        if operator == b'Do':
            child = resources['/XObject'][arguments[0]]
            if child.get('/Subtype') == '/Form':
                signatures.update(nested_text_signatures(child, child.get('/Resources', resources), owner,
                                                        path + (str(arguments[0]),)))
    return signatures


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def remove_do(stream, owner, names):
    """Keep q/Q and marked-content boundaries; remove only targeted Do draws."""
    content = ContentStream(stream, owner)
    removed = []
    operations = []
    for arguments, operator in content.operations:
        if operator == b'Do' and str(arguments[0]) in names:
            removed.append(str(arguments[0]))
        else:
            operations.append((arguments, operator))
    assert sorted(removed) == sorted(names), (removed, names)
    content.operations = operations
    return content


def decoded_form(form, content):
    # 内容已解码，不能继承旧压缩流的 Filter/Length；其余资源与坐标元数据原样保留。
    replacement = DecodedStreamObject()
    for key, value in form.items():
        if key not in ('/Length', '/Filter', '/DecodeParms'):
            replacement[key] = value
    replacement.set_data(content.get_data())
    return replacement


def text_signature(stream, owner):
    # Compare the exact text drawing/state instructions, avoiding extraction's
    # line-break and font-decoding changes around removed image Do operations.
    text_operators = {b'BT', b'ET', b'Tf', b'Tm', b'Td', b'TD', b'T*', b'Tc',
                      b'Tw', b'Tz', b'TL', b'Tr', b'Ts', b'Tj', b'TJ', b"'", b'"'}
    content = ContentStream(stream, owner)
    content.operations = [(args, op) for args, op in content.operations if op in text_operators]
    return content.get_data()


def prepare_page(reader, page_number, group):
    # 以下 xref/尺寸来自已核对的这三份原 PDF；任一指纹变化就中断，防止误删其它图层。
    page = reader.pages[page_number - 1]
    before_text = text_signature(page.get_contents(), reader)
    xobjects = page['/Resources']['/XObject']
    removed = []
    if group['id'] == 'demo-garden':
        form_ref = xobjects.raw_get('/X27')
        assert form_ref.idnum == 21
        form = form_ref.get_object()
        names = [f'/X{n}' for n in range(7, 21)]
        assert all(form['/Resources']['/XObject'][n]['/Subtype'] == '/Form' for n in names)
        stream = remove_do(form, reader, names)
        for name in names:
            del form['/Resources']['/XObject'][NameObject(name)]
        xobjects[NameObject('/X27')] = decoded_form(form, stream)
        removed = ['/X27 > ' + name for name in names]
    else:
        name, xref, width, height = group['pages'][page_number]
        ref = xobjects.raw_get(name)
        image = ref.get_object()
        assert ref.idnum == xref
        assert image['/Subtype'] == '/Image'
        assert (image['/Width'], image['/Height']) == (width, height)
        assert '/SMask' in image, 'Expected the audited transparent logo image'
        targets = [name]
        if group['id'] == 'demo-measure' and page_number == 1:
            assert xobjects.raw_get('/X6').idnum == 36
            targets.append('/X6')  # Native yellow corner brand plate.
            original = ContentStream(page.get_contents(), reader)
            assert original.operations[74][1] == b'm'
            assert original.operations[75][1] == b'l'
            assert original.operations[76][1] == b'S'
            # End the path without stroking. Preserve its graphics/Artifact scopes.
            original.operations[76] = ([], b'n')
            stream = remove_do(original, reader, targets)
            removed.append('corner brand underline: S -> n (original operation 76)')
        else:
            stream = remove_do(page.get_contents(), reader, targets)
        page[NameObject('/Contents')] = stream
        for target in targets:
            del xobjects[NameObject(target)]
        removed.extend(targets)
    assert text_signature(page.get_contents(), reader) == before_text, 'Product text instructions changed'
    return page, removed


def verify(receipt):
    # 验证导出数量、原件哈希、整页比例、品牌文字与图片替换，以及非品牌原生文字不变。
    assert len(receipt['pages']) == 11
    assert len(list(OUTPUT.glob('*.webp'))) == 33
    assert len(list((EXPORT / 'PNG').glob('*.png'))) == 11
    for group in receipt['documents']:
        source = ROOT / group['source']
        assert digest(source) == group['sourceSha256'], 'Source PDF changed'
        target = ROOT / group['pdf']
        assert digest(target) == group['pdfSha256']
        pdf = PdfReader(target)
        assert len(pdf.pages) == group['selectedPages']
        if receipt.get('allBrandTextRemoved'):
            with pdfplumber.open(target) as document:
                searchable = ''.join(re.sub(r'\s+', '', page.extract_text() or '') for page in document.pages)
                assert not re.search(r'FJD', searchable, re.IGNORECASE), 'Searchable brand text remains'
    for item in receipt['pages']:
        with Image.open(ROOT / item['png']) as image:
            assert list(image.size) == item['pixelSize']
            assert max(image.size) == 2560
        ratio = item['pdfSize'][0] / item['pdfSize'][1]
        for size in SIZES:
            file = OUTPUT / f"{item['id']}-{size}.webp"
            with Image.open(file) as image:
                assert max(image.size) == size
                assert abs(image.width / image.height - ratio) < .01
        source_reader = PdfReader(ROOT / item['source'])
        cleaned_reader = PdfReader(ROOT / item['pdf'])
        original = source_reader.pages[item['sourcePage'] - 1]
        cleaned = cleaned_reader.pages[item['exportPage'] - 1]
        assert tuple(original.mediabox) == tuple(cleaned.mediabox)
        if receipt.get('allBrandTextRemoved'):
            file = Path(item['source']).name
            expected_bitmap_refs = {image.indirect_reference.idnum for image in original.images
                                    if image.indirect_reference.idnum in PHOTO_EDITS[file]}
            actual_bitmap_refs = {replacement['originalXref'] for replacement in item['photoReplacements']}
            assert expected_bitmap_refs == actual_bitmap_refs, f"Bitmap cleanup is incomplete: {item['id']}"
            for replacement in item['photoReplacements']:
                if 'resourcePath' not in replacement:
                    continue  # Receipts from the initial verified review copy.
                original_resources, cleaned_resources = original['/Resources'], cleaned['/Resources']
                for name in replacement['resourcePath'][:-1]:
                    original_resources = original_resources['/XObject'][name]['/Resources']
                    cleaned_resources = cleaned_resources['/XObject'][name]['/Resources']
                name = replacement['resourcePath'][-1]
                original_image, cleaned_image = original_resources['/XObject'][name], cleaned_resources['/XObject'][name]
                assert (original_image['/Width'], original_image['/Height']) == (cleaned_image['/Width'], cleaned_image['/Height'])
                if '/SMask' in original_image:
                    if replacement.get('maskStrategy') == 'nativePdfOriginalTimesEditedAlpha':
                        alpha_form = cleaned['/Resources']['/ExtGState']['/UnbrandedProductAlpha']['/SMask']['/G']
                        assert original_image['/SMask'].get_data() == alpha_form['/Resources']['/XObject']['/OriginalAlpha'].get_data()
                        assert '/SMask' not in cleaned_image
                    else:
                        assert original_image['/SMask'].get_data() == cleaned_image['/SMask'].get_data(), 'Original cutout mask changed'
            changes = []
            expected = rewrite_native_forms(original.get_contents(), original['/Resources'], source_reader,
                                             [], changes, set())
            if item['group'] == 'demo-garden':
                center_vela_title(original, source_reader)
            assert text_signature(expected, source_reader) == text_signature(cleaned.get_contents(), cleaned_reader)
            assert nested_text_signatures(expected, original['/Resources'], source_reader) == nested_text_signatures(
                cleaned.get_contents(), cleaned['/Resources'], cleaned_reader)
            remaining = []
            rewrite_native_forms(cleaned.get_contents(), cleaned['/Resources'], cleaned_reader,
                                 [], remaining, set())
            assert not remaining, 'A native FJD brand run remains in a PDF'
        else:
            assert text_signature(original.get_contents(), source_reader) == text_signature(cleaned.get_contents(), cleaned_reader)
        if item['group'] == 'demo-garden':
            form = cleaned['/Resources']['/XObject']['/X27']
            assert all(f'/X{n}' not in form['/Resources']['/XObject'] for n in range(7, 21))
        else:
            name = next(g for g in GROUPS if g['id'] == item['group'])['pages'][item['sourcePage']][0]
            assert name not in cleaned['/Resources']['/XObject']
    print('Verified 3 native logo-free PDFs, 11 full-page PNGs and 33 WebP variants.')


def main():
    # 普通生成、暂存审阅与发布暂存件是独立入口；--verify 只核对已有交付物。
    global EXPORT, OUTPUT, RECEIPT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdftoppm', default=shutil.which('pdftoppm'))
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--full-brand-removal', action='store_true', default=True,
                        help='Also remove native FJD text and use approved edited product photographs.')
    parser.add_argument('--corner-only', dest='full_brand_removal', action='store_false',
                        help='Explicit legacy mode: remove only the independently drawn corner logos.')
    parser.add_argument('--photo-edits-dir', type=Path, default=EXPORT / '处理素材')
    parser.add_argument('--stage-only', action='store_true',
                        help='Write a review copy under tmp/pdfs/logo-free/full-brand-removal.')
    parser.add_argument('--publish-staged', action='store_true',
                        help='Publish the fully verified staged files without rendering again.')
    parser.add_argument('--only-document', choices=[group['file'] for group in GROUPS],
                        help='Rerender one document in an existing complete staged/export manifest.')
    args = parser.parse_args()
    staged = TEMP / 'full-brand-removal'
    if args.publish_staged:
        old_receipt = json.loads(RECEIPT.read_text(encoding='utf-8'))
        staged_receipt = json.loads((staged / '素材清单.json').read_text(encoding='utf-8'))
        assert staged_receipt.get('allBrandTextRemoved')
        for directory in (EXPORT / 'PDF', EXPORT / 'PNG', OUTPUT):
            directory.mkdir(parents=True, exist_ok=True)
        for document in staged_receipt['documents']:
            source = ROOT / document['pdf']
            target = EXPORT / 'PDF' / source.name
            shutil.copyfile(source, target)
            document['pdf'] = target.relative_to(ROOT).as_posix()
        for page in staged_receipt['pages']:
            source = ROOT / page['png']
            target = EXPORT / 'PNG' / source.name
            shutil.copyfile(source, target)
            page['png'] = target.relative_to(ROOT).as_posix()
            page['pdf'] = (EXPORT / 'PDF' / Path(page['pdf']).name).relative_to(ROOT).as_posix()
            for replacement in page['photoReplacements']:
                replacement.setdefault('maskStrategy', 'originalPdfAlpha' if replacement['originalSoftMaskPreserved'] else 'opaque')
            for size in SIZES:
                name = f"{page['id']}-{size}.webp"
                shutil.copyfile(staged / 'WebP' / name, OUTPUT / name)
        # Remove only this script's prior, verified PNG names after their newly
        # named replacements exist. Never enumerate or delete source artwork.
        new_paths = {page['png'] for page in staged_receipt['pages']}
        for page in old_receipt['pages']:
            old_path = ROOT / page['png']
            assert old_path.resolve().parent == (EXPORT / 'PNG').resolve()
            if page['png'] not in new_paths and old_path.is_file():
                assert old_path.name == f"{page['id']}.png"
                old_path.unlink()
        RECEIPT.write_text(json.dumps(staged_receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        verify(staged_receipt)
        return
    if args.stage_only:
        assert args.full_brand_removal, '--stage-only is for the complete brand-removal review'
        EXPORT = staged
        OUTPUT = staged / 'WebP'
        RECEIPT = staged / '素材清单.json'
    if args.verify:
        verify(json.loads(RECEIPT.read_text(encoding='utf-8')))
        return
    if not args.pdftoppm:
        parser.error('Pass --pdftoppm with the installed Poppler executable.')
    if args.full_brand_removal:
        required = {name for images in PHOTO_EDITS.values() for name in images.values()}
        missing = sorted(name for name in required if not (args.photo_edits_dir / name).is_file())
        if missing:
            parser.error('Approved image edits are missing: ' + ', '.join(missing))
    for directory in (OUTPUT, TEMP, EXPORT / 'PDF', EXPORT / 'PNG'):
        directory.mkdir(parents=True, exist_ok=True)
    receipt = {
        'method': 'Native PDF text/vector removal; Poppler rendering',
        'scope': 'Corner FJD brand logos and their plaques only; product titles and photographed marks preserved',
        'documents': [], 'pages': [],
    }
    if args.full_brand_removal:
        receipt['allBrandTextRemoved'] = True
        receipt['scope'] = 'All FJD brand marks and native brand text removed; product models and technical copy retained'
        receipt['method'] = 'Native text/vector removal + builtin imagegen brand cleanup on extracted bitmaps + Poppler rendering'
        receipt['editedBitmapInputs'] = [{'file': (args.photo_edits_dir / name).relative_to(ROOT).as_posix(),
                                         'sha256': digest(args.photo_edits_dir / name)}
                                        for name in sorted(required)]
        receipt['validation'] = ['Original PDF SHA256 unchanged',
                                 'All retained native text drawing and font-state operations match the source after removing brand glyphs',
                                 'Native brand runs checked recursively inside PDF Forms',
                                 'Vela title alone receives an audited horizontal centering adjustment',
                                 'PDF dimensions preserved; cutout mask strategy recorded per bitmap',
                                 'Bitmap 204 uses a native PDF original-times-edited-alpha mask to suppress edge noise']
    if args.only_document:
        previous = json.loads(RECEIPT.read_text(encoding='utf-8'))
        assert previous.get('allBrandTextRemoved') == args.full_brand_removal
        receipt['documents'] = [document for document in previous['documents']
                                if Path(document['source']).name != args.only_document]
        chosen_group = next(group for group in GROUPS if group['file'] == args.only_document)['id']
        receipt['pages'] = [page for page in previous['pages'] if page['group'] != chosen_group]
    image_cache = {}
    for group in GROUPS:
        if args.only_document and group['file'] != args.only_document:
            continue
        source = SOURCE / group['file']
        before_hash = digest(source)
        reader = PdfReader(source)
        writer = PdfWriter()
        page_records = []
        pdf_path = EXPORT / 'PDF' / f"{source.stem}-去Logo.pdf"
        for exported_number, original_number in enumerate(group['pages'], 1):
            page, removed = prepare_page(reader, original_number, group)
            brand_text_changes = []
            photo_replacements = []
            layout_adjustments = []
            if args.full_brand_removal:
                if group['id'] == 'demo-garden':
                    # The first background photo is wholly covered by the
                    # opaque /X6 photograph; discard its hidden brand marks.
                    form = page['/Resources']['/XObject']['/X27']
                    stripped = remove_do(form, reader, ['/X4'])
                    del form['/Resources']['/XObject'][NameObject('/X4')]
                    page['/Resources']['/XObject'][NameObject('/X27')] = decoded_form(form, stripped)
                    removed.append('/X27 > /X4 (fully covered old background)')
                if group['id'] == 'demo-measure' and original_number in BRAND_SHADOWS:
                    shadow = BRAND_SHADOWS[original_number]
                    page[NameObject('/Contents')] = remove_do(page.get_contents(), reader, [shadow])
                    del page['/Resources']['/XObject'][NameObject(shadow)]
                    removed.append(shadow + ' (brand-line decorative shadow)')
                rewritten = rewrite_native_forms(page.get_contents(), page['/Resources'], reader,
                                                 [], brand_text_changes, set())
                page[NameObject('/Contents')] = rewritten
                if group['id'] == 'demo-garden':
                    layout_adjustments.append(center_vela_title(page, reader))
                apply_photo_edits(page, reader, group, args.photo_edits_dir, image_cache, photo_replacements)
            writer.add_page(page)
            asset_id = f"{group['id']}-{original_number:02d}"
            page_records.append({
                'id': asset_id, 'group': group['id'],
                'source': source.relative_to(ROOT).as_posix(),
                'sourcePage': original_number, 'exportPage': exported_number,
                'pdf': pdf_path.relative_to(ROOT).as_posix(),
                'pdfSize': [float(page.mediabox.width), float(page.mediabox.height)],
                'removed': removed,
                'nativeTextChanges': brand_text_changes,
                'photoReplacements': photo_replacements,
                'nativeLayoutAdjustments': layout_adjustments,
            })
        writer.add_metadata({'/Title': f"{source.stem} - selected logo-free portfolio pages",
                             '/Subject': ('Brand marks and text removed; product models and technical copy preserved'
                                          if args.full_brand_removal else 'Corner brand objects removed; original artwork preserved')})
        with pdf_path.open('wb') as stream:
            writer.write(stream)
        assert digest(source) == before_hash, 'Source PDF must remain unchanged'
        receipt['documents'].append({
            'source': source.relative_to(ROOT).as_posix(), 'sourceSha256': before_hash,
            'pdf': pdf_path.relative_to(ROOT).as_posix(), 'pdfSha256': digest(pdf_path),
            'selectedPages': len(page_records),
        })
        for item in page_records:
            prefix = TEMP / item['id']
            subprocess.run([args.pdftoppm, '-f', str(item['exportPage']), '-l', str(item['exportPage']),
                            '-singlefile', '-scale-to', '2560', '-png', str(pdf_path), str(prefix)],
                           check=True)
            png_path = EXPORT / 'PNG' / (export_png_name(item['group'], item['sourcePage'])
                                       if args.full_brand_removal else f"{item['id']}.png")
            shutil.copyfile(prefix.with_suffix('.png'), png_path)
            with Image.open(png_path) as rendered:
                item['pixelSize'] = list(rendered.size)
                for size in SIZES:
                    image = rendered.convert('RGB')
                    image.thumbnail((size, size), Image.Resampling.LANCZOS)
                    image.save(OUTPUT / f"{item['id']}-{size}.webp", quality=88, method=6)
            prefix.with_suffix('.png').unlink()
            item['png'] = png_path.relative_to(ROOT).as_posix()
            receipt['pages'].append(item)
            print(f"Rendered {item['id']}: original page {item['sourcePage']} -> export page {item['exportPage']}", flush=True)
    RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    verify(receipt)


if __name__ == '__main__':
    main()
