/**
 * 系统设置页面逻辑：大模型 API 配置的加载 / 保存 / 测试连接。
 */
(function () {
  'use strict';

  var api = window.App.api;
  var ui = window.App.ui;

  var el = {};

  var SOURCE_LABEL = {
    db: '当前使用「系统设置」里保存的 API Key',
    env: '当前沿用 .env 环境变量里的 AI_API_KEY',
    mock: '未配置 API Key，智能复盘将使用本地演示模式',
  };

  function cacheElements() {
    el.status = document.getElementById('ai-status');
    el.form = document.getElementById('ai-form');
    el.apiKey = document.getElementById('f-api-key');
    el.apiKeyHint = document.getElementById('api-key-hint');
    el.toggleKey = document.getElementById('btn-toggle-key');
    el.baseUrl = document.getElementById('f-base-url');
    el.model = document.getElementById('f-model');
    el.save = document.getElementById('btn-save');
    el.test = document.getElementById('btn-test');
  }

  function renderStatus(settings) {
    var dot;
    if (settings.hasApiKey) {
      dot = '<span class="h-2 w-2 rounded-full bg-emerald-400"></span>';
    } else {
      dot = '<span class="h-2 w-2 rounded-full bg-amber-400"></span>';
    }
    var label = SOURCE_LABEL[settings.source] || settings.source;
    el.status.innerHTML =
      dot +
      '<span>' +
      ui.esc(label) +
      (settings.hasApiKey
        ? '（Key：<code class="mx-1 rounded bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-300">' +
          ui.esc(settings.apiKeyMasked) +
          '</code>）'
        : '') +
      '</span>';
    el.apiKeyHint.textContent = settings.hasApiKey
      ? '已保存 Key：' + settings.apiKeyMasked + '（留空表示不修改）'
      : '尚未保存 API Key';
  }

  async function loadSettings() {
    try {
      var settings = await api.getAiSettings();
      renderStatus(settings);
      el.baseUrl.value = settings.baseUrl || '';
      el.model.value = settings.model || '';
    } catch (error) {
      el.status.innerHTML =
        '<span class="text-red-300">' +
        ui.esc(error.message || '加载设置失败') +
        '</span>';
    } finally {
      el.form.style.display = 'block';
      ui.refreshIcons();
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    var payload = {
      baseUrl: el.baseUrl.value.trim(),
      model: el.model.value.trim(),
    };
    // 留空 = 不修改已保存的 Key；填了 = 覆盖
    var keyInput = el.apiKey.value.trim();
    if (keyInput) payload.apiKey = keyInput;

    el.save.disabled = true;
    try {
      var settings = await api.updateAiSettings(payload);
      renderStatus(settings);
      el.apiKey.value = '';
      ui.toast('设置已保存，立即生效', 'success');
    } catch (error) {
      ui.toast(error.message || '保存设置失败', 'error');
    } finally {
      el.save.disabled = false;
    }
  }

  async function handleTest() {
    el.test.disabled = true;
    el.test.innerHTML =
      '<i data-lucide="loader-2" class="spin h-4 w-4"></i>测试中...';
    ui.refreshIcons();

    try {
      var payload = {
        baseUrl: el.baseUrl.value.trim() || undefined,
        model: el.model.value.trim() || undefined,
      };
      var keyInput = el.apiKey.value.trim();
      if (keyInput) payload.apiKey = keyInput;

      var result = await api.testAiSettings(payload);
      if (result.ok) {
        ui.toast(
          result.message + '（' + result.elapsedMs + 'ms）',
          'success'
        );
      } else {
        ui.toast(result.message, 'error');
      }
    } catch (error) {
      ui.toast(error.message || '测试连接失败', 'error');
    } finally {
      el.test.disabled = false;
      el.test.innerHTML =
        '<i data-lucide="plug-zap" class="h-4 w-4"></i>测试连接';
      ui.refreshIcons();
    }
  }

  function bindEvents() {
    el.form.addEventListener('submit', handleSave);
    el.test.addEventListener('click', handleTest);
    el.toggleKey.addEventListener('click', function () {
      var hidden = el.apiKey.type === 'password';
      el.apiKey.type = hidden ? 'text' : 'password';
      el.toggleKey.textContent = hidden ? '隐藏' : '显示';
    });
  }

  function init() {
    cacheElements();
    ui.renderHeader();
    bindEvents();
    loadSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
