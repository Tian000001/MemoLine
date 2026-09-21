"""ttq-time 演示数据生成 / 清理脚本。

往运行中的服务里灌一批带「演示」标记的事件、聊天记录、媒体和复盘报告，
让时间线和复盘页有足够内容可以演示。**不触碰任何已有真实数据**：
所有演示事件都带 `演示` 标签且描述以 `【演示】` 开头，报告标题以 `【演示】` 开头。

用法（项目根目录）：

    python\\python.exe scripts\\demo_data.py                 # 生成演示数据（默认打 127.0.0.1:3000）
    python\\python.exe scripts\\demo_data.py --spawn         # 自己拉起服务，灌完自动关闭
    python\\python.exe scripts\\demo_data.py --base http://127.0.0.1:3010
    python\\python.exe scripts\\demo_data.py --clean         # 清掉全部演示数据（事件/记录/报告/演示图片）

演示数据可重复执行：已存在同标记数据时会先清掉再重新生成（幂等）。
清单写在 data/demo_manifest.json，--clean 依据它精确删除演示期间上传的图片文件。
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:
    sys.stderr.write('缺少 requests，请先：python\\python.exe -m pip install -r backend\\requirements.txt\n')
    raise SystemExit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MEDIA_DIR = os.path.join(HERE, 'demo_media')
MANIFEST = os.path.join(ROOT, 'data', 'demo_manifest.json')

DEMO_TAG = '演示'
DEMO_PREFIX = '【演示】'
CST = timezone(timedelta(hours=8))

# ---------------------------------------------------------------- 内容定义
# (本地时间(月,日,时,分), 地点, 描述, 附加标签, 媒体文件列表, 聊天文本或 None)
EVENTS = [
    ((9, 19, 20, 30), '公司会议室 A', '团队复盘会：项目「青梧」2.0 上线后首次复盘，梳理上线一周的运行数据与遗留问题，明确三个改进项进入下个迭代。',
     ['工作', '复盘'], ['demo-meeting.png'],
     '[2026-09-19 21:40:00] 林晓: 今天的结论我整理好了，三个改进项一共两条给后端组\n'
     '[2026-09-19 21:41:12] 陈默: 收到，服务端监控告警阈值这周内调整完\n'
     '[2026-09-19 21:43:05] 张三: 复盘文档记得同步到知识库，下周一台里过一遍'),

    ((9, 14, 9, 10), '仁济医院体检中心', '年度体检报告解读，医生建议调整作息并增加有氧频率；两个轻度异常指标半年后复查。',
     ['健康'], [], None),

    ((9, 6, 15, 0), '舅舅家', '家庭聚会：外婆 78 岁生日，一大家子聚齐拍了全家福；答应外婆下个月带她去江南园林走一走。',
     ['家庭'], ['demo-family.png'],
     '[2026-09-06 18:22:10] 妈妈: 今天照片我发群里了，大家都看看\n'
     '[2026-09-06 18:25:44] 表妹小雨: 外婆笑得好开心，下次聚会我来订蛋糕\n'
     '[2026-09-06 18:31:02] 我: 下月园林之行我来安排行程'),

    ((8, 28, 11, 20), '公司 · 线上', '生产故障：支付回调大面积超时 25 分钟，定位为消息队列堆积触发重试风暴；临时扩容 + 降级开关恢复，事后补了监控盲区。',
     ['工作', '故障'], ['demo-incident.png'],
     '[2026-08-28 11:24:03] 值班-陈默: 告警响了，支付成功率掉到 82%\n'
     '[2026-08-28 11:26:40] 我: 拉起应急，先看队列堆积曲线\n'
     '[2026-08-28 11:52:18] 值班-陈默: 扩容生效，成功率回升到 99.2%\n'
     '[2026-08-28 12:05:11] 我: 复盘会定在明天上午，先把时间线整理出来'),

    ((8, 21, 19, 30), '威尔仕健身房', '力量训练第 12 周打卡：深蹲 5×5 完成 82.5kg，硬拉首次上 100kg；体重稳定在 71kg 左右。',
     ['健康', '运动'], ['demo-gym.png'], None),

    ((8, 15, 14, 0), '腾讯会议', '需求评审：智能复盘模块 v2，确定报告结构化字段与导出格式；疑点识别部分要求给出置信度，会后排期。',
     ['工作', '评审'], [],
     '[2026-08-15 14:32:00] 产品-苏珊: 报告要支持一键导出 PDF，字段固定五类\n'
     '[2026-08-15 14:35:26] 我: 结构化字段没问题，疑点置信度需要模型侧配合\n'
     '[2026-08-15 14:37:02] 林晓: 排期我会后发，先按两周预估'),

    ((8, 2, 8, 40), '杭州滨江', '出差：客户现场联调数据接入，白天对接字段映射，晚上整理问题清单 17 项，其中 3 项需要产品决策。',
     ['工作', '出差'], ['demo-trip.png'], None),

    ((7, 26, 16, 30), '万象城书店', '读书会：分享《卡片笔记写作法》，讨论「永久笔记」与项目笔记的衔接；约定下月共读《清晰思考》。',
     ['学习'], [], None),

    ((7, 18, 10, 0), '公司会议室 C', '面试：后端工程师候选人复面，整体表现稳定，对消息队列削峰的理解到位；给出通过结论，薪资走审批。',
     ['工作', '招聘'], [],
     '[2026-07-18 11:48:30] HR-小何: 复面结论出来了吗\n'
     '[2026-07-18 11:50:12] 我: 通过，评价我写进系统了\n'
     '[2026-07-18 11:52:47] HR-小何: 好，我这就走审批流程'),

    ((7, 5, 21, 0), '家里书房', '七月月度总结：完成 2 个迭代交付、读完 1 本书、健身 11 次；八月重点是把复盘模块的需求细节抠实。',
     ['个人', '总结'], [], None),

    ((6, 28, 13, 20), '静安大悦城', '团建：密室逃脱 + 晚餐， escape 用时 47 分钟破纪录；新同学融入得比预期快。',
     ['团队'], ['demo-family.png'], None),

    ((6, 15, 9, 0), '公司会议室 A', '项目立项：「青梧」2.0 kick-off，明确四个里程碑与分工；确定以事件时间线为核心理念重构复盘流程。',
     ['工作'], [],
     '[2026-06-15 09:58:40] 项目经理-老周: 里程碑时间点大家都确认一下\n'
     '[2026-06-15 10:02:15] 我: 后端排期没问题，8 月底前完成核心链路\n'
     '[2026-06-15 10:04:03] 老周: 好，我更新到项目计划里'),
]

# (标题, 起始(月,日), 结束(月,日))
REPORTS = [
    ('「青梧」2.0 项目阶段复盘', (6, 15), (9, 19)),
    ('八月健康与生活习惯复盘', (8, 1), (8, 31)),
    ('八月生产故障专项复盘', (8, 27), (8, 30)),
]


def iso_local(month: int, day: int, hour: int, minute: int) -> str:
    """按东八区构造，转成 UTC 的 ISO(毫秒+Z)，与前端展示格式一致。"""
    dt = datetime(2026, month, day, hour, minute, tzinfo=CST).astimezone(timezone.utc)
    return dt.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (dt.microsecond // 1000)


def iso_range(month: int, day: int, end: bool) -> str:
    dt = datetime(2026, month, day, 23 if end else 0, 59 if end else 0, tzinfo=CST).astimezone(timezone.utc)
    return dt.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (dt.microsecond // 1000)


# ---------------------------------------------------------------- 服务管理
def spawn_server(port: int) -> subprocess.Popen:
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    return subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
        cwd=os.path.join(ROOT, 'backend'), env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


def wait_server(base: str, timeout: float = 40) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if requests.get(base + '/api/events', timeout=3).status_code == 200:
                return True
        except Exception:
            time.sleep(0.5)
    return False


# ---------------------------------------------------------------- 数据操作
def load_manifest() -> dict:
    if os.path.exists(MANIFEST):
        try:
            with open(MANIFEST, 'r', encoding='utf-8') as fh:
                return json.load(fh)
        except Exception:
            pass
    return {'events': [], 'reports': [], 'files': []}


def save_manifest(m: dict) -> None:
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST, 'w', encoding='utf-8') as fh:
        json.dump(m, fh, ensure_ascii=False, indent=2)


def delete_demo_events(base: str) -> int:
    n = 0
    listing = requests.get(base + '/api/events', params={'pageSize': 500}, timeout=30).json()
    for item in listing['items']:
        hit = DEMO_TAG in (item.get('tags') or []) or (item.get('description') or '').startswith(DEMO_PREFIX)
        if not hit:
            continue
        rc = requests.delete(base + '/api/events/' + item['id'], timeout=20).status_code
        n += 1 if rc in (200, 204) else 0
    return n


def delete_demo_reports(base: str) -> int:
    n = 0
    listing = requests.get(base + '/api/analysis/reports', timeout=30).json()
    for rep in listing['items']:
        if not (rep.get('title') or '').startswith(DEMO_PREFIX):
            continue
        rc = requests.delete(base + '/api/analysis/reports/' + rep['id'], timeout=20).status_code
        n += 1 if rc in (200, 204) else 0
    return n


def clean(base: str) -> None:
    m = load_manifest()
    ev = delete_demo_events(base)
    rp = delete_demo_reports(base)
    files = 0
    for rel in m.get('files', []):
        target = os.path.join(ROOT, 'uploads', rel)
        if os.path.exists(target):
            os.remove(target)
            files += 1
    if os.path.exists(MANIFEST):
        os.remove(MANIFEST)
    print('清理完成：事件 -%d，报告 -%d，演示图片文件 -%d' % (ev, rp, files))


def main() -> int:
    global BASE
    parser = argparse.ArgumentParser(description='ttq-time 演示数据生成 / 清理')
    parser.add_argument('--base', default=os.environ.get('TTQ_BASE', 'http://127.0.0.1:3000'))
    parser.add_argument('--spawn', action='store_true', help='自行拉起服务，结束后关闭')
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--clean', action='store_true', help='清除全部演示数据')
    args = parser.parse_args()

    if args.spawn and args.base == parser.get_default('base'):
        BASE = 'http://127.0.0.1:%d' % args.port
    else:
        BASE = args.base.rstrip('/')

    proc = None
    try:
        if args.spawn:
            print('启动服务：%s（端口 %d）' % (sys.executable, args.port))
            proc = spawn_server(args.port)
            print('被测地址：%s' % BASE)

        if not wait_server(BASE):
            print('服务不可达：%s（可加 --spawn 或先 run.bat 启动）' % BASE)
            return 1

        if args.clean:
            clean(BASE)
            return 0

        listing = requests.get(BASE + '/api/events', params={'pageSize': 1}, timeout=15).json()
        real_total = listing['total']
        m = load_manifest()

        if m.get('events') or m.get('reports'):
            print('检测到上次生成的演示数据，先清除（幂等重建）...')
            clean(BASE)

        print('当前既有事件 %d 条（不会改动）\n' % real_total)

        # 1) 上传演示图片（同一文件只上传一次，多个事件复用）
        media_cache: dict[str, dict] = {}
        for spec in EVENTS:
            for fname in spec[4]:
                if fname in media_cache:
                    continue
                path = os.path.join(MEDIA_DIR, fname)
                if not os.path.exists(path):
                    print('缺少占位图 %s，跳过该图片' % fname)
                    continue
                with open(path, 'rb') as fh:
                    r = requests.post(BASE + '/api/media/upload',
                                      files={'file': (fname, fh.read(), 'image/png')}, timeout=60)
                if r.status_code != 201:
                    print('上传失败 %s: %s' % (fname, r.text[:160]))
                    continue
                media_cache[fname] = r.json()
                m.setdefault('files', []).append(r.json()['filePath'])
                print('上传演示图片 %s -> %s' % (fname, r.json()['fileUrl']))

        # 2) 创建事件
        created = []
        for (md, loc, desc, extra_tags, media_files, chat) in EVENTS:
            payload = {
                'eventTime': iso_local(*md),
                'location': loc,
                'description': DEMO_PREFIX + desc,
                'tags': [DEMO_TAG] + extra_tags,
                'media': [media_cache[f] for f in media_files if f in media_cache],
            }
            if chat:
                payload['chatRecordText'] = chat
            r = requests.post(BASE + '/api/events', json=payload, timeout=30)
            if r.status_code != 201:
                print('创建事件失败：%s | %s' % (desc[:24], r.text[:200]))
                continue
            ev = r.json()
            created.append(ev['id'])
            m.setdefault('events', []).append(ev['id'])
            print('事件 + %s（媒体 %d · 对话 %d）'
                  % (desc[:30], ev.get('mediaCount', 0), ev.get('chatRecordCount', 0)))

        save_manifest(m)

        # 3) 创建复盘报告并等待生成完成（mock 模式下很快）
        for (title, start, end) in REPORTS:
            r = requests.post(BASE + '/api/analysis/reports', json={
                'title': DEMO_PREFIX + title,
                'startTime': iso_range(*start, end=False),
                'endTime': iso_range(*end, end=True),
            }, timeout=30)
            if r.status_code != 201:
                print('创建报告失败：%s | %s' % (title, r.text[:200]))
                continue
            rid = r.json()['id']
            m.setdefault('reports', []).append(rid)
            save_manifest(m)
            status = r.json()['status']
            for _ in range(30):
                time.sleep(0.6)
                detail = requests.get(BASE + '/api/analysis/reports/' + rid, timeout=15).json()
                if detail.get('status') in ('completed', 'failed'):
                    break
            print('报告 + %s（%s，关键时间线 %d 条）'
                  % (title, detail.get('status'), len(detail.get('keyTimelines') or [])))

        # 4) 汇总
        final = requests.get(BASE + '/api/events', params={'pageSize': 1}, timeout=15).json()
        reps = requests.get(BASE + '/api/analysis/reports', timeout=15).json()
        print('\n完成：新增演示事件 %d 条，演示报告 %d 份' % (len(created), len(REPORTS)))
        print('当前事件总数 %d（原真实数据 %d 条 + 演示 %d 条）' % (final['total'], real_total, final['total'] - real_total))
        print('当前报告总数 %d' % reps['total'])
        print('清除演示数据：python\\python.exe scripts\\demo_data.py --clean')
        return 0 if len(created) == len(EVENTS) else 1
    finally:
        if proc is not None and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
            print('已关闭被测服务进程。')


if __name__ == '__main__':
    sys.exit(main())
