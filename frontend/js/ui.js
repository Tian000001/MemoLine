/**
 * 通用 UI 工具：顶部导航注入、Toast、图标刷新、时间格式化。
 * 对应原 client/src/components/Layout.tsx + sonner toast。
 */
(function (global) {
  'use strict';

  var NAV_ITEMS = [
    { page: 'index.html', label: '时间线', icon: 'clock' },
    { page: 'event.html', label: '新建事件', icon: 'plus-circle' },
    { page: 'analysis.html', label: '智能复盘', icon: 'bar-chart-3' },
  ];

  function currentPage() {
    var name = (global.location.pathname || '').split('/').pop();
    return name && name.length > 0 ? name : 'index.html';
  }

  function esc(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return (
      d.getFullYear() +
      '-' +
      pad2(d.getMonth() + 1) +
      '-' +
      pad2(d.getDate()) +
      ' ' +
      pad2(d.getHours()) +
      ':' +
      pad2(d.getMinutes())
    );
  }

  function formatDate(iso) {
    if (!iso) return '';
    return String(iso).slice(0, 10);
  }

  function refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === 'function') {
      try {
        global.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
      } catch (ignore) {
        /* 图标库不可用时静默降级 */
      }
    }
  }

  var HEADER_HTML_TEMPLATE =
    '<header class="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-800/80 backdrop-blur-md">' +
    '  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">' +
    '    <a href="index.html" class="flex items-center gap-3">' +
    '      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">' +
    '        <i data-lucide="clock" class="h-5 w-5"></i>' +
    '      </div>' +
    '      <div>' +
    '        <h1 class="text-lg font-semibold tracking-tight">时间线复盘</h1>' +
    '        <p class="text-xs text-slate-500">事件记录 · 智能分析</p>' +
    '      </div>' +
    '    </a>' +
    '    <nav class="flex items-center gap-1">__NAV__</nav>' +
    '  </div>' +
    '</header>';

  function navItemHtml(item, active) {
    var classes = active
      ? 'bg-cyan-500/10 text-cyan-400'
      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200';
    return (
      '<a href="' +
      item.page +
      '" class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors sm:px-3 ' +
      classes +
      '">' +
      '<i data-lucide="' +
      item.icon +
      '" class="h-4 w-4"></i>' +
      '<span class="hidden sm:inline">' +
      item.label +
      '</span>' +
      '</a>'
    );
  }

  function renderHeader() {
    var host = document.getElementById('app-header');
    if (!host) return;

    var page = currentPage();
    var nav = NAV_ITEMS.map(function (item) {
      return navItemHtml(item, item.page === page);
    }).join('');

    host.innerHTML = HEADER_HTML_TEMPLATE.replace('__NAV__', nav);
    refreshIcons();
  }

  var TOAST_STYLES = {
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    error: 'border-red-500/40 bg-red-500/10 text-red-200',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    info: 'border-slate-600/60 bg-slate-800/90 text-slate-200',
  };

  var TOAST_ICONS = {
    success: 'check-circle-2',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info',
  };

  function toast(message, type) {
    var kind = TOAST_STYLES[type] ? type : 'info';
    var root = document.getElementById('toast-root');

    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      root.className =
        'pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2';
      document.body.appendChild(root);
    }

    var el = document.createElement('div');
    el.className =
      'pointer-events-auto animate-in flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg backdrop-blur-md ' +
      TOAST_STYLES[kind];
    el.innerHTML =
      '<i data-lucide="' +
      TOAST_ICONS[kind] +
      '" class="mt-0.5 h-4 w-4 shrink-0"></i><span class="flex-1">' +
      esc(message) +
      '</span>';

    root.appendChild(el);
    refreshIcons();

    global.setTimeout(function () {
      el.style.transition = 'opacity .2s ease, transform .2s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      global.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, 3000);
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      global.clearTimeout(timer);
      timer = global.setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }

  function skeletonNodeHtml() {
    return (
      '<div class="relative pl-10">' +
      '<div class="absolute left-2 top-3 h-4 w-4 rounded-full border-2 border-slate-600 bg-slate-800"></div>' +
      '<div class="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">' +
      '<div class="flex gap-3">' +
      '<div class="pulse h-4 w-28 rounded bg-slate-700/50"></div>' +
      '<div class="pulse h-4 w-32 rounded bg-slate-700/50"></div>' +
      '</div>' +
      '<div class="pulse mt-3 h-4 w-full rounded bg-slate-700/50"></div>' +
      '<div class="pulse mt-2 h-4 w-3/4 rounded bg-slate-700/50"></div>' +
      '<div class="mt-3 flex gap-2">' +
      '<div class="pulse h-5 w-16 rounded-full bg-slate-700/50"></div>' +
      '<div class="pulse h-5 w-16 rounded-full bg-slate-700/50"></div>' +
      '</div></div></div>'
    );
  }

  global.App = global.App || {};
  global.App.ui = {
    esc: esc,
    toast: toast,
    debounce: debounce,
    renderHeader: renderHeader,
    formatDateTime: formatDateTime,
    formatDate: formatDate,
    refreshIcons: refreshIcons,
    currentPage: currentPage,
    skeletonNodeHtml: skeletonNodeHtml,
  };
})(window);
