"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, Sparkles, TrendingDown } from "lucide-react";
import {
  saveAnalysisSession,
  clearAnalysisSession,
  submitRuleAnalysis,
} from "@/lib/analysis/client";
import {
  DEFAULT_ANALYSIS_SCENARIO,
  type FunnelInput,
} from "@/lib/analysis/types";
import { mockFunnelData } from "@/lib/mock/funnel";

type FunnelFormData = {
  clickLoan: string;
  fillInfo: string;
  clickNext: string;
  idVerified: string;
  faceVerified: string;
  resultDistributed: string;
};

const SCENARIO_OPTIONS = [
  {
    id: "credit-funnel-demo",
    label: "进件流程分析",
    description: "基于主漏斗数据识别异常环节并生成两阶段分析结果。",
    available: true,
    scenario: DEFAULT_ANALYSIS_SCENARIO,
  },
  {
    id: "registration-conversion",
    label: "注册转化分析",
    description: "围绕注册链路识别关键流失点。",
    available: false,
  },
  {
    id: "channel-performance",
    label: "渠道效果分析",
    description: "评估不同投放渠道的转化与质量差异。",
    available: false,
  },
  {
    id: "risk-approval",
    label: "风控通过率分析",
    description: "聚焦审核、拒绝与通过率分布。",
    available: false,
  },
] as const;

export default function InputPage() {
  const router = useRouter();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    SCENARIO_OPTIONS[0].id,
  );
  const [formData, setFormData] = useState<FunnelFormData>({
    clickLoan: "",
    fillInfo: "",
    clickNext: "",
    idVerified: "",
    faceVerified: "",
    resultDistributed: "",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sampleWarning, setSampleWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedOption = SCENARIO_OPTIONS.find(
    (option) => option.id === selectedScenarioId,
  );
  const selectedScenario =
    selectedOption &&
    selectedOption.available &&
    "scenario" in selectedOption
      ? selectedOption.scenario
      : DEFAULT_ANALYSIS_SCENARIO;

  const funnelSteps = useMemo(
    () => [
      { field: "clickLoan", label: "点击借款按钮人数", icon: "👆" },
      { field: "fillInfo", label: "填写信息人数", icon: "✍️" },
      { field: "clickNext", label: "点击下一步人数", icon: "➡️" },
      { field: "idVerified", label: "身份证二要素通过人数", icon: "🪪" },
      { field: "faceVerified", label: "人脸识别通过人数", icon: "👤" },
      { field: "resultDistributed", label: "分发结果人数", icon: "✅" },
    ],
    [],
  );

  const handleChange = (field: keyof FunnelFormData, value: string) => {
    setSubmitError(null);
    setSampleWarning(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const buildFunnelInput = (): FunnelInput => ({
    clickLoan: Number(formData.clickLoan),
    fillInfo: Number(formData.fillInfo),
    clickNext: Number(formData.clickNext),
    idVerified: Number(formData.idVerified),
    faceVerified: Number(formData.faceVerified),
    resultDistributed: Number(formData.resultDistributed),
  });

  const handleAnalyze = async () => {
    setSubmitError(null);
    setSampleWarning(null);
    setIsSubmitting(true);

    try {
      const funnelData = buildFunnelInput();
      const { ruleAnalysisResult, initialAnalysisResult } = await submitRuleAnalysis(
        selectedScenario,
        funnelData,
      );

      if (ruleAnalysisResult.nextAction === "INSUFFICIENT_SAMPLE") {
        clearAnalysisSession();
        setSampleWarning(ruleAnalysisResult.sampleSizeMessage ?? "样本量不足");
        return;
      }

      saveAnalysisSession(
        selectedScenario,
        funnelData,
        ruleAnalysisResult,
        initialAnalysisResult,
      );
      router.push("/supplement");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "分析请求失败，请稍后重试",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = Object.values(formData).every(
    (val) => val !== "" && !Number.isNaN(Number(val)),
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          AI 驱动的智能分析
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">输入漏斗数据</h2>
        <p className="text-slate-600">
          输入您的信贷业务漏斗各环节数据，AI 将自动识别异常并提供优化建议
        </p>
      </div>

      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-6">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50">
          <CardTitle>分析场景</CardTitle>
          <CardDescription>当前仅开放进件流程分析，其他场景暂未启用。</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SCENARIO_OPTIONS.map((option) => {
              const isSelected = selectedScenarioId === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.available}
                  onClick={() => option.available && setSelectedScenarioId(option.id)}
                  className={`rounded-xl border px-4 py-4 text-left transition ${
                    option.available
                      ? isSelected
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                      : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{option.label}</div>
                    {option.available ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        可用
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-300 text-slate-500">
                        即将上线
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{option.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            {selectedScenario.name}数据输入
          </CardTitle>
          <CardDescription>按照业务流程顺序，依次输入各环节的用户数量</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {(sampleWarning || submitError) && (
            <div
              className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
                sampleWarning
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{sampleWarning ?? submitError}</span>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {funnelSteps.map((step, index) => (
              <div key={step.field} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <Label htmlFor={step.field} className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{step.icon}</span>
                    <span>{step.label}</span>
                  </Label>
                  <Input
                    id={step.field}
                    type="number"
                    placeholder="请输入人数"
                    value={formData[step.field as keyof FunnelFormData]}
                    onChange={(e) =>
                      handleChange(step.field as keyof FunnelFormData, e.target.value)
                    }
                    className="text-lg"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t">
            <Button
              onClick={handleAnalyze}
              disabled={!isFormValid || isSubmitting}
              className="w-full h-12 text-base font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {isSubmitting ? "分析中..." : "开始 AI 分析"}
              {!isSubmitting && <ArrowRight className="w-5 h-5 ml-2" />}
            </Button>

            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-600 hover:text-slate-900"
                onClick={() => setFormData(mockFunnelData)}
              >
                使用示例数据快速体验
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-1">秒级</div>
              <div className="text-sm text-slate-600">分析速度</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-1">智能</div>
              <div className="text-sm text-slate-600">异常识别</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-1">精准</div>
              <div className="text-sm text-slate-600">优化建议</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
