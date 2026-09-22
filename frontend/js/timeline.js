/**
 * 时间线页面逻辑。
 * 对应原 client/src/pages/TimelinePage/*（列表 + 筛选 + 展开详情 + 加载更多）。
 */
(function () {
  'use strict';

  var api = window.App.api;
  var ui = window.App.ui;
  var esc = ui.esc;
  var PAGE_SIZE = 10;
  var FILTER_SEP = '|~|';

  var REL_LABEL = { reference: '引用', causal: '因果', refute: '反驳' };

  var state = {
    page: 1,
    events: [],
    total: 0,
    loading: false,
    keyword: '',
    tag: '',
    location: '',
    startDate: '',
    endDate: '',
    eventType: '',
    filterOpen: false,
    expandedId: null,
    detailCache: {},
    detailLoadingId: null,
  };

  var lastSignature = '';
  var el = {};

  function cacheElements() {
    el.keyword = document.getElementById('f-keyword');
    el.tag = document.getElementById('f-tag');
    el.location = document.getElementById('f-location');
    el.start = document.getElementById('f-start');
    el.end = document.getElementById('f-end');
    el.type = document.getElementById('f-type');
    el.toggleFilter = document.getElementById('btn-toggle-filter');
    el.filterCount = document.getElementById('filter-count');
    el.filterChevron = document.getElementById('filter-chevron');
    el.filterPanel = document.getElementById('filter-panel');
    el.clearWrap = document.getElementById('clear-filter-wrap');
    el.clear = document.getElementById('btn-clear-filter');
    el.list = document.getElementById('timeline-list');
    el.loadMoreWrap = document.getElementById('load-more-wrap');
    el.loadMore = document.getElementById('btn-load-more');
    el.loadedCount = document.getElementById('loaded-count');
  }

  /* ------------------------------------------------------------------ 请求 */

  function endOfDayIso(dateStr) {
    var d = new Date(dateStr + 'T23:59:59.999');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function buildParams(page) {
    var params = { page: page, pageSize: PAGE_SIZE };
    if (state.keyword) params.keyword = state.keyword;
    if (state.tag) params.tag = state.tag;
    if (state.location) params.location = state.location;
    if (state.eventType) params.eventType = state.eventType;
    if (state.startDate) {
      var start = new Date(state.startDate + 'T00:00:00');
      if (!isNaN(start.getTime())) params.startTime = start.toISOString();
    }
    if (state.endDate) {
      var end = endOfDayIso(state.endDate);
      if (end) params.endTime = end;
    }
    return params;
  }

  async function fetchEvents(page, reset) {
    state.loading = true;
    if (reset) {
      state.events = [];
      render();
    }

    try {
      var res = await api.getEvents(buildParams(page));
      state.events = reset ? res.items : state.events.concat(res.items);
      state.total = res.total;
      state.page = page;
    } catch (error) {
      ui.toast(error.message || '加载事件列表失败', 'error');
    } finally {
      state.loading = false;
      render();
    }
  }

  /* --------------------------------------------------------------- 筛选栏 */

  function activeFilterCount() {
    return (
      (state.tag ? 1 : 0) +
      (state.location ? 1 : 0) +
      (state.startDate ? 1 : 0) +
      (state.endDate ? 1 : 0) +
      (state.eventType ? 1 : 0)
    );
  }

  function filterSignature() {
    return [
      state.keyword,
      state.tag,
      state.location,
      state.startDate,
      state.endDate,
      state.eventType,
    ].join(FILTER_SEP);
  }

  /** 从输入框读取筛选条件；withRefetch 为真时条件变化则回到第 1 页重查。 */
  function applyFilters(withRefetch) {
    state.keyword = el.keyword.value.trim();
    state.tag = el.tag.value.trim();
    state.location = el.location.value.trim();
    state.startDate = el.start.value;
    state.endDate = el.end.value;
    state.eventType = el.type.value;

    var count = activeFilterCount();
    if (count > 0) {
      el.filterCount.textContent = String(count);
      el.filterCount.classList.remove('hidden');
      el.filterCount.classList.add('flex');
      el.clearWrap.style.display = 'block';
    } else {
      el.filterCount.classList.add('hidden');
      el.filterCount.classList.remove('flex');
      el.clearWrap.style.display = 'none';
    }

    el.filterPanel.style.display = state.filterOpen ? 'grid' : 'none';
    el.filterChevron.setAttribute(
      'data-lucide',
      state.filterOpen ? 'chevron-up' : 'chevron-down'
    );
    ui.refreshIcons();

    if (!withRefetch) return;

    var next = filterSignature();
    if (next === lastSignature) return;
    lastSignature = next;
    state.expandedId = null;
    fetchEvents(1, true);
  }

  /* ----------------------------------------------------------------- 渲染 */

  var TYPE_STYLE = {
    '记事': 'bg-slate-700/70 text-slate-300',
    '假设': 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    '待办': 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    '结论': 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  };

  function typeBadge(type) {
    var t = type || '记事';
    var cls = TYPE_STYLE[t] || TYPE_STYLE['记事'];
    return (
      '<span class="rounded-full px-2 py-0.5 text-xs ' + cls + '">' + esc(t) + '</span>'
    );
  }

  function tagsHtml(tags) {
    return (tags || [])
      .map(function (tag) {
        return (
          '<button type="button" data-tag="' +
          esc(tag) +
          '" class="flex items-center gap-1 rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-300 transition-colors hover:bg-slate-600/80">' +
          '<i data-lucide="tag" class="h-2.5 w-2.5"></i>' +
          esc(tag) +
          '</button>'
        );
      })
      .join('');
  }

  function mediaGridHtml(media) {
    return (media || [])
      .map(function (m) {
        var inner;
        if (m.mediaType === 'image' && m.fileUrl) {
          inner =
            '<img src="' +
            esc(m.fileUrl) +
            '" alt="' +
            esc(m.fileName || '媒体图片') +
            '" class="h-full w-full object-cover" loading="lazy" />';
        } else {
          inner =
            '<div class="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500">' +
            '<i data-lucide="' +
            (m.mediaType === 'video' ? 'play' : 'image') +
            '" class="h-5 w-5"></i>' +
            '<span class="max-w-full truncate px-1 text-[10px]">' +
            esc(m.fileName || m.mediaType) +
            '</span></div>';
        }
        return (
          '<div class="relative aspect-video overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/60">' +
          inner +
          '</div>'
        );
      })
      .join('');
  }

  function chatListHtml(records) {
    return (records || [])
      .map(function (cr) {
        return (
          '<div class="flex items-start gap-2">' +
          '<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-300">' +
          '<i data-lucide="user" class="h-3 w-3"></i></div>' +
          '<div class="min-w-0 flex-1">' +
          '<div class="flex items-baseline gap-2">' +
          '<span class="text-xs font-medium text-cyan-400">' +
          esc(cr.sender) +
          '</span>' +
          (cr.sendTime
            ? '<span class="text-[10px] text-slate-500">' +
              esc(ui.formatDateTime(cr.sendTime)) +
              '</span>'
            : '') +
          '</div>' +
          '<div class="mt-1 inline-block max-w-full rounded-lg rounded-tl-sm bg-slate-700/60 px-3 py-1.5 text-sm text-slate-200">' +
          '<span class="break-words whitespace-pre-wrap">' +
          esc(cr.content) +
          '</span></div></div></div>'
        );
      })
      .join('');
  }

  function linksHtml(links) {
    var rows = (links || [])
      .map(function (lk) {
        var other = lk.relatedEvent || {};
        var rel = REL_LABEL[lk.relation] || lk.relation;
        var dir = lk.direction === 'in' ? '← 指向本事件' : '→ 由本事件发起';
        return (
          '<a href="event.html?id=' +
          encodeURIComponent(other.id || '') +
          '" class="block rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 transition-colors hover:border-cyan-500/40">' +
          '<div class="flex items-center gap-2 text-xs">' +
          '<span class="rounded-full bg-cyan-500/15 px-2 py-0.5 text-cyan-300">' +
          esc(rel) +
          '</span>' +
          '<span class="text-slate-500">' +
          esc(dir) +
          '</span>' +
          '</div>' +
          '<p class="mt-1 truncate text-sm text-slate-200">' +
          esc(other.description || '') +
          '</p>' +
          '<p class="mt-0.5 truncate text-[11px] text-slate-500">' +
          esc(ui.formatDateTime(other.eventTime || '')) +
          '</p>' +
          '</a>'
        );
      })
      .join('');
    return (
      '<div><h4 class="mb-2 text-xs font-medium text-slate-400">关联事件（' +
      (links || []).length +
      '）</h4><div class="space-y-2">' +
      rows +
      '</div></div>'
    );
  }

  function detailHtml(detail) {
    var parts = [
      '<div class="space-y-4">',
      '<div>',
      '<h4 class="mb-1.5 text-xs font-medium text-slate-400">事件描述</h4>',
      '<p class="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">' +
        esc(detail.description) +
        '</p>',
      '</div>',
    ];

    if (detail.media && detail.media.length > 0) {
      parts.push(
        '<div><h4 class="mb-2 text-xs font-medium text-slate-400">媒体资料</h4>' +
          '<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">' +
          mediaGridHtml(detail.media) +
          '</div></div>'
      );
    }

    if (detail.chatRecords && detail.chatRecords.length > 0) {
      parts.push(
        '<div><h4 class="mb-2 text-xs font-medium text-slate-400">聊天记录（' +
          detail.chatRecords.length +
          ' 条）</h4>' +
          '<div class="space-y-2 rounded-lg bg-slate-900/40 p-3">' +
          chatListHtml(detail.chatRecords) +
          '</div></div>'
      );
    }

    if (detail.links && detail.links.length > 0) {
      parts.push(linksHtml(detail.links));
    }

    parts.push('</div>');
    return parts.join('');
  }

  function cardHtml(ev) {
    var expanded = state.expandedId === ev.id;
    var dotClass = expanded
      ? 'border-cyan-400 bg-cyan-400 shadow-[0_0_8px_rgba(0_245_160_0.6)]'
      : 'border-slate-600 bg-slate-800';

    var detailSlot = '';
    if (expanded) {
      var inner;
      if (state.detailLoadingId === ev.id) {
        inner =
          '<div class="flex items-center justify-center py-6">' +
          '<i data-lucide="loader-2" class="spin h-5 w-5 text-cyan-400"></i>' +
          '<span class="ml-2 text-sm text-slate-400">加载详情...</span></div>';
      } else if (state.detailCache[ev.id]) {
        inner = detailHtml(state.detailCache[ev.id]);
      } else {
        inner = '<p class="py-3 text-center text-xs text-slate-500">暂无详情</p>';
      }
      detailSlot =
        '<div class="mt-4 border-t border-slate-700/50 pt-4">' +
        '<div class="mb-4 flex items-center justify-end gap-2">' +
        '<button type="button" data-action="edit" class="inline-flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-400">' +
        '<i data-lucide="pencil" class="h-3 w-3"></i>编辑</button>' +
        '<button type="button" data-action="delete" class="inline-flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400">' +
        '<i data-lucide="trash-2" class="h-3 w-3"></i>删除</button>' +
        '</div>' +
        inner +
        '</div>';
    }

    return (
      '<div class="relative pl-10">' +
      '<div class="absolute left-2 top-3 h-4 w-4 rounded-full border-2 transition-colors ' +
      dotClass +
      '"></div>' +
      '<div data-event-id="' +
      esc(ev.id) +
      '" class="animate-in cursor-pointer rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 transition-all hover:border-slate-600 hover:bg-slate-800">' +
      '<div class="flex flex-wrap items-center gap-3 text-sm">' +
      '<div class="flex items-center gap-1.5 text-cyan-400">' +
      '<i data-lucide="clock" class="h-3.5 w-3.5"></i>' +
      '<span>' +
      esc(ui.formatDateTime(ev.eventTime)) +
      '</span></div>' +
      (ev.location
        ? '<div class="flex items-center gap-1.5 text-slate-400">' +
          '<i data-lucide="map-pin" class="h-3.5 w-3.5"></i>' +
          '<span>' +
          esc(ev.location) +
          '</span></div>'
        : '') +
      typeBadge(ev.eventType) +
      '</div>' +
      '<p class="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-200">' +
      esc(ev.description) +
      '</p>' +
      '<div class="mt-3 flex flex-wrap items-center gap-3">' +
      '<div class="flex flex-wrap gap-1.5">' +
      tagsHtml(ev.tags) +
      '</div>' +
      '<div class="ml-auto flex items-center gap-3 text-xs text-slate-500">' +
      '<span class="flex items-center gap-1"><i data-lucide="image" class="h-3 w-3"></i>' +
      ev.mediaCount +
      ' 媒体</span>' +
      '<span class="flex items-center gap-1"><i data-lucide="message-square" class="h-3 w-3"></i>' +
      ev.chatRecordCount +
      ' 对话</span>' +
      (ev.linkCount
        ? '<span class="flex items-center gap-1"><i data-lucide="git-branch" class="h-3 w-3"></i>' +
          ev.linkCount +
          ' 关联</span>'
        : '') +
      '</div></div>' +
      detailSlot +
      '</div></div>'
    );
  }

  function emptyStateHtml() {
    return (
      '<div class="relative pl-10">' +
      '<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 py-16 text-center">' +
      '<i data-lucide="clock" class="mb-3 h-8 w-8 text-slate-600"></i>' +
      '<p class="text-sm text-slate-400">暂无事件记录</p>' +
      '<p class="mt-1 text-xs text-slate-500">创建你的第一个事件，开始记录时间线</p>' +
      '<a href="event.html" class="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-cyan-400">' +
      '<i data-lucide="plus" class="h-4 w-4"></i>去创建事件</a>' +
      '</div></div>'
    );
  }

  function render() {
    var html;

    if (state.loading && state.events.length === 0) {
      html =
        ui.skeletonNodeHtml() + ui.skeletonNodeHtml() + ui.skeletonNodeHtml();
    } else if (state.events.length === 0) {
      html = emptyStateHtml();
    } else {
      html = state.events.map(cardHtml).join('');
    }

    el.list.innerHTML = html;

    var hasMore = state.events.length > 0 && state.events.length < state.total;
    el.loadMoreWrap.style.display = hasMore ? 'block' : 'none';
    if (hasMore) {
      el.loadedCount.textContent =
        '已加载 ' + state.events.length + ' / ' + state.total + ' 条';
    }
    el.loadMore.disabled = state.loading;

    ui.refreshIcons();
  }

  /* --------------------------------------------------------------- 交互 */

  async function toggleExpand(id) {
    if (state.expandedId === id) {
      state.expandedId = null;
      render();
      return;
    }

    state.expandedId = id;

    if (!state.detailCache[id]) {
      state.detailLoadingId = id;
      render();
      try {
        state.detailCache[id] = await api.getEvent(id);
      } catch (error) {
        ui.toast(error.message || '加载事件详情失败', 'error');
      } finally {
        state.detailLoadingId = null;
      }
    }

    render();
  }

  /** 删除事件：确认后调接口，成功后保持筛选刷新列表。 */
  async function removeEvent(id) {
    if (
      !window.confirm(
        '确定要删除这个事件吗？其关联的媒体与聊天记录也会一并删除，且不可恢复。'
      )
    ) {
      return;
    }

    try {
      await api.deleteEvent(id);
      ui.toast('已删除事件', 'success');
      delete state.detailCache[id];
      if (state.expandedId === id) state.expandedId = null;
      // 保持筛选条件与页码；当前页删空则自动回退一页
      var maxPage = Math.max(1, Math.ceil((state.total - 1) / PAGE_SIZE));
      await fetchEvents(Math.min(state.page, maxPage), true);
    } catch (error) {
      ui.toast(error.message || '删除失败', 'error');
    }
  }

  function bindEvents() {
    var debounced = ui.debounce(function () {
      applyFilters(true);
    }, 300);

    [el.keyword, el.tag, el.location].forEach(function (input) {
      input.addEventListener('input', debounced);
    });
    [el.start, el.end, el.type].forEach(function (input) {
      input.addEventListener('change', function () {
        applyFilters(true);
      });
    });

    el.toggleFilter.addEventListener('click', function () {
      state.filterOpen = !state.filterOpen;
      applyFilters(false);
    });

    el.clear.addEventListener('click', function () {
      el.keyword.value = '';
      el.tag.value = '';
      el.location.value = '';
      el.start.value = '';
      el.end.value = '';
      el.type.value = '';
      applyFilters(true);
    });

    el.loadMore.addEventListener('click', function () {
      if (state.loading) return;
      fetchEvents(state.page + 1, false);
    });

    el.list.addEventListener('click', function (event) {
      var tagButton = event.target.closest('[data-tag]');
      if (tagButton) {
        event.stopPropagation();
        el.tag.value = tagButton.getAttribute('data-tag');
        state.filterOpen = true;
        applyFilters(true);
        return;
      }

      var actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        event.stopPropagation();
        var actionId = actionButton
          .closest('[data-event-id]')
          .getAttribute('data-event-id');
        if (actionButton.getAttribute('data-action') === 'edit') {
          window.location.href = 'event.html?id=' + encodeURIComponent(actionId);
        } else if (actionButton.getAttribute('data-action') === 'delete') {
          removeEvent(actionId);
        }
        return;
      }

      var card = event.target.closest('[data-event-id]');
      if (!card) return;
      if (event.target.closest('a')) return;
      toggleExpand(card.getAttribute('data-event-id'));
    });
  }

  function init() {
    cacheElements();
    ui.renderHeader();
    lastSignature = filterSignature();
    applyFilters(false);
    bindEvents();
    render();
    fetchEvents(1, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
