/**
 * ttq-time 前端 API 封装（原生 fetch）。
 * 对应原 client/src/api/*.ts，接口路径与返回结构完全一致。
 */
(function (global) {
  'use strict';

  var BASE = '/api';

  function buildUrl(path, params) {
    var url = BASE + path;
    if (!params) return url;

    var parts = [];
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });

    return parts.length ? url + '?' + parts.join('&') : url;
  }

  function extractMessage(payload, fallback) {
    if (payload && payload.error && payload.error.message) {
      return payload.error.message;
    }
    if (payload && payload.detail) {
      return typeof payload.detail === 'string' ? payload.detail : fallback;
    }
    return fallback;
  }

  async function request(path, options) {
    var opts = options || {};
    var init = { method: opts.method || 'GET', headers: {} };

    if (opts.formData) {
      // 交给浏览器自动带 multipart boundary，不要手写 Content-Type
      init.body = opts.formData;
    } else if (opts.body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    var response;
    try {
      response = await fetch(buildUrl(path, opts.params), init);
    } catch (networkError) {
      var offline = new Error('无法连接服务器，请确认后端已启动');
      offline.status = 0;
      offline.cause = networkError;
      throw offline;
    }

    if (!response.ok) {
      var payload = null;
      try {
        payload = await response.json();
      } catch (ignore) {
        payload = null;
      }
      var error = new Error(
        extractMessage(payload, '请求失败（HTTP ' + response.status + '）')
      );
      error.status = response.status;
      error.data = payload;
      throw error;
    }

    if (response.status === 204) return null;

    var contentType = response.headers.get('content-type') || '';
    if (contentType.indexOf('application/json') !== -1) {
      return response.json();
    }
    return response.text();
  }

  var api = {
    getEvents: function (params) {
      return request('/events', { params: params });
    },
    getEvent: function (id) {
      return request('/events/' + encodeURIComponent(id));
    },
    createEvent: function (data) {
      return request('/events', { method: 'POST', body: data });
    },
    updateEvent: function (id, data) {
      return request('/events/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: data,
      });
    },
    deleteEvent: function (id) {
      return request('/events/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    parseChat: function (text) {
      return request('/events/parse-chat', { method: 'POST', body: { text: text } });
    },
    uploadMedia: function (file) {
      var form = new FormData();
      form.append('file', file);
      return request('/media/upload', { method: 'POST', formData: form });
    },
    getReports: function () {
      return request('/analysis/reports');
    },
    getReport: function (id) {
      return request('/analysis/reports/' + encodeURIComponent(id));
    },
    createReport: function (data) {
      return request('/analysis/reports', { method: 'POST', body: data });
    },
    deleteReport: function (id) {
      return request('/analysis/reports/' + encodeURIComponent(id), { method: 'DELETE' });
    },
  };

  global.App = global.App || {};
  global.App.api = api;
})(window);
