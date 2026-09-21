import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Clock, PlusCircle, BarChart3 } from "lucide-react";

const Layout = () => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "时间线", icon: Clock },
    { path: "/new", label: "新建事件", icon: PlusCircle },
    { path: "/analysis", label: "智能复盘", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Clock size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">时间线复盘</h1>
              <p className="text-xs text-slate-500">事件记录 · 智能分析</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive =
                path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(path);
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
