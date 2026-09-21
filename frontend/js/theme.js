/*
 * ttq-time 主题配色 —— 参照 F:\TTQ\fengshui「观象台」系列页面（墨底鎏金 · 中式暗色）
 *
 * 色值直接取自该项目的 CSS 变量定义（index.html / kanyu.html / luopan.html 等）：
 *   页面底色   #11110F (--bg)        次级底色   #16140F (--bg-2)
 *   面板/卡片  白色 3.5%~6% 半透明叠加
 *   边框线     rgba(201,164,76,.16)（金调描边）→ 折算实色 ≈ #2E2819
 *   主文字     #F7F7F6 (--ink)       次文字     --ink-dim ≈ #A0A09E / --ink-faint ≈ #6D6D6B
 *   主强调     鎏金 #C9A44C（次亮 --gold-soft #D8C27A）——按钮为 金→暖橙 渐变、深墨字 #1A160F
 *   次强调     天蓝 #9DB4FF（--blue）/ 暖橙 #FF9A6A（--warm，次亮 #FFBD8A）
 *   成功绿     #36A766（--green，次亮 #7EE0AE）  危险红   #FF6F6F（--red）
 *
 * 做法：整体重映射 Tailwind 的 slate / cyan / blue / emerald / amber / red 六个色阶，
 *      页面里已有的 bg-slate-900、border-slate-700/50、text-cyan-400、bg-cyan-500、
 *      text-emerald-400、text-red-400 等类名一行都不用改，颜色自动变成参考项目的观感。
 *
 * 引入要求：必须放在 <script src="https://cdn.tailwindcss.com"></script> 之后，
 *          Play CDN 会在 tailwind.config 被赋值后重新生成样式。
 */
(function () {
  if (typeof tailwind === 'undefined' || !tailwind) {
    return; // CDN 未加载（离线环境），页面会退化为无 Tailwind 的原生外观
  }

  tailwind.config = {
    theme: {
      extend: {
        colors: {
          /* 暖墨黑 → 暖白：背景、边框、文字全走这一条（700 为金调描边） */
          slate: {
            50: '#F7F7F6',
            100: '#F0EEE8',
            200: '#DDD9CD',
            300: '#C2BDAF',
            400: '#A0A09E',
            500: '#6D6D6B',
            600: '#4A463C',
            700: '#2E2819',
            800: '#1A1815',
            900: '#11110F',
            950: '#0B0B09',
          },
          /* 主强调：鎏金（承接参考项目的按钮/高亮/数值色，400 为 hover 亮金） */
          cyan: {
            100: '#F5ECD5',
            200: '#EBDCAE',
            300: '#E2CD8F',
            400: '#D8C27A',
            500: '#C9A44C',
            600: '#A8873B',
            700: '#7A662C',
            800: '#54461F',
            900: '#332A13',
          },
          /* 次强调 A：天蓝（--blue，用于「生成中」等状态） */
          blue: {
            100: '#E8EDFF',
            200: '#D2DBFF',
            300: '#B4C8FF',
            400: '#9DB4FF',
            500: '#7E95E8',
            600: '#5F76C9',
            700: '#47589A',
            800: '#33406E',
            900: '#20294A',
          },
          /* 成功/完成：参考项目绿（--green 系） */
          emerald: {
            100: '#DFF7EA',
            200: '#BFEED6',
            300: '#A0E6C2',
            400: '#7EE0AE',
            500: '#36A766',
            600: '#2C8C54',
            700: '#22693F',
            800: '#184A2C',
            900: '#0F2E1B',
          },
          /* 警示/次强调 B：参考项目暖橙（--warm 系） */
          amber: {
            100: '#FFEBDD',
            200: '#FFD8BC',
            300: '#FFC9A5',
            400: '#FFBD8A',
            500: '#FF9A6A',
            600: '#E07A4C',
            700: '#B25A34',
            800: '#854222',
            900: '#592C15',
          },
          /* 危险/失败：参考项目红（--red #FF6F6F） */
          red: {
            100: '#FFE3E3',
            200: '#FFC9C9',
            300: '#FF9494',
            400: '#FF6F6F',
            500: '#E85A5A',
            600: '#C24444',
            700: '#933434',
            800: '#6B2626',
            900: '#451818',
          },
        },
      },
    },
  };
})();
