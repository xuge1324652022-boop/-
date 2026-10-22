"""Extract unchanged REA artifacts and concise page summaries for research."""
from pathlib import Path
from html.parser import HTMLParser
import base64
import hashlib
import json
import re

class Outline(HTMLParser):
    # 只抽取可见文案/控件标签供检索；脚本、样式和 SVG 内容不作为页面叙述。
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []
        self.buttons = []
        self.classes = set()
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style', 'svg'):
            self.skip += 1
        if 'class' in attrs:
            self.classes.update(attrs['class'].split())
        if tag in ('button', 'a') and attrs.get('aria-label'):
            self.buttons.append({"tag": tag, "label": attrs['aria-label'], "href": attrs.get('href')})
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'svg') and self.skip:
            self.skip -= 1
    def handle_data(self, data):
        if not self.skip and data.strip():
            self.parts.append(data.strip())

root = Path(__file__).resolve().parents[1] / '参考资料/Squarespace-Foundations/2026-10-14'
bundle = json.loads((root / '03-原始证据/补充研究-REA.json').read_text(encoding='utf-8'))
pages = {'logo', 'typography', 'photography', 'campaign'}
index = []
summary = []
for record in bundle['records']:
    # 原始失败步骤同样留在索引中；只提取已有证据，不把未执行动作补写成成功。
    if record.get('operation') != 'capture_browser_scenario':
        continue
    result = record.get('normalized_result', {})
    steps = result.get('steps', [])
    urls = [s.get('after_url', {}).get('url', '') for s in steps]
    page = next((p for p in pages if any(u.split('?')[0].rstrip('/') == f'https://brand.squarespace.com/{p}' for u in urls)), None)
    if not page:
        continue
    target = root / '02-补充页面' / page
    captures = target / 'captures'
    captures.mkdir(parents=True, exist_ok=True)
    scenario = {'page': page, 'evidence_id': record['evidence_id'], 'status': result.get('status'), 'steps': []}
    for step in steps:
        row = {'page': page, 'evidence_id': record['evidence_id'], 'step_id': step['step_id'], 'status': step['status'], 'url': step.get('after_url', {}).get('url'), 'files': {}}
        name = record['evidence_id'][3:11] + '-' + re.sub(r'[^A-Za-z0-9_-]', '-', step['step_id'])
        dom = None
        for kind, artifact in step.get('artifacts', {}).items():
            if artifact.get('state') != 'captured':
                continue
            value = artifact['value']
            if kind == 'screenshot':
                data = base64.b64decode(value['data_base64'], validate=True)
                assert hashlib.sha256(data).hexdigest() == value['sha256']
                path = captures / (name + '.png')
                path.write_bytes(data)
            elif kind == 'dom':
                dom = value['text']
                path = captures / (name + '.html')
                path.write_text(dom, encoding='utf-8')
            elif kind == 'accessibility':
                path = captures / (name + '-accessibility.txt')
                path.write_text(value['text'], encoding='utf-8')
            else:
                continue
            row['files'][kind] = path.relative_to(root).as_posix()
        index.append(row)
        entry = {'step_id': step['step_id'], 'status': step['status'], 'error': step.get('error')}
        if dom is not None:
            outline = Outline()
            outline.feed(dom)
            entry.update({'visible_and_hidden_dom_text': ' | '.join(outline.parts), 'controls': outline.buttons,
                'page_classes': sorted(c for c in outline.classes if c.lower().startswith(page) or c.startswith('intro')),
                'transforms': re.findall(r'<[^>]+style="[^"]*(?:transform|opacity)[^"]*"[^>]*>', dom)})
        scenario['steps'].append(entry)
    summary.append(scenario)
(root / '03-原始证据/capture-index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')
(root / '03-原始证据/runtime-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'scenarios': len(summary), 'steps': len(index), 'screenshots': sum('screenshot' in row['files'] for row in index), 'pages': sorted(set(row['page'] for row in index))}, ensure_ascii=False))
