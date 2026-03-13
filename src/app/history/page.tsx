"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Eye,
  History as HistoryIcon,
  Trash2,
} from "lucide-react";
import {
  deleteAnalysisHistoryItem,
  getAnalysisHistory,
  restoreAnalysisHistoryItem,
} from "@/lib/analysis/client";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { AnalysisHistoryItem } from "@/lib/analysis/types";

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(getAnalysisHistory());
  }, []);

  const handleDelete = (id: number) => {
    setHistory(deleteAnalysisHistoryItem(id));
  };

  const handleView = (id: number) => {
    if (restoreAnalysisHistoryItem(id)) {
      router.push("/result");
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "yyyy年MM月dd日 HH:mm", { locale: zhCN });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">历史记录</h2>
        <p className="text-slate-600">查看过往的分析记录和结果</p>
      </div>

      {history.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm mb-1">总分析次数</p>
                  <p className="text-3xl font-bold text-slate-900">{history.length}</p>
                </div>
                <HistoryIcon className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-red-50 to-pink-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm mb-1">发现异常</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {history.filter((h) => h.hasAnomaly).length}
                  </p>
                </div>
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm mb-1">正常记录</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {history.filter((h) => !h.hasAnomaly).length}
                  </p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
          <CardTitle>分析记录列表</CardTitle>
          <CardDescription>点击查看按钮可以查看详细的分析结果</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <HistoryIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">暂无历史记录</p>
              <Button onClick={() => router.push("/input")} className="bg-blue-600 hover:bg-blue-700">
                开始第一次分析
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-white to-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.hasAnomaly ? "bg-red-100" : "bg-green-100"
                    }`}
                  >
                    {item.hasAnomaly ? (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{item.scenario}</h3>
                      {item.hasAnomaly ? (
                        <Badge variant="destructive">检测到异常</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700">正常</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(item.savedAt)}</span>
                      </div>
                      {item.hasAnomaly && item.anomalyStep && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          <span>异常环节：{item.anomalyStep}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleView(item.id)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      查看
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="mt-6 border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm">💡</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">使用提示</h4>
                <p className="text-sm text-slate-600">
                  定期查看历史记录可以帮助您追踪业务优化效果，对比不同时期的转化率变化。建议每周进行一次分析，及时发现和解决问题。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
