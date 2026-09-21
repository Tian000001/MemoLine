/**
 * 智能复盘页面逻辑。
 * 对应原 client/src/pages/AnalysisPage/*（创建报告 + 状态轮询 + 结构化报告展示）。
 */
(function () {
  'use strict';

  var api = window.App.api;
  var ui = window.App.ui;
  var esc = ui.esc;
  var POLL_INTERVAL = 3000;

  var STATUS_BADGE = {
    pending: { label: '等待中', className: 'bg-slate-500/15 text-slate-400' },
    generating: { label: '生成中', className: 'bg-blue-500/15 text-blue-400' },
    completed: { label: '已完成', className: 'bg-emerald-500/15 text-emerald-400' },
    failed: { label: '失败', className: 'bg-red-500/15 text-red-400' },
  };

  var state = {
    reports: [],
    events: [],
    loading: true,
    creating: false,
    selectedEventIds: [],
    pickerOpen: false,
    expandedId: null,
    pollTimers: {},
  };

  var el = {};

  function cacheElements() {
    el.title = document.getElementById('f-title');
    el.start = document.getElementById('f-start');
    el.end = document.getElementById('f-end');
    el.togglePicker = document.getElementById('btn-toggle-picker');
    el.pickerCount = document.getElementById('picker-count');
    el.pickerChevron = document.getElementById('picker-chevron');
    el.pickerPanel = document.getElementById('picker-panel');
    el.create = document.getElementById('btn-create');
    el.createLabel = document.getElementById('create-label');
    el.reportCount = document.getElementById('report-count');
    el.reportList = document.getElementById('report-list');
  }

  /* ------------------------------------------------------------- 小工具 */

  function severityBadgeClass(severity) {
    var s = String(severity || '').toLowerCase();
    if (s.indexOf('high') !== -1 || s.indexOf('严重') !== -1 || s === '高')
      return 'bg-red-500/15 text-red-400';
    if (s.indexOf('medium') !== -1 || s.indexOf('中等') !== -1 || s === '中')
      return 'bg-amber-500/15 text-amber-400';
    return 'bg-slate-500/15 text-slate-400';
  }

  function severityCardClass(severity) {
    var s = String(severity || '').toLowerCase();
    if (s.indexOf('high') !== -1 || s.indexOf('严重') !== -1 || s === '高')
      return 'border-red-500/30';
    if (s.indexOf('medium') !== -1 || s.indexOf('中等') !== -1 || s === '中')
      return 'border-amber-500/30';
    return 'border-slate-600/30';
  }

  function importanceDot(importance) {
    var i = String(importance || '').toLowerCase();
    if (i.indexOf('high') !== -1 || i.indexOf('重要') !== -1 || i === '高')
      return 'bg-red-400';
    if (i.indexOf('medium') !== -1 || i.indexOf('中等') !== -1 || i === '中')
      return 'bg-amber-400';
    return 'bg-slate-500';
  }

  function isGenerating(report) {
    return report.status === 'pending' || report.status === 'generating';
  }

  function reportText(report) {
    return report.fullReport || report.summary || '';
  }

  function formatTimeRange(start, end) {
    return (ui.formatDate(start) || '不限') + ' ~ ' + (ui.formatDate(end) || '不限');
  }

  /* --------------------------------------------------------- 事件选择器 */

  function renderPicker() {
    if (state.events.length === 0) {
      el.pickerPanel.innerHTML =
        '<p class="p-3 text-center text-sm text-slate-500">暂无事件</p>';
    } else {
      el.pickerPanel.innerHTML = state.events
        .map(function (ev) {
          var checked = state.selectedEventIds.indexOf(ev.id) !== -1 ? ' checked' : '';
          return (
            '<label class="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-slate-800/60">' +
            '<input type="checkbox" data-event-pick="' +
            esc(ev.id) +
            '"' +
            checked +
            ' class="mt-1 size-4 accent-cyan-500" />' +
            '<div class="min-w-0 flex-1">' +
            '<p class="truncate text-sm text-slate-200">' +
            esc(ev.description) +
            '</p>' +
            '<p class="mt-0.5 text-xs text-slate-500">' +
            esc(ui.formatDate(ev.eventTime)) +
            (ev.location ? ' · ' + esc(ev.location) : '') +
            '</p></div></label>'
          );
        })
        .join('');
    }

    if (state.selectedEventIds.length > 0) {
      el.pickerCount.textContent = '已选 ' + state.selectedEventIds.length;
      el.pickerCount.style.display = 'inline-block';
    } else {
      el.pickerCount.style.display = 'none';
    }

    el.pickerPanel.style.display = state.pickerOpen ? 'block' : 'none';
    el.pickerChevron.setAttribute(
      'data-lucide',
      state.pickerOpen ? 'chevron-down' : 'chevron-right'
    );
    ui.refreshIcons();
  }

  /* ----------------------------------------------------- 报告详情面板 */

  function detailPanelHtml(report) {
    var badge = STATUS_BADGE[report.status] || STATUS_BADGE.pending;
    var parts = ['<div class="space-y-5">'];

    // 头部状态
    parts.push(
      '<div class="flex flex-wrap items-center gap-3 border-b border-slate-700/40 pb-4">' +
        '<span class="rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        badge.className +
        '">' +
        (isGenerating(report)
          ? '<i data-lucide="loader-2" class="spin mr-1 inline h-3 w-3 align-[-1px]"></i>'
          : '') +
        badge.label +
        '</span>' +
        (isGenerating(report)
          ? '<span class="text-xs text-slate-500">AI 正在分析事件链，请稍候...</span>'
          : '') +
        (report.status === 'failed'
          ? '<span class="flex items-center gap-1 text-xs text-red-400"><i data-lucide="x-circle" class="h-3 w-3"></i> 生成失败，请重试</span>'
          : '') +
        (report.status === 'completed'
          ? '<span class="flex items-center gap-1 text-xs text-emerald-400"><i data-lucide="check-circle-2" class="h-3 w-3"></i> 分析完成</span>'
          : '') +
        '</div>'
    );

    if (isGenerating(report)) {
      parts.push(
        '<div class="flex flex-col items-center justify-center py-10 text-center">' +
          '<i data-lucide="loader-2" class="spin h-7 w-7 text-cyan-400"></i>' +
          '<p class="mt-3 text-sm text-slate-300">正在生成复盘报告</p>' +
          '<p class="mt-1 text-xs text-slate-500">大模型正在梳理事件脉络，通常需要 10-30 秒</p></div>'
      );
      parts.push('</div>');
      return parts.join('');
    }

    if (report.status === 'failed') {
      parts.push(
        '<div class="flex flex-col items-center justify-center py-10 text-center">' +
          '<i data-lucide="x-circle" class="h-7 w-7 text-red-400"></i>' +
          '<p class="mt-3 text-sm text-slate-300">报告生成失败</p>' +
          '<p class="mt-1 text-xs text-slate-500">请检查事件数据后重新生成</p></div>'
      );
      parts.push('</div>');
      return parts.join('');
    }

    // 事件整体摘要
    parts.push(
      '<section><h4 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">' +
        '<i data-lucide="file-text" class="h-3.5 w-3.5 text-cyan-400"></i>事件整体摘要</h4>' +
        '<div class="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">' +
        '<p class="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">' +
        esc(report.summary || '暂无摘要') +
        '</p></div></section>'
    );

    // 关键人物
    if (report.keyPersons && report.keyPersons.length > 0) {
      parts.push(
        '<section><h4 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">' +
          '<i data-lucide="users" class="h-3.5 w-3.5 text-cyan-400"></i>关键人物</h4>' +
          '<div class="grid gap-2 sm:grid-cols-2">' +
          report.keyPersons
            .map(function (person) {
              return (
                '<div class="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3">' +
                '<div><p class="text-sm font-medium text-slate-200">' +
                esc(person.name) +
                '</p><p class="text-xs text-slate-500">' +
                esc(person.role) +
                '</p></div>' +
                '<span class="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-400">提及 ' +
                (person.mentions || 0) +
                ' 次</span></div>'
              );
            })
            .join('') +
          '</div></section>'
      );
    }

    // 关键时间节点
    if (report.keyTimelines && report.keyTimelines.length > 0) {
      parts.push(
        '<section><h4 class="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">' +
          '<i data-lucide="clock" class="h-3.5 w-3.5 text-cyan-400"></i>关键时间节点</h4>' +
          '<div class="relative pl-5"><div class="absolute left-[7px] top-1 bottom-1 w-px bg-slate-700/60"></div>' +
          '<div class="space-y-4">' +
          report.keyTimelines
            .map(function (item) {
              return (
                '<div class="relative">' +
                '<span class="absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-slate-800 ' +
                importanceDot(item.importance) +
                '"></span>' +
                '<div class="flex flex-wrap items-baseline gap-2">' +
                '<span class="text-xs font-medium text-cyan-400">' +
                esc(item.time) +
                '</span>' +
                '<span class="text-xs text-slate-500">· ' +
                esc(item.importance) +
                '</span></div>' +
                '<p class="mt-1 text-sm leading-relaxed text-slate-300">' +
                esc(item.event) +
                '</p></div>'
              );
            })
            .join('') +
          '</div></div></section>'
      );
    }

    // 疑点识别
    if (report.doubts && report.doubts.length > 0) {
      parts.push(
        '<section><h4 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">' +
          '<i data-lucide="alert-triangle" class="h-3.5 w-3.5 text-cyan-400"></i>疑点识别</h4>' +
          '<div class="space-y-2">' +
          report.doubts
            .map(function (doubt) {
              return (
                '<div class="rounded-lg border bg-slate-900/40 p-4 ' +
                severityCardClass(doubt.severity) +
                '">' +
                '<div class="flex items-center justify-between">' +
                '<h5 class="text-sm font-medium text-slate-200">' +
                esc(doubt.point) +
                '</h5>' +
                '<span class="rounded-full px-2 py-0.5 text-xs ' +
                severityBadgeClass(doubt.severity) +
                '">' +
                esc(doubt.severity) +
                '</span></div>' +
                '<p class="mt-2 text-sm leading-relaxed text-slate-400">' +
                esc(doubt.description) +
                '</p></div>'
              );
            })
            .join('') +
          '</div></section>'
      );
    }

    // 证据归类
    if (report.evidenceCategories && report.evidenceCategories.length > 0) {
      parts.push(
        '<section><h4 class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">' +
          '<i data-lucide="folder-open" class="h-3.5 w-3.5 text-cyan-400"></i>证据归类</h4>' +
          '<div class="space-y-2">' +
          report.evidenceCategories
            .map(function (cat, idx) {
              var items = (cat.items || [])
                .map(function (item) {
                  return (
                    '<li class="flex gap-2 text-sm leading-relaxed text-slate-300">' +
                    '<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/60"></span>' +
                    '<span>' +
                    esc(item) +
                    '</span></li>'
                  );
                })
                .join('');
              return (
                '<details class="group rounded-lg border border-slate-700/40 bg-slate-900/40">' +
                '<summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-slate-700/20 [&::-webkit-details-marker]:hidden">' +
                '<i data-lucide="chevron-right" class="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-90"></i>' +
                '<i data-lucide="folder-open" class="h-3.5 w-3.5 text-cyan-400"></i>' +
                '<span class="font-medium">' +
                esc(cat.category) +
                '</span>' +
                '<span class="ml-auto text-xs text-slate-500">' +
                (cat.items || []).length +
                ' 条</span></summary>' +
                '<ul class="space-y-2 border-t border-slate-700/40 px-4 py-3">' +
                items +
                '</ul></details>'
              );
            })
            .join('') +
          '</div></section>'
      );
    }

    // 完整报告
    parts.push(
      '<section><details class="group">' +
        '<summary class="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/20 [&::-webkit-details-marker]:hidden">' +
        '<i data-lucide="chevron-right" class="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-90"></i>' +
        '<i data-lucide="file-text" class="h-3.5 w-3.5 text-cyan-400"></i>完整报告</summary>' +
        '<div class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-700/40 bg-slate-900/60 p-4">' +
        '<pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">' +
        esc(report.fullReport || '暂无完整报告') +
        '</pre></div></details></section>'
    );

    parts.push('</div>');
    return parts.join('');
  }

  /* --------------------------------------------------------- 报告列表 */

  function reportCardHtml(report) {
    var badge = STATUS_BADGE[report.status] || STATUS_BADGE.pending;
    var expanded = state.expandedId === report.id;
    var generating = isGenerating(report);
    var disabled = report.status !== 'completed' ? ' disabled' : '';

    return (
      '<div class="animate-in overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm" data-report-id="' +
      esc(report.id) +
      '">' +
      '<div data-report-head="' +
      esc(report.id) +
      '" class="flex w-full cursor-pointer flex-col gap-3 p-5 transition-colors hover:bg-slate-700/20 sm:flex-row sm:items-center sm:justify-between">' +
      '<div class="flex items-start gap-3">' +
      '<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">' +
      '<i data-lucide="file-text" class="h-4.5 w-4.5"></i></div>' +
      '<div class="min-w-0">' +
      '<h4 class="truncate text-sm font-medium text-slate-200">' +
      esc(report.title) +
      '</h4>' +
      '<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">' +
      '<i data-lucide="calendar-range" class="h-3 w-3"></i>' +
      '<span>' +
      esc(formatTimeRange(report.timeRangeStart, report.timeRangeEnd)) +
      '</span><span>·</span>' +
      '<span>' +
      esc(ui.formatDateTime(report.createdAt)) +
      '</span></div></div></div>' +
      '<div class="flex items-center gap-2">' +
      '<span class="rounded-full px-2.5 py-0.5 text-xs font-medium ' +
      badge.className +
      '">' +
      (generating
        ? '<i data-lucide="loader-2" class="spin mr-1 inline h-3 w-3 align-[-1px]"></i>'
        : '') +
      badge.label +
      '</span>' +
      '<div class="flex items-center gap-1">' +
      '<button type="button" data-action="copy" data-report="' +
      esc(report.id) +
      '"' +
      disabled +
      ' title="复制报告" class="inline-flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700/40 disabled:opacity-40">' +
      '<i data-lucide="copy" class="h-3 w-3"></i>复制</button>' +
      '<button type="button" data-action="export" data-report="' +
      esc(report.id) +
      '"' +
      disabled +
      ' title="导出报告" class="inline-flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700/40 disabled:opacity-40">' +
      '<i data-lucide="download" class="h-3 w-3"></i>导出</button>' +
      '<button type="button" data-action="delete" data-report="' +
      esc(report.id) +
      '" title="删除报告" class="inline-flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400">' +
      '<i data-lucide="trash-2" class="h-3 w-3"></i>删除</button>' +
      '</div>' +
      '<i data-lucide="' +
      (expanded ? 'chevron-up' : 'chevron-down') +
      '" class="h-4 w-4 text-slate-400"></i>' +
      '</div></div>' +
      (expanded
        ? '<div class="border-t border-slate-700/40 bg-slate-900/30 p-5">' +
          detailPanelHtml(report) +
          '</div>'
        : '') +
      '</div>'
    );
  }

  function renderReports() {
    if (state.loading) {
      el.reportList.innerHTML =
        '<div class="flex items-center justify-center py-10"><i data-lucide="loader-2" class="spin h-6 w-6 text-cyan-400"></i></div>';
    } else if (state.reports.length === 0) {
      el.reportList.innerHTML =
        '<div class="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 py-12 text-center">' +
        '<i data-lucide="file-text" class="mx-auto h-7 w-7 text-slate-600"></i>' +
        '<p class="mt-3 text-sm text-slate-400">暂无分析报告</p>' +
        '<p class="mt-1 text-xs text-slate-500">填写表单创建第一份复盘报告</p></div>';
    } else {
      el.reportList.innerHTML = state.reports.map(reportCardHtml).join('');
    }

    el.reportCount.textContent =
      state.reports.length > 0 ? '(' + state.reports.length + ')' : '';
    ui.refreshIcons();
  }

  /* ------------------------------------------------------------- 轮询 */

  function stopPolling(reportId) {
    var timer = state.pollTimers[reportId];
    if (timer) {
      window.clearTimeout(timer);
      state.pollTimers[reportId] = null;
    }
  }

  function startPolling(reportId) {
    if (state.pollTimers[reportId]) return;

    function tick() {
      api
        .getReport(reportId)
        .then(function (updated) {
          state.reports = state.reports.map(function (r) {
            return r.id === reportId ? updated : r;
          });
          renderReports();

          if (updated.status === 'completed' || updated.status === 'failed') {
            stopPolling(reportId);
            if (updated.status === 'completed') {
              ui.toast('报告生成完成', 'success');
            } else {
              ui.toast('报告生成失败', 'error');
            }
            return;
          }
          state.pollTimers[reportId] = window.setTimeout(tick, POLL_INTERVAL);
        })
        .catch(function () {
          state.pollTimers[reportId] = window.setTimeout(tick, POLL_INTERVAL);
        });
    }

    state.pollTimers[reportId] = window.setTimeout(tick, POLL_INTERVAL);
  }

  function syncPolling() {
    state.reports.forEach(function (report) {
      if (isGenerating(report)) startPolling(report.id);
    });
  }

  /* ------------------------------------------------------------- 数据 */

  function fetchReports() {
    return api
      .getReports()
      .then(function (res) {
        state.reports = res.items || [];
        state.loading = false;
        renderReports();
        syncPolling();
      })
      .catch(function (error) {
        state.loading = false;
        renderReports();
        ui.toast(error.message || '加载报告列表失败', 'error');
      });
  }

  function fetchEvents() {
    return api
      .getEvents({ pageSize: 50 })
      .then(function (res) {
        state.events = res.items || [];
        renderPicker();
      })
      .catch(function () {
        /* 事件列表失败不阻塞页面 */
      });
  }

  /* ------------------------------------------------------------- 交互 */

  function setCreating(flag) {
    state.creating = flag;
    el.create.disabled = flag;
    el.create.innerHTML =
      '<i data-lucide="' +
      (flag ? 'loader-2' : 'sparkles') +
      '" class="h-4 w-4' +
      (flag ? ' spin' : '') +
      '"></i><span id="create-label">' +
      (flag ? '分析生成中...' : '开始智能分析') +
      '</span>';
    el.createLabel = document.getElementById('create-label');
    ui.refreshIcons();
  }

  function resetForm() {
    el.title.value = '';
    el.start.value = '';
    el.end.value = '';
    state.selectedEventIds = [];
    state.pickerOpen = false;
    renderPicker();
  }

  function handleCreate() {
    var title = el.title.value.trim();
    if (!title) {
      ui.toast('请输入报告标题', 'error');
      return;
    }
    if (el.start.value && el.end.value && el.start.value > el.end.value) {
      ui.toast('开始时间不能晚于结束时间', 'error');
      return;
    }

    setCreating(true);
    api
      .createReport({
        title: title,
        startTime: el.start.value || undefined,
        endTime: el.end.value || undefined,
        eventIds: state.selectedEventIds.length > 0 ? state.selectedEventIds : undefined,
      })
      .then(function (newReport) {
        state.reports = [newReport].concat(state.reports);
        state.expandedId = newReport.id;
        renderReports();
        ui.toast('已提交分析，正在生成中...', 'success');
        startPolling(newReport.id);
        resetForm();
      })
      .catch(function (error) {
        ui.toast(error.message || '创建报告失败，请重试', 'error');
      })
      .finally(function () {
        setCreating(false);
      });
  }

  function handleCopy(report) {
    var text = reportText(report);
    if (!text) {
      ui.toast('报告内容为空', 'error');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          ui.toast('已复制到剪贴板', 'success');
        })
        .catch(function () {
          ui.toast('复制失败', 'error');
        });
    } else {
      ui.toast('当前浏览器不支持自动复制', 'warning');
    }
  }

  function handleExport(report) {
    var text = reportText(report);
    if (!text) {
      ui.toast('报告内容为空', 'error');
      return;
    }
    try {
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = report.title + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ui.toast('已导出报告', 'success');
    } catch (error) {
      ui.toast('导出失败', 'error');
    }
  }

  function handleDelete(reportId) {
    if (!window.confirm('确定要删除这份报告吗？')) return;
    api
      .deleteReport(reportId)
      .then(function () {
        stopPolling(reportId);
        state.reports = state.reports.filter(function (r) {
          return r.id !== reportId;
        });
        if (state.expandedId === reportId) state.expandedId = null;
        renderReports();
        ui.toast('已删除报告', 'success');
      })
      .catch(function (error) {
        ui.toast(error.message || '删除失败', 'error');
      });
  }

  function bindEvents() {
    el.togglePicker.addEventListener('click', function () {
      state.pickerOpen = !state.pickerOpen;
      renderPicker();
    });

    el.pickerPanel.addEventListener('change', function (event) {
      var checkbox = event.target.closest('[data-event-pick]');
      if (!checkbox) return;
      var id = checkbox.getAttribute('data-event-pick');
      var index = state.selectedEventIds.indexOf(id);
      if (index === -1) {
        state.selectedEventIds.push(id);
      } else {
        state.selectedEventIds.splice(index, 1);
      }
      renderPicker();
    });

    el.create.addEventListener('click', handleCreate);

    el.reportList.addEventListener('click', function (event) {
      var actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        event.stopPropagation();
        var reportId = actionButton.getAttribute('data-report');
        var report = state.reports.filter(function (r) {
          return r.id === reportId;
        })[0];
        if (!report) return;

        var action = actionButton.getAttribute('data-action');
        if (action === 'copy') handleCopy(report);
        else if (action === 'export') handleExport(report);
        else if (action === 'delete') handleDelete(reportId);
        return;
      }

      var head = event.target.closest('[data-report-head]');
      if (!head) return;
      var id = head.getAttribute('data-report-head');
      state.expandedId = state.expandedId === id ? null : id;
      renderReports();
    });
  }

  function init() {
    cacheElements();
    ui.renderHeader();
    bindEvents();
    renderPicker();
    renderReports();
    fetchEvents();
    fetchReports();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
