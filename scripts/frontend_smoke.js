/**
 * 前端渲染逻辑冒烟测试（无浏览器）。
 *
 * 用最小 DOM 打桩在 Node 里加载前端脚本并跑完首屏渲染路径，
 * 目的是抓出「语法正确但运行时 ReferenceError / TypeError」这类问题。
 *
 * 运行：legacy\node\node.exe scripts_frontend_smoke.js
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const JS_DIR = 'F:\\TTQ\\TTQ-time\\frontend\\js';

const SAMPLE_EVENT = {
  id: 'evt-1',
  eventTime: '2026-03-01T01:15:00.000Z',
  location: '上海',
  description: '测试事件：与张三在项目会上确认方案A',
  tags: ['会议', '项目'],
  mediaCount: 1,
  chatRecordCount: 1,
  createdAt: '2026-03-01T01:15:00.000Z',
  updatedAt: '2026-03-01T01:15:00.000Z',
};

const SAMPLE_DETAIL = Object.assign({}, SAMPLE_EVENT, {
  media: [
    {
      id: 'm1',
      eventId: 'evt-1',
      mediaType: 'image',
      filePath: 'a.png',
      fileUrl: '/api/media/a.png',
      fileName: 'a.png',
      fileSize: 10,
    },
    {
      id: 'm2',
      eventId: 'evt-1',
      mediaType: 'video',
      filePath: 'b.mp4',
      fileUrl: '/api/media/b.mp4',
      fileName: 'b.mp4',
      fileSize: 20,
    },
  ],
  chatRecords: [
    {
      id: 'c1',
      eventId: 'evt-1',
      sender: '张三',
      content: '材料还没交',
      sendTime: '2026-03-01T02:00:00.000Z',
    },
    { id: 'c2', eventId: 'evt-1', sender: '李四', content: '知道了', sendTime: null },
  ],
});

const SAMPLE_REPORT = {
  id: 'rep-1',
  title: '复盘测试报告',
  timeRangeStart: '2026-03-01T00:00:00.000Z',
  timeRangeEnd: '2026-03-31T00:00:00.000Z',
  summary: '本次复盘共纳入 1 个事件。',
  keyPersons: [{ name: '张三', role: '负责人', mentions: 3 }],
  keyTimelines: [{ time: '2026-03-01', event: '确认方案A', importance: '重要' }],
  doubts: [{ point: '时间矛盾', description: '前后不一致', severity: '高' }],
  evidenceCategories: [{ category: '文档证据', items: ['会议纪要', '邮件'] }],
  fullReport: '## 事件整体摘要\n测试内容',
  status: 'completed',
  createdAt: '2026-03-02T00:00:00.000Z',
  updatedAt: '2026-03-02T00:00:00.000Z',
};

function makeFetch(log) {
  return async function fetch(url, init) {
    const method = (init && init.method) || 'GET';
    log.push(method + ' ' + String(url));
    const u = String(url);
    let payload = {};

    if (method === 'DELETE' && /\/api\/events\/[^/?]+$/.test(u)) {
      payload = { id: u.split('/').pop() };
    } else if (u.indexOf('/api/analysis/reports/') !== -1) {
      payload = SAMPLE_REPORT;
    } else if (u.indexOf('/api/analysis/reports') !== -1) {
      payload = { items: [SAMPLE_REPORT], total: 1 };
    } else if (/\/api\/events\/[^/?]+$/.test(u)) {
      payload = SAMPLE_DETAIL;
    } else if (u.indexOf('/api/events') !== -1) {
      payload = { items: [SAMPLE_EVENT], total: 1, page: 1, pageSize: 10 };
    }

    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return (name || '').toLowerCase() === 'content-type'
            ? 'application/json'
            : null;
        },
      },
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  };
}

function makeContext(pagePath, fetchLog) {
  const elements = {};

  function makeEl(tag) {
    return {
      tagName: tag || 'div',
      innerHTML: '',
      textContent: '',
      value: '',
      style: {},
      disabled: false,
      files: [],
      __listeners: {},
      classList: {
        add() {},
        remove() {},
        contains() {
          return false;
        },
      },
      setAttribute() {},
      getAttribute() {
        return null;
      },
      addEventListener(type, fn) {
        (this.__listeners[type] = this.__listeners[type] || []).push(fn);
      },
      removeEventListener() {},
      appendChild() {},
      removeChild() {},
      click() {},
      closest() {
        return null;
      },
      querySelector() {
        return null;
      },
    };
  }

  const document = {
    readyState: 'complete',
    title: '',
    getElementById(id) {
      if (!elements[id]) elements[id] = makeEl('div');
      return elements[id];
    },
    createElement(tag) {
      return makeEl(tag);
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    body: { appendChild() {}, removeChild() {} },
  };

  const win = {
    location: { pathname: pagePath, search: '', href: '' },
    history: { length: 1, back() {} },
    document,
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    navigator: {},
    confirm() {
      return false;
    },
    lucide: {
      createIcons() {
        /* 图标库用不到 */
      },
    },
    fetch: makeFetch(fetchLog),
  };
  win.window = win;
  win.globalThis = win;
  win.__elements = elements;

  return vm.createContext(win);
}

async function runPage(pageName, scriptFiles) {
  const fetchLog = [];
  const ctx = makeContext('/' + pageName, fetchLog);
  const errors = [];

  for (const file of scriptFiles) {
    const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    try {
      vm.runInContext(code, ctx, { filename: file });
    } catch (err) {
      errors.push(`${file}: load error -> ${err.name}: ${err.message}`);
    }
  }

  // 让 fetch 的 promise 链跑完
  await new Promise((resolve) => setTimeout(resolve, 80));

  return { errors, fetchLog, elements: ctx.__elements || {}, ctx };
}

/** 断言某个元素渲染出的 HTML 中包含全部期望片段。 */
function expectHtml(results, elements, elementId, needles) {
  const el = elements[elementId];
  const html = el ? String(el.innerHTML) : '';
  const missing = needles.filter((n) => html.indexOf(n) === -1);
  if (!el) {
    results.push(`#${elementId}: 元素未被创建`);
  } else if (missing.length) {
    results.push(`#${elementId}: 缺少内容 ${JSON.stringify(missing)} (len=${html.length})`);
  } else {
    console.log(`  rendered #${elementId} OK (${html.length} chars)`);
  }
}

(async () => {
  const pages = [
    ['index.html', ['theme.js', 'api.js', 'ui.js', 'timeline.js']],
    ['event.html', ['theme.js', 'api.js', 'ui.js', 'event.js']],
    ['analysis.html', ['theme.js', 'api.js', 'ui.js', 'analysis.js']],
  ];

  let total = 0;

  for (const [page, files] of pages) {
    const { errors, fetchLog, elements, ctx } = await runPage(page, files);
    const results = errors.slice();

    console.log(`--- ${page} ---`);
    console.log(`  api calls: ${fetchLog.length ? fetchLog.join(', ') : '(none)'}`);

    if (page === 'index.html') {
      // 顶部导航 + 时间线卡片
      expectHtml(results, elements, 'app-header', ['时间线复盘', '智能复盘']);
      expectHtml(results, elements, 'timeline-list', [
        '测试事件：与张三在项目会上确认方案A',
        '上海',
        '会议',
        '1 媒体',
        '1 对话',
      ]);

      /* ---------- 交互：展开 → 编辑跳转 → 删除 ---------- */
      const listEl = elements['timeline-list'];
      const listeners =
        (listEl && listEl.__listeners && listEl.__listeners.click) || [];
      if (!listeners.length) {
        results.push('timeline-list: 未绑定 click 监听');
      } else {
        const card = {
          getAttribute(a) {
            return a === 'data-event-id' ? 'evt-1' : null;
          },
        };
        const actBtn = (action) => ({
          getAttribute(a) {
            return a === 'data-action' ? action : null;
          },
          closest(sel) {
            return sel === '[data-event-id]' ? card : null;
          },
        });
        const click = (map) =>
          listeners.forEach((fn) =>
            fn({
              target: {
                closest(sel) {
                  return Object.prototype.hasOwnProperty.call(map, sel)
                    ? map[sel]
                    : null;
                },
              },
              stopPropagation() {},
            })
          );
        const idle = () => new Promise((r) => setTimeout(r, 80));

        // 1) 点卡片展开：详情区应出现 编辑/删除 按钮
        click({ '[data-tag]': null, '[data-action]': null, 'a': null, '[data-event-id]': card });
        await idle();
        expectHtml(results, elements, 'timeline-list', [
          'data-action="edit"',
          'data-action="delete"',
          '编辑',
          '删除',
        ]);

        // 2) 点删除：确认框放行后应调用 DELETE /api/events/evt-1
        ctx.confirm = () => true;
        click({ '[data-tag]': null, '[data-action]': actBtn('delete'), 'a': null });
        await idle();
        if (fetchLog.some((l) => l === 'DELETE /api/events/evt-1')) {
          console.log('  delete interaction: DELETE called OK');
        } else {
          results.push('删除交互: 未调用 DELETE /api/events/evt-1');
        }

        // 3) 点编辑：应跳转编辑页并带上 id
        click({ '[data-tag]': null, '[data-action]': actBtn('edit'), 'a': null });
        await idle();
        if (ctx.location.href === 'event.html?id=evt-1') {
          console.log('  edit interaction: navigate OK');
        } else {
          results.push(`编辑交互: 未跳转编辑页 (href=${ctx.location.href})`);
        }
      }
    } else if (page === 'event.html') {
      expectHtml(results, elements, 'app-header', ['时间线复盘']);
    } else if (page === 'analysis.html') {
      expectHtml(results, elements, 'app-header', ['时间线复盘']);
      expectHtml(results, elements, 'picker-panel', [
        '测试事件：与张三在项目会上确认方案A',
      ]);
      expectHtml(results, elements, 'report-list', [
        '复盘测试报告',
        '已完成',
        '2026-03-01 ~ 2026-03-31',
      ]);
    }

    if (results.length === 0) {
      console.log('  page render: ALL OK');
    } else {
      total += results.length;
      results.forEach((e) => console.log('  ERROR ' + e));
    }
  }

  console.log(`\nTOTAL ERRORS = ${total}`);
  process.exit(total === 0 ? 0 : 1);
})();
