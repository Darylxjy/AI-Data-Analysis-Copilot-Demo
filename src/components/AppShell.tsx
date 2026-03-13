"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, FileInput, History, LineChart, PlusSquare } from "lucide-react";

const navItems = [
  { path: "/input", label: "数据输入", icon: FileInput },
  { path: "/supplement", label: "补充数据", icon: PlusSquare },
  { path: "/result", label: "分析结果", icon: LineChart },
  { path: "/history", label: "历史记录", icon: History },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-xl text-slate-900 truncate">
                  AI 数据分析助手
                </h1>
                <p className="text-xs text-slate-500 truncate">
                  智能识别异常环节，优化业务流程
                </p>
              </div>
            </div>

            <nav className="flex gap-2 flex-wrap justify-end">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

