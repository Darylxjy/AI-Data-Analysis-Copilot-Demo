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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, Brain, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getAnalysisSession,
  getSupplementData,
  saveFinalAnalysisResult,
  saveSupplementData,
  submitFinalAnalysis,
} from "@/lib/analysis/client";
import type {
  ConversionRateMetric,
  InitialAnalysisResult,
  RuleAnalysisResult,
  SupplementData,
} from "@/lib/analysis/types";

export default function SupplementPage() {
  const router = useRouter();
  const [analysisResult, setAnalysisResult] = useState<RuleAnalysisResult | null>(null);
  const [initialAnalysisResult, setInitialAnalysisResult] =
    useState<InitialAnalysisResult | null>(null);
  const [supplementData, setSupplementDataState] = useState<SupplementData>({
    segmentData: "",
    dimensionData: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const session = getAnalysisSession();
    if (!session) {
      router.push("/input");
      return;
    }

    if (session.ruleAnalysisResult.nextAction === "INSUFFICIENT_SAMPLE") {
      router.push("/input");
      return;
    }

    if (!session.initialAnalysisResult) {
      router.push("/input");
      return;
    }

    const storedSupplementData = getSupplementData();

    setAnalysisResult(session.ruleAnalysisResult);
    setInitialAnalysisResult(session.initialAnalysisResult);

    if (storedSupplementData) {
      setSupplementDataState(storedSupplementData);
    }
  }, [router]);

  const handleContinue = () => {
    const session = getAnalysisSession();
    const initialAnalysisResult = session?.initialAnalysisResult;

    if (!session || !initialAnalysisResult) {
      router.push("/input");
      return;
    }

    void (async () => {
      setSubmitError(null);
      setIsSubmitting(true);

      try {
        saveSupplementData(supplementData);

        const finalAnalysisResult = await submitFinalAnalysis({
          scenario: session.scenario,
          funnelData: session.funnelData,
          ruleAnalysisResult: session.ruleAnalysisResult,
          initialAnalysisResult,
          supplementData,
        });

        saveFinalAnalysisResult(finalAnalysisResult);
        router.push("/result");
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "第二阶段分析失败，请稍后重试",
        );
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  if (!analysisResult || !initialAnalysisResult) {
    return <div>加载中...</div>;
  }

  const abnormalMetric: ConversionRateMetric | null =
    analysisResult.conversionRates.find((item) => item.isAbnormal) ?? null;
  const needsAbnormalSupplement =
    analysisResult.nextAction === "ABNORMAL_SUPPLEMENT";

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
          <span>数据输入</span>
          <ArrowRight className="w-4 h-4" />
          <span className="text-blue-600 font-medium">补充数据</span>
          <ArrowRight className="w-4 h-4" />
          <span>分析结果</span>
        </div>
        <h2 className="text-3xl font-bold text-slate-900">规则层初步分析</h2>
        <p className="text-slate-600 mt-2">
          {needsAbnormalSupplement
            ? "已识别到异常环节，请补充更多上下文数据以便进入结果页查看完整分析。"
            : "主漏斗未发现明显异常，建议补充维度数据以便在结果页查看更完整的结论。"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card
          className={`shadow-lg border-0 border-l-4 ${
            needsAbnormalSupplement ? "border-l-red-500" : "border-l-emerald-500"
          }`}
        >
          <CardHeader className={needsAbnormalSupplement ? "bg-red-50" : "bg-emerald-50"}>
            <div className="flex items-center gap-2">
              <AlertCircle
                className={`w-5 h-5 ${
                  needsAbnormalSupplement ? "text-red-600" : "text-emerald-600"
                }`}
              />
              <CardTitle
                className={needsAbnormalSupplement ? "text-red-900" : "text-emerald-900"}
              >
                {needsAbnormalSupplement ? "异常环节识别" : "主漏斗检测结果"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {needsAbnormalSupplement ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-600 text-sm">异常环节</Label>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {analysisResult.abnormalStep}
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600 text-sm">转化率</Label>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-red-600">
                      {abnormalMetric?.rate.toFixed(2)}%
                    </span>
                    <Badge variant="destructive">异常偏低</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600 text-sm">异常依据</Label>
                  <div className="mt-1 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                    {analysisResult.abnormalReason}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-slate-600 text-sm">检测结论</Label>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    主漏斗未发现明显异常
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600 text-sm">整体转化率</Label>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-600">
                      {analysisResult.overallRate?.toFixed(2)}%
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      主漏斗正常
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600 text-sm">下一步建议</Label>
                  <div className="mt-1 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                    建议重点补充时间、渠道、用户分层等维度数据，进一步确认是否存在结构性差异。
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-slate-900">第一阶段 AI 初步结论</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <Label className="text-slate-600 text-sm">指标摘要</Label>
                <div className="mt-1 text-sm text-slate-700 leading-relaxed">
                  {initialAnalysisResult.aiAnalysis.metricSummary.overview}
                </div>
              </div>

              <div>
                <Label className="text-slate-600 text-sm">问题判断</Label>
                <div className="mt-1 text-sm text-slate-700 leading-relaxed">
                  {initialAnalysisResult.aiAnalysis.issueIdentification.summary}
                </div>
              </div>

              <div>
                <Label className="text-slate-600 text-sm">第一次建议动作</Label>
                <div className="mt-2 space-y-2">
                  {initialAnalysisResult.aiAnalysis.optimizationSuggestions
                    .slice(0, 2)
                    .map((item, index) => (
                      <div
                        key={`${item.title}-${index}`}
                        className="rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700"
                      >
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="mt-1">{item.action}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-100 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-800">
                当前内容来自第一次真实 AI 分析。补充数据后，第二次分析会在这次结论基础上继续叠加输出。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
          <CardTitle>补充数据</CardTitle>
          <CardDescription>
            {needsAbnormalSupplement
              ? "优先补充异常环节细分数据，也可补充时间、渠道、用户维度数据。"
              : "建议优先补充时间、渠道、用户分层等维度数据。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {submitError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            </div>
          )}

          {needsAbnormalSupplement ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="segment">
                  环节细分数据
                  <span className="text-slate-500 text-sm ml-2">
                    （如：各子步骤的详细数据、按钮点击数据等）
                  </span>
                </Label>
                <Textarea
                  id="segment"
                  placeholder={
                    "示例：\n填写手机号：8500人\n填写身份证号：7200人\n填写联系人信息：6800人\n..."
                  }
                  value={supplementData.segmentData}
                  onChange={(e) =>
                    setSupplementDataState((prev) => ({
                      ...prev,
                      segmentData: e.target.value,
                    }))
                  }
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="dimension">
                  时间、渠道、用户维度数据
                  <span className="text-slate-500 text-sm ml-2">
                    （如：不同时间段、不同渠道、不同用户群体的数据）
                  </span>
                </Label>
                <Textarea
                  id="dimension"
                  placeholder={
                    "示例：\n【时间维度】\n工作日：转化率 65%\n周末：转化率 48%\n\n【渠道维度】\n微信渠道：8000人\nAPP渠道：5000人\n..."
                  }
                  value={supplementData.dimensionData}
                  onChange={(e) =>
                    setSupplementDataState((prev) => ({
                      ...prev,
                      dimensionData: e.target.value,
                    }))
                  }
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="dimension">
                时间、渠道、用户维度数据
                <span className="text-slate-500 text-sm ml-2">
                  （如：不同时间段、不同渠道、不同用户群体的数据）
                </span>
              </Label>
              <Textarea
                id="dimension"
                placeholder={
                  "示例：\n【时间维度】\n工作日：转化率 65%\n周末：转化率 48%\n\n【渠道维度】\n微信渠道：8000人\nAPP渠道：5000人\n..."
                }
                value={supplementData.dimensionData}
                onChange={(e) =>
                  setSupplementDataState((prev) => ({
                    ...prev,
                    dimensionData: e.target.value,
                  }))
                }
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          )}

          <div className="mt-8 pt-6 border-t flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/input")}
              className="flex-1"
            >
              返回修改
            </Button>
            <Button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {isSubmitting ? "生成第二阶段结果中..." : "查看分析结果"}
              {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
