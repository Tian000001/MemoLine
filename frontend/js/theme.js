/*
 * ttq-time 主题配色 + 深/浅色切换
 *
 * 做法：把 Tailwind 六个色阶（slate/cyan/blue/emerald/amber/red）全部映射到 CSS 变量
 *      rgb(var(--c-x) / <alpha-value>)。深色、浅色两套变量值在 css/app.css 中定义：
 *        :root                       → 深色（原薄荷绿 HUD · 纯黑底）
 *        html[data-theme="light"]    → 浅色（参考「劳动法律师工作台」暖白底 + 青铜强调）
 *      切换主题只改 <html data-theme>，浏览器即时重算颜色，无需 Tailwind 重新编译。
 *
 * 页面里已有的 bg-slate-900 / border-slate-700/50 / text-cyan-400 / bg-cyan-500 等类名
 * 一行都不用改，颜色随主题自动切换。
 *
 * 引入要求：必须放在 <script src="https://cdn.tailwindcss.com"></script> 之后，
 *          Play CDN 会在 tailwind.config 被赋值后生成样式（颜色引用 CSS 变量，运行时解析）。
 */
(function () {
  'use strict';

  // 1) 将 Tailwind 色阶映射到 CSS 变量（支持 /opacity 透明度语法）
  if (typeof tailwind !== 'undefined' && tailwind) {
    var v = function (name) {
      return 'rgb(var(' + name + ') / <alpha-value>)';
    };
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            slate: {
              50: v('--c-slate-50'), 100: v('--c-slate-100'), 200: v('--c-slate-200'),
              300: v('--c-slate-300'), 400: v('--c-slate-400'), 500: v('--c-slate-500'),
              600: v('--c-slate-600'), 700: v('--c-slate-700'), 800: v('--c-slate-800'),
              900: v('--c-slate-900'), 950: v('--c-slate-950'),
            },
            cyan: {
              50: v('--c-cyan-50'), 100: v('--c-cyan-100'), 200: v('--c-cyan-200'),
              300: v('--c-cyan-300'), 400: v('--c-cyan-400'), 500: v('--c-cyan-500'),
              600: v('--c-cyan-600'), 700: v('--c-cyan-700'), 800: v('--c-cyan-800'),
              900: v('--c-cyan-900'),
            },
            blue: {
              50: v('--c-blue-50'), 100: v('--c-blue-100'), 200: v('--c-blue-200'),
              300: v('--c-blue-300'), 400: v('--c-blue-400'), 500: v('--c-blue-500'),
              600: v('--c-blue-600'), 700: v('--c-blue-700'), 800: v('--c-blue-800'),
              900: v('--c-blue-900'),
            },
            emerald: {
              50: v('--c-emerald-50'), 100: v('--c-emerald-100'), 200: v('--c-emerald-200'),
              300: v('--c-emerald-300'), 400: v('--c-emerald-400'), 500: v('--c-emerald-500'),
              600: v('--c-emerald-600'), 700: v('--c-emerald-700'), 800: v('--c-emerald-800'),
              900: v('--c-emerald-900'),
            },
            amber: {
              50: v('--c-amber-50'), 100: v('--c-amber-100'), 200: v('--c-amber-200'),
              300: v('--c-amber-300'), 400: v('--c-amber-400'), 500: v('--c-amber-500'),
              600: v('--c-amber-600'), 700: v('--c-amber-700'), 800: v('--c-amber-800'),
              900: v('--c-amber-900'),
            },
            red: {
              50: v('--c-red-50'), 100: v('--c-red-100'), 200: v('--c-red-200'),
              300: v('--c-red-300'), 400: v('--c-red-400'), 500: v('--c-red-500'),
              600: v('--c-red-600'), 700: v('--c-red-700'), 800: v('--c-red-800'),
              900: v('--c-red-900'),
            },
          },
        },
      },
    };
  }

  // 2) 深 / 浅主题切换，持久化到 localStorage
  var KEY = 'ttq-time-theme';

  function getSaved() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function applyTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {
      /* 隐私模式 / 禁用存储时静默降级 */
    }
    // 同步移动端浏览器地址栏颜色
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F7F6F3' : '#000000');
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(cur === 'light' ? 'dark' : 'light');
  }

  // 初始化（默认深色，符合「深色就是现在项目配色」）
  applyTheme(getSaved() || 'dark');
  window.applyTheme = applyTheme;
  window.toggleTheme = toggleTheme;
})();
