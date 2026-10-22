"""Create labelled screenshot contact sheets; retain all source PNGs unchanged."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / '参考资料/Squarespace-Foundations/2026-10-14'
rows = json.loads((root / '03-原始证据/capture-index.json').read_text(encoding='utf-8'))
for page in ('logo','typography','photography','campaign'):
    # 选稳定停留帧拼成三列缩略概览，原截图不覆盖；这不是连续滚动或帧率的证据。
    selected = [r for r in rows if r['page'] == page and (r['step_id'] == 'ready' or r['step_id'].startswith('rest-'))]
    sheet = Image.new('RGB', (1440, ((len(selected)+2)//3)*320), '#e8e6e0')
    draw = ImageDraw.Draw(sheet)
    for n, row in enumerate(selected):
        x, y = n%3*480, n//3*320
        screenshot = Image.open(root / row['files']['screenshot']).convert('RGB')
        screenshot.thumbnail((472,295))
        sheet.paste(screenshot, (x+4,y+21))
        draw.text((x+8,y+5), page + ' / ' + row['step_id'], fill='#111111')
    sheet.save(root / '02-补充页面' / page / 'overview.jpg', quality=92)
print('Contact sheets created')
