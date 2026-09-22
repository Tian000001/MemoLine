/**
 * 事件录入 / 编辑页面逻辑。
 * 对应原 client/src/pages/EventFormPage/*（含 MediaUpload、ChatRecordImport、事件关联）。
 */
(function () {
  'use strict';

  var api = window.App.api;
  var ui = window.App.ui;
  var esc = ui.esc;

  var REL_LABEL = { reference: '引用', causal: '因果', refute: '反驳' };

  var state = {
    id: null,
    isEdit: false,
    submitting: false,
    parsing: false,
    uploading: false,
    tags: [],
    media: [], // 新上传：{mediaType, filePath, fileUrl, fileName, fileSize}
    existingMedia: [],
    chatText: '',
    confirmedRecords: [],
    existingChatRecords: [],
    parsedRecords: [],
    links: [], // 事件关联（编辑模式）
    allEvents: [], // 关联对象候选
  };

  var el = {};

  function cacheElements() {
    el.title = document.getElementById('page-title');
    el.back = document.getElementById('btn-back');
    el.loadingTip = document.getElementById('loading-tip');
    el.form = document.getElementById('event-form');
    el.time = document.getElementById('f-time');
    el.location = document.getElementById('f-location');
    el.type = document.getElementById('f-type');
    el.description = document.getElementById('f-description');
    el.tagInput = document.getElementById('f-tag-input');
    el.tagList = document.getElementById('tag-list');
    el.fileInput = document.getElementById('file-input');
    el.upload = document.getElementById('btn-upload');
    el.mediaGrid = document.getElementById('media-grid');
    el.mediaTip = document.getElementById('media-readonly-tip');
    el.chatExisting = document.getElementById('chat-existing');
    el.chatEditor = document.getElementById('chat-editor');
    el.chatText = document.getElementById('f-chat-text');
    el.parse = document.getElementById('btn-parse');
    el.clearChat = document.getElementById('btn-clear-chat');
    el.chatTip = document.getElementById('chat-readonly-tip');
    el.linkSection = document.getElementById('link-section');
    el.linkTarget = document.getElementById('f-link-target');
    el.linkRelation = document.getElementById('f-link-relation');
    el.linkAdd = document.getElementById('btn-add-link');
    el.linkList = document.getElementById('link-list');
    el.cancel = document.getElementById('btn-cancel');
    el.submit = document.getElementById('btn-submit');
    el.submitLabel = document.getElementById('btn-submit-label');
    el.modal = document.getElementById('parse-modal');
    el.modalTitle = document.getElementById('parse-modal-title');
    el.modalBody = document.getElementById('parse-modal-body');
    el.modalClose = document.getElementById('btn-parse-close');
    el.modalCancel = document.getElementById('btn-parse-cancel');
    el.modalConfirm = document.getElementById('btn-parse-confirm');
  }

  /* ------------------------------------------------------------ 时间工具 */

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** ISO → datetime-local 输入框需要的本地时间字符串 */
  function toLocalInputValue(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  /* -------------------------------------------------------------- 标签 */

  function renderTags() {
    el.tagList.innerHTML = state.tags
      .map(function (tag) {
        return (
          '<span class="inline-flex items-center gap-1 rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-300">' +
          esc(tag) +
          '<button type="button" data-remove-tag="' +
          esc(tag) +
          '" class="text-slate-400 transition-colors hover:text-slate-200" aria-label="删除标签 ' +
          esc(tag) +
          '"><i data-lucide="x" class="h-3 w-3"></i></button></span>'
        );
      })
      .join('');
    ui.refreshIcons();
  }

  function addTag() {
    var value = el.tagInput.value.trim();
    if (!value) return;
    if (state.tags.indexOf(value) !== -1) {
      ui.toast('标签已存在', 'warning');
      return;
    }
    state.tags.push(value);
    el.tagInput.value = '';
    renderTags();
  }

  /* -------------------------------------------------------------- 媒体 */

  function renderMedia() {
    var html = state.existingMedia
      .map(function (m, idx) {
        return mediaTileHtml(m.mediaType, m.fileUrl || '', m.fileName || '', null, idx);
      })
      .join('');

    html += state.media
      .map(function (m, idx) {
        return mediaTileHtml(
          m.mediaType,
          m.fileUrl || '',
          m.fileName || '',
          idx,
          state.existingMedia.length + idx
        );
      })
      .join('');

    el.mediaGrid.innerHTML = html;
    ui.refreshIcons();
  }

  function mediaTileHtml(mediaType, previewUrl, fileName, removeIndex, keyIndex) {
    var inner;
    if (mediaType === 'image') {
      inner = previewUrl
        ? '<img src="' +
          esc(previewUrl) +
          '" alt="' +
          esc(fileName) +
          '" class="h-full w-full object-cover" />'
        : '<div class="flex h-full items-center justify-center"><i data-lucide="image" class="h-6 w-6 text-slate-600"></i></div>';
    } else {
      inner =
        '<div class="flex h-full items-center justify-center bg-slate-900"><i data-lucide="play" class="h-7 w-7 text-slate-500"></i></div>';
    }

    var removeBtn =
      removeIndex === null
        ? ''
        : '<button type="button" data-remove-media="' +
          removeIndex +
          '" class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-label="删除">' +
          '<i data-lucide="x" class="h-3.5 w-3.5"></i></button>';

    return (
      '<div class="group relative aspect-square overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/60" data-media-key="' +
      keyIndex +
      '">' +
      inner +
      removeBtn +
      '</div>'
    );
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    state.uploading = true;
    el.upload.disabled = true;
    el.upload.innerHTML =
      '<i data-lucide="loader-2" class="spin h-5 w-5"></i>上传中...';
    ui.refreshIcons();

    var added = 0;
    for (var i = 0; i < files.length; i += 1) {
      var file = files[i];
      var isVideo = file.type.indexOf('video/') === 0;
      var isImage = file.type.indexOf('image/') === 0;
      if (!isVideo && !isImage) {
        ui.toast(file.name + ' 不是图片或视频，已跳过', 'warning');
        continue;
      }
      try {
        var meta = await api.uploadMedia(file);
        state.media.push({
          mediaType: meta.mediaType,
          filePath: meta.filePath,
          fileUrl: meta.fileUrl,
          fileName: meta.fileName,
          fileSize: meta.fileSize,
        });
        added += 1;
      } catch (error) {
        ui.toast(file.name + ' 上传失败：' + (error.message || ''), 'error');
      }
    }

    state.uploading = false;
    el.upload.disabled = false;
    el.upload.innerHTML = '<i data-lucide="upload" class="h-5 w-5"></i>点击上传图片/视频';
    el.fileInput.value = '';

    renderMedia();

    if (added > 0) ui.toast('成功上传 ' + added + ' 个文件', 'success');
  }

  /* ---------------------------------------------------------- 聊天记录 */

  function formatSendTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('zh-CN');
  }

  function recordRowHtml(sender, content, sendTime) {
    return (
      '<div class="flex gap-2 text-sm">' +
      '<div class="w-20 shrink-0 truncate font-medium text-cyan-400">' +
      esc(sender) +
      '</div>' +
      '<div class="flex-1">' +
      '<p class="break-words text-slate-300">' +
      esc(content) +
      '</p>' +
      (sendTime
        ? '<p class="mt-0.5 text-xs text-slate-500">' +
          esc(formatSendTime(sendTime)) +
          '</p>'
        : '') +
      '</div></div>'
    );
  }

  function renderChatExisting() {
    var rows = [];

    state.existingChatRecords.forEach(function (r) {
      rows.push(recordRowHtml(r.sender, r.content, r.sendTime));
    });
    state.confirmedRecords.forEach(function (r) {
      rows.push(recordRowHtml(r.sender, r.content, r.sendTime));
    });

    if (rows.length > 0) {
      el.chatExisting.innerHTML = rows.join('');
      el.chatExisting.style.display = 'block';
    } else {
      el.chatExisting.innerHTML = '';
      el.chatExisting.style.display = 'none';
    }

    el.clearChat.style.display = state.confirmedRecords.length > 0 ? 'block' : 'none';
    ui.refreshIcons();
  }

  function renderParseModal() {
    el.modalTitle.textContent = '解析预览 (' + state.parsedRecords.length + ' 条)';

    if (state.parsedRecords.length === 0) {
      el.modalBody.innerHTML =
        '<p class="text-center text-sm text-slate-500">未解析到聊天记录</p>';
    } else {
      el.modalBody.innerHTML = state.parsedRecords
        .map(function (r) {
          return recordRowHtml(r.sender, r.content, r.sendTime);
        })
        .join('');
    }

    el.modalConfirm.disabled = state.parsedRecords.length === 0;
    el.modal.style.display = 'flex';
    ui.refreshIcons();
  }

  function closeParseModal() {
    el.modal.style.display = 'none';
    state.parsedRecords = [];
  }

  async function handleParse() {
    var text = el.chatText.value.trim();
    if (!text) {
      ui.toast('请先粘贴聊天记录文本', 'warning');
      return;
    }

    state.parsing = true;
    el.parse.disabled = true;
    el.parse.innerHTML =
      '<i data-lucide="loader-2" class="spin h-4 w-4"></i>解析中...';
    ui.refreshIcons();

    try {
      var result = await api.parseChat(text);
      state.parsedRecords = result.records || [];
      renderParseModal();
      if (state.parsedRecords.length === 0) {
        ui.toast('未解析到任何聊天记录', 'warning');
      }
    } catch (error) {
      ui.toast(error.message || '解析聊天记录失败', 'error');
    } finally {
      state.parsing = false;
      el.parse.disabled = false;
      el.parse.innerHTML = '<i data-lucide="refresh-cw" class="h-4 w-4"></i>解析预览';
      ui.refreshIcons();
    }
  }

  /* ---------------------------------------------------------- 事件关联 */

  function renderLinks() {
    if (!state.links || state.links.length === 0) {
      el.linkList.innerHTML =
        '<p class="text-xs text-slate-500">暂无关联事件。选择上方的事件与关系后点击「关联」。</p>';
      ui.refreshIcons();
      return;
    }

    el.linkList.innerHTML = state.links
      .map(function (lk) {
        var other = lk.relatedEvent || {};
        var rel = REL_LABEL[lk.relation] || lk.relation;
        var dirLabel = lk.direction === 'in' ? '← 指向本事件' : '→ 由本事件发起';
        return (
          '<div class="flex items-center justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">' +
          '<div class="min-w-0 flex-1">' +
          '<div class="flex items-center gap-2 text-xs">' +
          '<span class="rounded-full bg-cyan-500/15 px-2 py-0.5 text-cyan-300">' +
          esc(rel) +
          '</span>' +
          '<span class="text-slate-500">' +
          esc(dirLabel) +
          '</span>' +
          '</div>' +
          '<p class="mt-1 truncate text-sm text-slate-200">' +
          esc(other.description || '') +
          '</p>' +
          '<p class="mt-0.5 truncate text-[11px] text-slate-500">' +
          esc(ui.formatDateTime(other.eventTime || '')) +
          '</p>' +
          '</div>' +
          '<button type="button" data-remove-link="' +
          esc(lk.id) +
          '" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400" aria-label="取消关联">' +
          '<i data-lucide="unlink" class="h-4 w-4"></i></button>' +
          '</div>'
        );
      })
      .join('');
    ui.refreshIcons();
  }

  async function loadCandidateEvents() {
    try {
      var res = await api.getEvents({ page: 1, pageSize: 200 });
      state.allEvents = (res.items || []).filter(function (e) {
        return e.id !== state.id;
      });
      if (state.allEvents.length === 0) {
        el.linkTarget.innerHTML = '<option value="">暂无其他事件可关联</option>';
        el.linkAdd.disabled = true;
        return;
      }
      el.linkTarget.innerHTML =
        '<option value="">选择要关联的事件…</option>' +
        state.allEvents
          .map(function (e) {
            var label = (e.eventType || '记事') + ' · ' + (e.description || '').slice(0, 24);
            return '<option value="' + esc(e.id) + '">' + esc(label) + '</option>';
          })
          .join('');
      el.linkAdd.disabled = false;
    } catch (error) {
      el.linkTarget.innerHTML = '<option value="">加载事件列表失败</option>';
      el.linkAdd.disabled = true;
    }
  }

  async function handleAddLink() {
    var target = el.linkTarget.value;
    if (!target) {
      ui.toast('请选择要关联的事件', 'warning');
      return;
    }
    if (!state.id) return;

    el.linkAdd.disabled = true;
    try {
      var link = await api.createLink({
        fromEvent: state.id,
        toEvent: target,
        relation: el.linkRelation.value,
      });
      state.links.push(link);
      renderLinks();
      el.linkTarget.value = '';
      ui.toast('已关联事件', 'success');
    } catch (error) {
      ui.toast(error.message || '关联失败', 'error');
    } finally {
      el.linkAdd.disabled = false;
    }
  }

  async function handleRemoveLink(linkId) {
    if (!window.confirm('确定取消该关联吗？')) return;
    try {
      await api.deleteLink(linkId);
      state.links = state.links.filter(function (l) {
        return l.id !== linkId;
      });
      renderLinks();
      ui.toast('已取消关联', 'success');
    } catch (error) {
      ui.toast(error.message || '取消关联失败', 'error');
    }
  }

  /* -------------------------------------------------------------- 初始化 */

  function applyReadOnlyMode() {
    if (!state.isEdit) return;

    el.upload.style.display = 'none';
    el.mediaTip.style.display = state.existingMedia.length > 0 ? 'block' : 'none';

    el.chatEditor.style.display = 'none';
    el.chatTip.style.display = 'block';
  }

  async function loadEvent() {
    el.loadingTip.style.display = 'flex';
    el.form.style.display = 'none';

    try {
      var data = await api.getEvent(state.id);
      el.time.value = toLocalInputValue(data.eventTime);
      el.location.value = data.location || '';
      el.type.value = data.eventType || '记事';
      el.description.value = data.description || '';
      state.tags = data.tags || [];
      state.existingMedia = data.media || [];
      state.existingChatRecords = data.chatRecords || [];
      state.links = data.links || [];
      await loadCandidateEvents();
    } catch (error) {
      ui.toast(error.message || '加载事件详情失败', 'error');
    } finally {
      el.loadingTip.style.display = 'none';
      el.form.style.display = 'block';
      renderTags();
      renderMedia();
      renderChatExisting();
      renderLinks();
      applyReadOnlyMode();
      ui.refreshIcons();
    }
  }

  /* ---------------------------------------------------------------- 提交 */

  function setSubmitting(flag) {
    state.submitting = flag;
    el.submit.disabled = flag;
    el.submit.innerHTML =
      '<i data-lucide="' +
      (flag ? 'loader-2' : 'save') +
      '" class="h-4 w-4' +
      (flag ? ' spin' : '') +
      '"></i><span id="btn-submit-label">' +
      (flag ? '保存中...' : state.isEdit ? '更新事件' : '保存事件') +
      '</span>';
    el.submitLabel = document.getElementById('btn-submit-label');
    ui.refreshIcons();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!el.time.value) {
      ui.toast('请选择日期时间', 'error');
      return;
    }
    if (!el.description.value.trim()) {
      ui.toast('请填写事件描述', 'error');
      return;
    }

    var timeValue = new Date(el.time.value);
    if (isNaN(timeValue.getTime())) {
      ui.toast('日期时间格式不正确', 'error');
      return;
    }

    setSubmitting(true);

    try {
      var payload = {
        eventTime: timeValue.toISOString(),
        location: el.location.value || undefined,
        description: el.description.value.trim(),
        tags: state.tags,
        eventType: el.type.value || '记事',
      };

      if (state.isEdit) {
        await api.updateEvent(state.id, payload);
        ui.toast('事件更新成功', 'success');
      } else {
        payload.media = state.media.map(function (m) {
          return {
            mediaType: m.mediaType,
            fileUrl: m.fileUrl,
            fileName: m.fileName,
            fileSize: m.fileSize,
          };
        });
        if (state.confirmedRecords.length > 0) {
          payload.chatRecords = state.confirmedRecords.map(function (r) {
            return { sender: r.sender, content: r.content, sendTime: r.sendTime || undefined };
          });
        }
        if (el.chatText.value) payload.chatRecordText = el.chatText.value;

        await api.createEvent(payload);
        ui.toast('事件创建成功', 'success');
      }

      window.setTimeout(function () {
        window.location.href = 'index.html';
      }, 500);
    } catch (error) {
      ui.toast(error.message || '保存失败，请重试', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function bindEvents() {
    el.back.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'index.html';
      }
    });

    el.cancel.addEventListener('click', function () {
      window.location.href = 'index.html';
    });

    el.tagInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addTag();
    });

    el.tagList.addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-tag]');
      if (!button) return;
      var tag = button.getAttribute('data-remove-tag');
      state.tags = state.tags.filter(function (t) {
        return t !== tag;
      });
      renderTags();
    });

    el.upload.addEventListener('click', function () {
      el.fileInput.click();
    });
    el.fileInput.addEventListener('change', function (event) {
      handleFiles(event.target.files);
    });

    el.mediaGrid.addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-media]');
      if (!button) return;
      var idx = parseInt(button.getAttribute('data-remove-media'), 10);
      state.media.splice(idx, 1);
      renderMedia();
    });

    el.parse.addEventListener('click', handleParse);
    el.clearChat.addEventListener('click', function () {
      state.confirmedRecords = [];
      el.chatText.value = '';
      renderChatExisting();
    });

    el.modalClose.addEventListener('click', closeParseModal);
    el.modalCancel.addEventListener('click', closeParseModal);
    el.modalConfirm.addEventListener('click', function () {
      state.confirmedRecords = state.parsedRecords.slice();
      closeParseModal();
      renderChatExisting();
      ui.toast('已确认 ' + state.confirmedRecords.length + ' 条聊天记录', 'success');
    });

    el.linkAdd.addEventListener('click', handleAddLink);
    el.linkList.addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-link]');
      if (!button) return;
      handleRemoveLink(button.getAttribute('data-remove-link'));
    });

    el.form.addEventListener('submit', handleSubmit);
  }

  function init() {
    cacheElements();

    var params = new URLSearchParams(window.location.search);
    state.id = params.get('id');
    state.isEdit = Boolean(state.id);

    if (state.isEdit) {
      el.title.textContent = '编辑事件';
      document.title = '编辑事件 · 时间线复盘';
      el.submit.innerHTML =
        '<i data-lucide="save" class="h-4 w-4"></i><span id="btn-submit-label">更新事件</span>';
      el.submitLabel = document.getElementById('btn-submit-label');
    } else {
      // 新建模式：还没有事件 id，无法建立关联，隐藏关联区块
      el.linkSection.style.display = 'none';
    }

    ui.renderHeader();
    bindEvents();
    renderTags();
    renderMedia();
    renderChatExisting();

    if (state.isEdit) {
      loadEvent();
    } else {
      el.form.style.display = 'block';
      ui.refreshIcons();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
