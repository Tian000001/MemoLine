import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl font-bold text-zinc-300 dark:text-zinc-600">404</div>
      <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
        页面走丢了
      </h1>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        你访问的页面不存在，或链接已失效。返回时间线首页继续记录你的事件吧。
      </p>
      <Link
        to="/"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        回到首页
      </Link>
    </div>
  );
};

export default NotFound;
