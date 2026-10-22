"""Verify preserved files, portable sources, source claims and runtime captures."""
from pathlib import Path
import hashlib
import json
import shutil

project = Path(__file__).resolve().parents[1]
root = project / '参考资料/Squarespace-Foundations/2026-10-14'
def read(path):
    return json.loads(path.read_text(encoding='utf-8'))
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

previous = read(root/'已有资料-校验清单.json')['files']
# 先验证原始副本，再验证报告所引用的字节偏移和截图路径，避免断链报告冒充完整资料。
for item in previous:
    path = root/item['archived']
    assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], path
    original = project/item['original']
    assert sha(original) == item['sha256'], original

source_records = read(root/'来源索引.json')['records']
for item in source_records:
    path = root/item['archived_file']
    assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], path
claims_verified = 0
for page in ('logo','typography','photography','campaign'):
    base = root/'02-补充页面'/page
    evidence = read(base/'source-map.json')
    for claim in evidence.get('claims',evidence.get('facts',[])):
        path = base/claim['file']
        raw = path.read_bytes()
        digest = claim.get('source_sha256',claim.get('sha256'))
        assert hashlib.sha256(raw).hexdigest() == digest.lower(), path
        if 'needle' in claim:
            offset = claim['byte_start_zero_based']
            needle = claim['needle'].encode('utf-8')
            assert raw[offset:offset+len(needle)] == needle, (path,offset)
        else:
            offset = claim['utf8_byte_offset']
            snippet = claim['snippet'].encode('utf-8')
            assert raw[offset:offset+len(snippet)] == snippet, (path,offset)
        claims_verified += 1
    for filename in ('analysis.md','runtime.md','tokens.json','verification.json'):
        assert (base/filename).exists(), (page,filename)

index = read(root/'研究索引.json')
frame_count = 0
for page in index['pages']:
    for key in ('report','tokens'):
        assert (root/page[key]).exists(), page[key]
    if page['runtime']:
        assert (root/page['runtime']).exists()
    for frame in page['frames']:
        for key in ('image','dom','accessibility'):
            if frame.get(key):
                assert (root/frame[key]).exists(), frame[key]
        frame_count += 1

scenarios = read(root/'03-原始证据/runtime-summary.json')
runtime_captures = read(root/'03-原始证据/capture-index.json')
for capture in runtime_captures:
    for path in capture['files'].values():
        assert (root/path).exists(), path
summary = {'status':'pass','date':'2026-10-14','existing_copies_verified':len(previous),'source_records_verified':len(source_records),'precise_source_claims_verified':claims_verified,'pages':len(index['pages']),'viewer_frames_verified':frame_count,'supplement_reference_scenarios':len(scenarios),'supplement_steps':len(runtime_captures),'supplement_screenshots':sum('screenshot' in r['files'] for r in runtime_captures),'scenarios_without_action_failures':sum(all(s['status']=='completed' for s in scenario['steps']) for scenario in scenarios),'retained_failed_scenarios':sum(any(s['status']!='completed' for s in scenario['steps']) for scenario in scenarios)}
shutil.copy2(project/'scripts/verify-reference-archive.py',root/'04-复现脚本/verify-reference-archive.py')
files = []
for path in sorted(root.rglob('*')):
    if path.is_file() and path.name != '完整性校验.json':
        files.append({'file':path.relative_to(root).as_posix(),'bytes':path.stat().st_size,'sha256':sha(path)})
summary.update({'manifest_files':len(files),'manifest_total_bytes':sum(row['bytes'] for row in files),'manifest_excludes':'完整性校验.json itself only','files':files})
(root/'完整性校验.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in summary.items() if key != 'files'},ensure_ascii=False,indent=2))
