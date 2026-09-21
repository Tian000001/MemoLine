"""ttq-time 端到端回归测试。

对运行中的服务打一遍真实 HTTP 请求，覆盖：静态页面与资源、事件 CRUD 与筛选、
聊天记录解析、媒体上传 + 静态访问、复盘报告生成（mock 模式）、404 / 422 错误行为。

测试数据全部自建自删，不触碰既有数据（运行前后事件总数应一致）。

用法（在项目根目录）：

    python\\python.exe scripts\\e2e_test.py              # 默认打 http://127.0.0.1:3000
    python\\python.exe scripts\\e2e_test.py --spawn      # 自己拉起一个服务再测，测完关掉
    python\\python.exe scripts\\e2e_test.py --base http://127.0.0.1:8088

退出码 0 = 全通过，1 = 有失败项。报告写在 stdout，同时落到 e2e-report.txt。
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request

try:
    import requests
except ImportError:  # pragma: no cover - 依赖缺失时给明确指引
    sys.stderr.write(
        '缺少 requests 依赖，请先执行：python\\python.exe -m pip install -r backend\\requirements.txt\n'
    )
    raise SystemExit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UPLOADS = os.path.join(ROOT, 'uploads')
REPORT = os.path.join(ROOT, 'e2e-report.txt')

BASE = os.environ.get('TTQ_BASE', 'http://127.0.0.1:3000')

lines: list[str] = []
failures: list[str] = []
created_event_id = None
created_report_id = None


def rec(msg: str = '') -> None:
    lines.append(msg)
    print(msg, flush=True)


def check(label: str, condition: bool, extra: str = '') -> None:
    rec('[%s] %s%s' % ('PASS' if condition else 'FAIL', label, (' ' + extra) if extra else ''))
    if not condition:
        failures.append(label)


def wait_server(timeout: float = 40) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if requests.get(BASE + '/api/events', timeout=3).status_code == 200:
                return True
        except Exception:
            time.sleep(0.5)
    return False


def spawn_server(port: int) -> subprocess.Popen:
    """用当前解释器在 backend/ 下起一个 uvicorn 子进程。"""
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    proc = subprocess.Popen(
        [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port)],
        cwd=os.path.join(ROOT, 'backend'),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return proc


def cleanup_leftovers() -> None:
    """清掉上一次可能因崩溃中断而残留的测试数据，保证基线干净。"""
    rec()
    rec('=== 清理上次残留的测试数据 ===')
    listing = requests.get(BASE + '/api/events', params={'pageSize': 200}, timeout=30).json()
    for item in listing['items']:
        if (item.get('description') or '').startswith('E2E 测试事件'):
            requests.delete(BASE + '/api/events/' + item['id'], timeout=20)
            rec('  已删除残留事件 %s' % item['id'][:8])
    for rep in requests.get(BASE + '/api/analysis/reports', timeout=30).json()['items']:
        if rep.get('title') == 'E2E 复盘报告':
            requests.delete(BASE + '/api/analysis/reports/' + rep['id'], timeout=20)
            rec('  已删除残留报告 %s' % rep['id'][:8])


def main() -> int:
    global BASE, REPORT, created_event_id, created_report_id

    media_meta: dict = {}

    parser = argparse.ArgumentParser(description='ttq-time 端到端回归测试')
    parser.add_argument('--base', default=BASE, help='被测服务地址，默认 %s' % BASE)
    parser.add_argument('--spawn', action='store_true', help='自行拉起一个服务再测，测完关闭')
    parser.add_argument('--port', type=int, default=3000, help='--spawn 时使用的端口，默认 3000')
    args = parser.parse_args()

    # --spawn 时默认打自己拉起的那个端口，除非用户显式传了 --base
    if args.spawn and args.base == parser.get_default('base'):
        BASE = 'http://127.0.0.1:%d' % args.port
    else:
        BASE = args.base.rstrip('/')

    proc = None
    try:
        if args.spawn:
            rec('启动被测服务：%s（端口 %s）' % (sys.executable, args.port))
            proc = spawn_server(args.port)
            rec('被测地址：%s' % BASE)

        rec('=== 服务可达性 ===')
        up = wait_server()
        check('server reachable at %s' % BASE, up)
        if not up:
            rec()
            rec('服务未就绪，测试中止。')
            return 1

        cleanup_leftovers()

        # ------------------------------------------------------------ 静态页面
        rec()
        rec('=== 静态前端 ===')
        for path, needle in [
            ('/index.html', '事件时间线'),
            ('/event.html', '基础信息'),
            ('/analysis.html', '智能复盘分析'),
            ('/', '事件时间线'),
            ('/js/theme.js', 'tailwind.config'),
            ('/js/api.js', 'getEvents'),
            ('/js/ui.js', 'renderHeader'),
            ('/js/timeline.js', 'PAGE_SIZE'),
            ('/js/event.js', 'handleSubmit'),
            ('/js/analysis.js', 'startPolling'),
            ('/css/app.css', 'fade-in'),
            ('/favicon.svg', '<svg'),
        ]:
            r = requests.get(BASE + path, timeout=15)
            check('GET %s' % path, r.status_code == 200 and needle in r.text,
                  'status=%s len=%s' % (r.status_code, len(r.text)))

        # ------------------------------------------------------------ 事件列表
        rec()
        rec('=== 事件接口 ===')
        r = requests.get(BASE + '/api/events', timeout=15)
        check('GET /api/events 200', r.status_code == 200)
        listing = r.json()
        baseline_total = listing['total']
        check('列表结构完整', set(listing.keys()) == {'items', 'total', 'page', 'pageSize'},
              'total=%s page=%s pageSize=%s' % (listing['total'], listing['page'], listing['pageSize']))

        r = requests.get(BASE + '/api/events', params={'pageSize': 2, 'page': 1}, timeout=15)
        check('分页生效', len(r.json()['items']) <= 2, 'items=%d' % len(r.json()['items']))

        if listing['items']:
            first_id = listing['items'][0]['id']
            r = requests.get(BASE + '/api/events/' + first_id, timeout=15)
            detail = r.json()
            check('GET /api/events/{id}', r.status_code == 200 and 'media' in detail and 'chatRecords' in detail,
                  'media=%d chat=%d' % (len(detail.get('media', [])), len(detail.get('chatRecords', []))))

        r = requests.get(BASE + '/api/events', params={'keyword': '不可能存在的关键词zzz'}, timeout=15)
        check('关键词筛选', r.json()['total'] == 0, 'total=%s' % r.json()['total'])

        # ------------------------------------------------------------ 聊天解析
        rec()
        rec('=== 聊天记录解析 ===')
        sample = '\n'.join([
            '[2026-03-01 09:15:00] 张三: 上午开会迟到了',
            '2026-03-02 14:20 李四：材料还没交',
            '下午3:40 王五: 我先走了',
            '赵六：没有时间的一条记录',
        ])
        r = requests.post(BASE + '/api/events/parse-chat', json={'text': sample}, timeout=15)
        parsed = r.json()
        check('解析出 4 条记录', r.status_code == 201 and len(parsed['records']) == 4,
              'status=%s n=%d' % (r.status_code, len(parsed['records'])))
        check('发言人识别正确', parsed['records'][0]['sender'] == '张三', parsed['records'][0]['sender'])
        check('sendTime 为 ISO(毫秒+Z)',
              parsed['records'][0]['sendTime'].endswith('Z') and len(parsed['records'][0]['sendTime']) == 24,
              parsed['records'][0]['sendTime'])
        check('无时间记录 sendTime 为 null', parsed['records'][3]['sendTime'] is None)

        # ------------------------------------------------------------ 媒体上传
        rec()
        rec('=== 媒体上传与访问 ===')
        png = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
        )
        r = requests.post(BASE + '/api/media/upload',
                          files={'file': ('e2e-test.png', png, 'image/png')}, timeout=30)
        check('POST /api/media/upload', r.status_code == 201, 'status=%s' % r.status_code)
        media_meta = r.json()
        check('上传返回结构正确',
              media_meta.get('mediaType') == 'image' and media_meta.get('fileUrl', '').startswith('/api/media/'))

        r = requests.get(BASE + media_meta['fileUrl'], timeout=15)
        check('已上传媒体可访问', r.status_code == 200 and r.content == png,
              'status=%s bytes=%d' % (r.status_code, len(r.content)))

        # ------------------------------------------------------------ 事件 CRUD
        rec()
        rec('=== 事件增改删 ===')
        payload = {
            'eventTime': '2026-03-05T02:00:00.000Z',
            'location': 'E2E 测试地点',
            'description': 'E2E 测试事件：应当被自动清理',
            'tags': ['e2e', '自动化'],
            'media': [{
                'mediaType': 'image',
                'fileUrl': media_meta['fileUrl'],
                'fileName': media_meta['fileName'],
                'fileSize': media_meta['fileSize'],
            }],
            'chatRecordText': sample,
        }
        r = requests.post(BASE + '/api/events', json=payload, timeout=20)
        check('POST /api/events', r.status_code == 201, 'status=%s %s' % (r.status_code, r.text[:200]))
        created = r.json()
        created_event_id = created['id']
        check('创建后关联数量正确',
              created['mediaCount'] == 1 and created['chatRecordCount'] == 4,
              'media=%s chat=%s' % (created.get('mediaCount'), created.get('chatRecordCount')))
        check('标签正确落库', created.get('tags') == ['e2e', '自动化'], str(created.get('tags')))

        r = requests.get(BASE + '/api/events', params={'tag': 'e2e'}, timeout=15)
        check('标签筛选能命中', r.json()['total'] >= 1, 'total=%s' % r.json()['total'])

        r = requests.patch(BASE + '/api/events/' + created_event_id,
                           json={'description': 'E2E 测试事件（已更新）', 'location': 'E2E 新地点'}, timeout=15)
        check('PATCH /api/events/{id}',
              r.status_code == 200 and r.json()['description'].endswith('（已更新）'), r.text[:160])

        r = requests.get(BASE + '/api/events', params={'location': 'E2E 新地点'}, timeout=15)
        matched = r.json()
        check('地点筛选结果正确',
              matched['total'] >= 1 and all('E2E 新地点' in (it.get('location') or '') for it in matched['items']),
              'total=%s' % matched['total'])

        r = requests.get(BASE + '/api/events',
                         params={'startTime': '2026-03-01T00:00:00.000Z',
                                 'endTime': '2026-03-31T23:59:59.999Z'}, timeout=15)
        check('时间区间筛选', r.json()['total'] >= 1, 'total=%s' % r.json()['total'])

        # ------------------------------------------------------------ 复盘报告
        rec()
        rec('=== 复盘报告（mock 模式） ===')
        r = requests.post(BASE + '/api/analysis/reports',
                          json={'title': 'E2E 复盘报告',
                                'startTime': '2026-03-01T00:00:00.000Z',
                                'endTime': '2026-03-31T23:59:59.999Z'}, timeout=20)
        check('POST /api/analysis/reports', r.status_code == 201, 'status=%s' % r.status_code)
        created_report_id = r.json()['id']
        check('新报告为 pending/generating', r.json()['status'] in ('pending', 'generating'), r.json()['status'])

        final = {}
        for _ in range(30):
            time.sleep(1)
            final = requests.get(BASE + '/api/analysis/reports/' + created_report_id, timeout=15).json()
            if final['status'] in ('completed', 'failed'):
                break
        check('报告生成完成', final.get('status') == 'completed', 'status=%s' % final.get('status'))
        check('报告含摘要', bool(final.get('summary')), (final.get('summary') or '')[:60])
        check('报告含关键时间线', len(final.get('keyTimelines') or []) > 0,
              'n=%d' % len(final.get('keyTimelines') or []))
        check('报告含完整正文', bool(final.get('fullReport')),
              'len=%d' % len(final.get('fullReport') or ''))

        r = requests.get(BASE + '/api/analysis/reports', timeout=15)
        check('GET 报告列表', r.status_code == 200 and r.json()['total'] >= 1, 'total=%s' % r.json()['total'])

        # ------------------------------------------------------------ 错误行为
        rec()
        rec('=== 错误处理 ===')
        r = requests.get(BASE + '/api/events/does-not-exist', timeout=15)
        check('不存在的 id -> 404 JSON',
              r.status_code == 404 and r.json().get('error', {}).get('code') == 'NOT_FOUND',
              'status=%s' % r.status_code)

        r = requests.get(BASE + '/api/definitely-missing', timeout=15)
        try:
            unknown_api = r.json()
        except Exception:
            unknown_api = None
        check('未知 /api 路径 -> 404 JSON（不被静态站吞掉）',
              r.status_code == 404 and isinstance(unknown_api, dict)
              and unknown_api.get('error', {}).get('code') == 'NOT_FOUND',
              'status=%s ctype=%s' % (r.status_code, r.headers.get('content-type')))

        r = requests.get(BASE + '/this-page-does-not-exist', timeout=15)
        check('未知页面 -> 404 HTML', r.status_code == 404 and '404' in r.text, 'status=%s' % r.status_code)

        r = requests.post(BASE + '/api/analysis/reports', json={'unexpected': 1}, timeout=15)
        check('非法请求体 -> 422', r.status_code == 422, 'status=%s' % r.status_code)

        # ------------------------------------------------------------ 清理
        rec()
        rec('=== 清理测试数据 ===')
        if created_report_id:
            check('DELETE 报告', requests.delete(BASE + '/api/analysis/reports/' + created_report_id,
                                                timeout=15).status_code == 204)
        if created_event_id:
            check('DELETE 事件', requests.delete(BASE + '/api/events/' + created_event_id,
                                                timeout=15).status_code == 204)
        r = requests.get(BASE + '/api/events', timeout=15)
        check('事件总数回到基线', r.json()['total'] == baseline_total,
              'now=%s baseline=%s' % (r.json()['total'], baseline_total))
        if created_event_id:
            check('删除不存在的 id -> 404',
                  requests.delete(BASE + '/api/events/' + created_event_id, timeout=15).status_code == 404)

        target = os.path.join(UPLOADS, media_meta.get('filePath', ''))
        if media_meta.get('filePath') and os.path.exists(target):
            os.remove(target)
        rec('已删除测试上传文件，残留=%s' % os.path.exists(target))

    finally:
        rec()
        rec('=== 结果 ===')
        rec('failures=%d' % len(failures))
        for f in failures:
            rec('  失败：%s' % f)
        try:
            with io.open(REPORT, 'w', encoding='utf-8') as fh:
                fh.write('\n'.join(lines))
        except OSError:
            pass
        if proc is not None and proc.poll() is None:
            # Windows 不支持向子进程发 SIGINT，只能用 terminate()
            if os.name == 'nt':
                proc.terminate()
            else:
                proc.send_signal(signal.SIGINT)
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
            rec('已关闭被测服务进程。')

    return 0 if not failures else 1


if __name__ == '__main__':
    sys.exit(main())
