"""Build a portable, offline research viewer and page/runtime evidence indices."""
from pathlib import Path
import hashlib
import json
import re
import shutil

project = Path(__file__).resolve().parents[1]
root = project / '参考资料/Squarespace-Foundations/2026-10-14'
shared = root / '01-已有分析/完整研究包/static'
captures = json.loads((root / '03-原始证据/capture-index.json').read_text(encoding='utf-8'))
scenarios = json.loads((root / '03-原始证据/runtime-summary.json').read_text(encoding='utf-8'))
by_step = {(r['evidence_id'][3:11], r['step_id']): r for r in captures}

definitions = [
    ('home', '首页与索引', '/', '独立的主视觉和索引状态，透明顶部文字入口', '01-已有分析/完整研究包/report.md', [
        ('b31d1ade','home-ready','主视觉'),('b31d1ade','next-rest','点击下一项'),('b31d1ade','index-rest','打开索引')]),
    ('logo', 'Logo', '/logo', '滚动构形 → 完成后点击缩放；分屏配色和图像裁剪同步推进', '02-补充页面/logo/analysis.md', [
        ('ae37da4d','ready','章节介绍'),('ae37da4d','rest-2','符号构形'),('ae37da4d','rest-3','字标构形'),('ae37da4d','rest-4','完整标志'),('24333a46','zoom-in-rest','点击 Zoom'),('24333a46','zoom-out-rest','再点击返回'),('ae37da4d','rest-7','分屏起点'),('ae37da4d','rest-8','图像与配色同步'),('ae37da4d','rest-10','下一套配色'),('05c48aa4','carousel-rest','应用轮播'),('05c48aa4','next-example-rest','点击下一应用'),('05c48aa4','end-rest','章节结尾')]),
    ('typography', 'Typography', '/typography', '时间序列 → 字体编辑；文字规则展开 → 实测坐标重组 → 独立空间离场', '02-补充页面/typography/analysis.md', [
        ('6b7770eb','ready','章节介绍'),('6b7770eb','rest-1','文字序列'),('813a2397','sequence-complete','序列完成，开放编辑'),('813a2397','edit-rest','输入完整文字'),('813a2397','serif-rest','切换衬线字体'),('813a2397','shuffle-rest','切换颜色与字体并保留输入'),('6b7770eb','rest-10','字母 3D 弧线'),('6b7770eb','rest-15','衬线比较'),('6b7770eb','rest-19','凝缩文字'),('5b626c23','tail-rest-19','文字规则进入'),('5b626c23','tail-rest-21','四类规则完整展开'),('5b626c23','tail-rest-23','重组成实际版面'),('5b626c23','tail-rest-24','最终版面'),('5b626c23','type-footer-rest','章节结尾')]),
    ('color', 'Color', '/color', '全屏色彩 → 首张海报 → 附属海报错峰加入 → 空间转向 → 正文接续', '01-已有分析/完整研究包/report.md', [
        ('7414c24e','rest-14','全屏色彩'),('7414c24e','rest-15','背景与图框收拢'),('7414c24e','rest-16','首张海报成型'),('7414c24e','rest-17','附属海报进入'),('7414c24e','rest-18','透视与正文接续'),('7414c24e','rest-19','后续内容')]),
    ('photography', 'Photography', '/photography', '双层视差；Shuffle；74 张照片浏览与独立缩放状态；尾段圆弧轮播', '02-补充页面/photography/analysis.md', [
        ('90e43ff2','ready','章节介绍'),('90e43ff2','rest-1','第一套双层视差'),('90e43ff2','rest-3','第二套接续'),('90e43ff2','rest-4','第三套接续'),('9128420e','shuffle-rest','点击 Shuffle Sets'),('90e43ff2','rest-8','照片网格'),('b43f03ff','open-rest','打开第 1 张'),('b43f03ff','zoom-in-rest','点击放大'),('b43f03ff','zoom-out-rest','点击缩回'),('b43f03ff','image-2-rest','选择第 2 张'),('b43f03ff','closed-rest','关闭，返回图库'),('90e43ff2','rest-16','应用轮播与章节结尾')]),
    ('campaign', 'Campaign', '/campaign', '全幅影片收拢为缩略图 → 展开选片 → 独立播放器；结尾空间图库', '02-补充页面/campaign/analysis.md', [
        ('fa72b210','ready','章节介绍'),('fa72b210','rest-1','全幅影片'),('fa72b210','rest-2','Flip 收拢'),('fa72b210','rest-3','缩略图展开'),('d79ff706','next-film-rest','点击下一影片'),('d79ff706','film-rest','打开播放器'),('d79ff706','film-closed-rest','关闭播放器'),('fa72b210','rest-9','奖项区域'),('d79ff706','library-film-rest','从作品库打开影片'),('fa72b210','rest-17','空间图库'),('ab8a9202','card-rest','Enter 激活单卡展开'),('ab8a9202','closed-rest','关闭并返回空间图库'),('fa72b210','rest-19','章节结尾')]),
    ('motion', 'Motion', '/motion', '多层 z 深度收拢到同一平面，进入交互模式后点击换卡', '01-已有分析/完整研究包/report.md', [
        ('e8f7f499','ready','章节介绍'),('e8f7f499','rest-1','透视堆叠'),('e8f7f499','rest-2','接近收拢'),('e8f7f499','rest-3','同平面收拢'),('e8f7f499','rest-4','交互模式'),('e8f7f499','rest-6','后续内容')])
]
previous_index = json.loads((root / '01-已有分析/完整研究包/capture-index.json').read_text(encoding='utf-8'))
for row in previous_index:
    row = dict(row)
    row['files'] = {kind:'01-已有分析/完整研究包/'+path.replace('\\','/') for kind,path in row['files'].items()}
    by_step[(row['evidence_id'][3:11],row['step_id'])] = row
groups = []
for page,title,route,note,report,frames in definitions:
    selected = []
    for prefix,step,label in frames:
        row = by_step[(prefix,step)]
        assert row['status'] == 'completed', (page,step,row['status'])
        assert (root / row['files']['screenshot']).exists()
        selected.append({'label':label,'step':step,'evidence_id':row['evidence_id'],'image':row['files']['screenshot'],'dom':row['files'].get('dom'),'accessibility':row['files'].get('accessibility')})
    groups.append({'id':page,'title':title,'url':'https://brand.squarespace.com'+route,'note':note,'report':report,'report_text':(root/report).read_text(encoding='utf-8'),'frames':selected,'runtime':f'02-补充页面/{page}/runtime.md' if page in ('logo','typography','photography','campaign') else None,'tokens':f'02-补充页面/{page}/tokens.json' if page in ('logo','typography','photography','campaign') else '01-已有分析/完整研究包/reference-tokens.json'})
viewer_data = {'date':'2026-10-14','pages':groups}
(root / '研究索引.json').write_text(json.dumps(viewer_data,ensure_ascii=False,indent=2),encoding='utf-8')
template = (project/'scripts/reference-archive-viewer.html').read_text(encoding='utf-8')
embedded = json.dumps(viewer_data,ensure_ascii=False).replace('</','<\\/')
(root/'index.html').write_text(template.replace('__RESEARCH_DATA__',embedded),encoding='utf-8')

runtime_notes = {
    'logo':'滚动场景覆盖符号线稿、字标、完整标志以及分屏配色；两次点击 Zoom 的动作均完成。另一次修正场景使用实际 DOM 中的 `.crslBasic button[dir="right"]`，验证应用轮播。最初下一项定位器错误导致超时，该失败记录保留。Rive 内部曲线尚未解码',
    'typography':'已走到 Clarkson、Serif、Condensed、Family、Bespoke 和 Color 章节入口。Family 从四行规则展开到绿色应用版面的截图分别保留。首次直接 fill 仅留下 n，源码首次输入处理会清提示语并取最后一字；修正为先按 D，再填入 Design in motion，字体切换与 Shuffle 后 DOM 仍保留完整句子。Canvas 持续指针输入不在本次 PageDown / 点击验证范围',
    'photography':'首段三套视差画面、网格和章节结尾已采样。点击 Shuffle 成功。打开图片 1、放大、缩回、选择图片 2、关闭均由修正场景成功完成，DOM / 截图计数分别为 01/74、02/74。最初放大后直接选择缩略图失败，因为放大模式隐藏了侧栏；失败记录保留。网格拖拽惯性只由源码确认，尚未做真实拖动采样',
    'campaign':'采到全幅预览、Flip 收拢、六缩略图、奖项、作品库、空间图库及 Motion 章节入口。下一影片、打开/关闭播放器、从作品库打开影片并 Escape 关闭均完成。空间图库指针点击曾因定位匹配多个元素或目标遮挡超时；最终通过匹配按钮 Enter 激活单卡，Close gallery 返回，属于键盘验证，不能表述为指针拖拽验证'
}
for page,note in runtime_notes.items():
    data = [s for s in scenarios if s['page']==page]
    lines = [f'# {page.title()}：REA 运行时记录','',note,'','视口 1440×900、DPR 1、英文、reduced motion = no-preference；PageDown / PageUp 采样，不能代替连续滚轮或 FPS 测量','','## 场景清单','', '| Evidence ID | 步骤数 | 已完成 | 失败 / 未执行 |','| --- | ---: | ---: | ---: |']
    for scenario in data:
        complete = sum(step['status']=='completed' for step in scenario['steps'])
        lines.append(f"| `{scenario['evidence_id']}` | {len(scenario['steps'])} | {complete} | {len(scenario['steps'])-complete} |")
    lines.extend(['','## 阶段截图',''])
    group = next(g for g in groups if g['id']==page)
    for frame in group['frames']:
        path = Path(frame['image']).relative_to(Path('02-补充页面')/page).as_posix()
        lines.append(f"- [{frame['label']} / {frame['step']}]({path}) · `{frame['evidence_id'][3:11]}`")
    lines.extend(['','完整动作、状态、错误及 DOM 位于 [捕获索引](../../03-原始证据/capture-index.json) 与 [运行时概要](../../03-原始证据/runtime-summary.json)。失败步骤与未执行步骤未计作成功观察',''])
    (root/'02-补充页面'/page/'runtime.md').write_text('\n'.join(lines),encoding='utf-8')

sources = []
for page in runtime_notes:
    target = root / '02-补充页面' / page
    manifest = json.loads((target/'source-manifest.json').read_text(encoding='utf-8'))
    records = manifest if isinstance(manifest,list) else manifest['records']
    for record in records:
        if record.get('file'):
            path = target / record['file']
        elif record.get('reused_from'):
            path = shared / Path(record['reused_from']).name
        else:
            raise ValueError(record)
        assert path.exists(), path
        raw = path.read_bytes()
        assert hashlib.sha256(raw).hexdigest() == record['sha256'].lower(), path
        assert len(raw) == record['bytes'], path
        sources.append({'page':page,'url':record['url'],'archived_file':path.relative_to(root).as_posix(),'sha256':record['sha256'].lower(),'bytes':len(raw),'original_cache':record.get('reused_from')})
(root / '来源索引.json').write_text(json.dumps({'records':sources,'all_paths_relative_to_archive':True,'all_source_hashes_verified':True},ensure_ascii=False,indent=2),encoding='utf-8')

script_dir = root / '04-复现脚本'
script_dir.mkdir(exist_ok=True)
for name in ('archive-reference-research.py','extract-reference-supplement.py','reference-contact-sheets.py','build-reference-archive.py'):
    shutil.copy2(project/'scripts'/name,script_dir/name)
shutil.copy2(project/'scripts/reference-archive-viewer.html',script_dir/'reference-archive-viewer.html')
(script_dir/'README.md').write_text('这些脚本的原始位置为项目 scripts 目录，按原项目路径运行；此处为版本备份。提取脚本只解码并校验原始截图，不修改原截图；联系表为附加浏览图。最终校验脚本会另行保存在此目录\n',encoding='utf-8')
print(json.dumps({'pages':len(groups),'selected_frames':sum(len(g['frames']) for g in groups),'source_records_verified':len(sources)},ensure_ascii=False))
