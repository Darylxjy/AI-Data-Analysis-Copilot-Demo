"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Brain,
  FileText,
  GitBranch,
  Home,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAnalysisSession,
  isCurrentAnalysisSaved,
  saveCurrentAnalysisToHistory,
} from "@/lib/analysis/client";
import type {
  AnalysisPriority,
  FinalAnalysisResult,
} from "@/lib/analysis/types";

function getNextActionLabel(nextAction: FinalAnalysisResult["ruleAnalysisResult"]["nextAction"]) {
  if (nextAction === "ABNORMAL_SUPPLEMENT") {
    return "进入异常补充路径";
  }

  if (nextAction === "DIMENSION_SUPPLEMENT") {
    return "进入维度补充路径";
  }

  return "样本量不足";
}

function getStageLabel(stage: FinalAnalysisResult["stage"]) {
  return stage === "final" ? "第二阶段分析" : "第一阶段分析";
}

function getPriorityLabel(priority: AnalysisPriority) {
  if (priority === "high") {
    return "高";
  }

  if (priority === "medium") {
    return "中";
  }

  return "低";
}

function getProviderLabel(
  provider: FinalAnalysisResult["aiMeta"]["provider"],
  model: string,
) {
  if (provider === "dashscope") {
    return `百炼模型 · ${model}`;
  }

  if (provider === "openai") {
    return `OpenAI · ${model}`;
  }

  if (provider === "disabled") {
    return "AI 已禁用";
  }

  return `模拟结果 · ${model}`;
}

function truncateContent(content: string, maxLength = 110) {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}...`;
}

const FUNNEL_FIELD_LABELS: Record<string, string> = {
  clickLoan: "点击借款人数",
  fillInfo: "填写信息人数",
  clickNext: "点击下一步人数",
  idVerified: "身份证验证通过人数",
  faceVerified: "人脸识别通过人数",
  resultDistributed: "分发结果人数",
};

function normalizeEvidenceText(text: string) {
  let normalized = text
    .replace(/^[-•\d.\s]+/, "")
    .replace(/supplementData/gi, "补充数据")
    .replace(/nextAction/gi, "下一步建议")
    .replace(/ruleAnalysisResult/gi, "规则分析结果")
    .replace(/main funnel/gi, "主漏斗")
    .replace(/AI/gi, "AI")
    .trim();

  Object.entries(FUNNEL_FIELD_LABELS).forEach(([field, label]) => {
    normalized = normalized.replace(
      new RegExp(`${field}\\s*=\\s*(\\d+)`, "g"),
      `${label}$1人`,
    );
  });

  if (!normalized) {
    return "当前暂无可展示的证据，请结合补充数据继续分析。";
  }

  if (
    normalized.includes("点击借款人数") &&
    normalized.includes("填写信息人数") &&
    normalized.includes("绝对流失")
  ) {
    return normalized
      .replace(/点击借款人数(\d+)人/, "点击借款人数为 $1 人")
      .replace(/填写信息人数(\d+)人/, "填写信息人数为 $1 人")
      .replace(/，绝对流失(\d+)人/, "，该环节流失 $1 人")
      .replace(/（全漏斗最高）/, "，是全漏斗流失最多的环节");
  }

  if (
    normalized.includes("规则层判定所有步骤无统计异常") &&
    normalized.includes("整体转化率")
  ) {
    return normalized
      .replace(
        "规则层判定所有步骤无统计异常",
        "从主漏斗表现看，各环节暂未发现明显异常",
      )
      .replace("，表明问题具有结构性而非偶发性", "，更像是结构性差异而不是偶发波动");
  }

  if (
    normalized.includes("整体转化率") &&
    normalized.includes("未触发异常判定")
  ) {
    return normalized
      .replace("整体转化率", "从主漏斗整体表现看，当前整体转化率为")
      .replace("，主漏斗各环节未触发异常判定", "，主漏斗各环节暂未出现明显异常");
  }

  if (normalized.includes("未触发异常判定")) {
    return "当前主漏斗各环节未触发明显异常，建议继续结合补充数据判断是否存在结构性差异。";
  }

  if (normalized.includes("高于经验阈值")) {
    return "主漏斗各环节转化率整体处于经验阈值以上，暂未发现明显的流程性断点。";
  }

  if (normalized.includes("缺少时间、渠道、用户分层")) {
    return "目前还缺少时间、渠道和用户分层等信息，暂时无法进一步判断问题是否集中在特定场景。";
  }

  if (normalized.includes("微信渠道") && normalized.includes("H5")) {
    return normalized
      .replace("微信渠道", "从渠道表现看，微信渠道")
      .replace("H5投放渠道", "H5 投放渠道");
  }

  if (normalized.includes("工作日") && normalized.includes("周末")) {
    return normalized.replace("工作日", "从时间分布看，工作日");
  }

  if (normalized.includes("按钮点击率明显低于")) {
    return normalized.replace("按钮点击率明显低于", "按钮点击表现明显弱于");
  }

  return normalized
    .replace(/点击借款人数(\d+)人/g, "点击借款人数为 $1 人")
    .replace(/填写信息人数(\d+)人/g, "填写信息人数为 $1 人")
    .replace(/点击下一步人数(\d+)人/g, "点击下一步人数为 $1 人")
    .replace(/身份证验证通过人数(\d+)人/g, "身份证验证通过人数为 $1 人")
    .replace(/人脸识别通过人数(\d+)人/g, "人脸识别通过人数为 $1 人")
    .replace(/分发结果人数(\d+)人/g, "分发结果人数为 $1 人")
    .replace(/当前无 /g, "当前缺少 ")
    .replace(/当前仅有/g, "目前只有")
    .replace(/无法判断是否/g, "暂时无法判断是否")
    .replace(/后续应/g, "建议后续")
    .replace(/需继续验证/g, "建议继续验证");
}

export default function ResultPage() {
  const router = useRouter();
  const [hasJustSaved, setHasJustSaved] = useState(false);
  const session = typeof window === "undefined" ? null : getAnalysisSession();
  const finalAnalysisResult = session?.finalAnalysisResult ?? null;
  const isSaved =
    hasJustSaved ||
    (typeof window !== "undefined" && finalAnalysisResult
      ? isCurrentAnalysisSaved()
      : false);

  useEffect(() => {
    if (typeof window !== "undefined" && !finalAnalysisResult) {
      router.push("/supplement");
    }
  }, [finalAnalysisResult, router]);

  if (!finalAnalysisResult) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600">第二阶段分析结果加载中...</p>
        </div>
      </div>
    );
  }

  const {
    aiAnalysis,
    aiMeta,
    ruleAnalysisResult,
    scenario,
    supplementData,
  } =
    finalAnalysisResult;
  const referencedKnowledge = finalAnalysisResult.referencedKnowledge ?? [];

  const handleSave = () => {
    const saved = saveCurrentAnalysisToHistory();
    if (saved) {
      setHasJustSaved(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
          <span>数据输入</span>
          <ArrowRight className="w-4 h-4" />
          <span>补充数据</span>
          <ArrowRight className="w-4 h-4" />
          <span className="text-blue-600 font-medium">分析结果</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">第二阶段分析结果</h2>
            <p className="text-slate-600 mt-2">
              基于基础漏斗数据、补充数据和业务知识生成的最终分析结论
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaved}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              {isSaved ? "已保存到历史记录" : "保存分析结果"}
            </Button>
            <Button onClick={() => router.push("/input")} variant="outline">
              <Home className="w-4 h-4 mr-2" />
              新建分析
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">整体转化率</p>
                <p className="text-4xl font-bold">
                  {ruleAnalysisResult.overallRate?.toFixed(2) ?? "--"}%
                </p>
              </div>
              <TrendingDown className="w-12 h-12 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`shadow-lg border-0 text-white ${
            ruleAnalysisResult.isAbnormal
              ? "bg-gradient-to-br from-red-500 to-red-600"
              : "bg-gradient-to-br from-emerald-500 to-emerald-600"
          }`}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">规则层判断</p>
                <p className="text-lg font-bold">
                  {ruleAnalysisResult.isAbnormal ? "发现明显异常" : "未发现明显异常"}
                </p>
              </div>
              <AlertCircle className="w-12 h-12 text-white/70" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-gradient-to-br from-slate-700 to-slate-900 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm mb-1">下一步动作</p>
                <p className="text-lg font-bold">
                  {getNextActionLabel(ruleAnalysisResult.nextAction)}
                </p>
              </div>
              <GitBranch className="w-12 h-12 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {(supplementData.segmentData || supplementData.dimensionData) && (
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              第二阶段输入的补充数据
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supplementData.segmentData && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">环节细分数据</h4>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-6 max-h-40 overflow-auto">
                    {supplementData.segmentData}
                  </pre>
                </div>
              )}
              {supplementData.dimensionData && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <h4 className="font-semibold text-slate-900 mb-2">维度数据</h4>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-6 max-h-40 overflow-auto">
                    {supplementData.dimensionData}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg border-0 mb-6">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            指标摘要
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-slate-700 leading-7">{aiAnalysis.metricSummary.overview}</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {aiAnalysis.metricSummary.keyMetrics.map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm text-slate-500 mb-1">{item.label}</div>
                <div className="font-semibold text-slate-900">{item.value}</div>
                <div className="text-xs text-slate-500 mt-1">{item.note}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Badge className="bg-slate-900 text-white hover:bg-slate-900">
              {getStageLabel(finalAnalysisResult.stage)}
            </Badge>
            <Badge variant="outline">{getNextActionLabel(ruleAnalysisResult.nextAction)}</Badge>
            <Badge variant="outline">{scenario.name}</Badge>
            <Badge variant="outline">{getProviderLabel(aiMeta.provider, aiMeta.model)}</Badge>
            {aiMeta.usedFallback && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                已使用兜底结果
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              漏斗人数分布
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={ruleAnalysisResult.funnelSteps}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="label" type="category" width={110} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ruleAnalysisResult.funnelSteps.map((step) => (
                <div key={step.field} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-sm font-medium text-slate-700">{step.label}</div>
                  <div className="text-xs text-slate-500">
                    {step.value} 人，入口转化 {step.rateFromEntry.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              问题识别
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm text-slate-500 mb-1">识别结论</div>
                <div className="text-base font-semibold text-slate-900">
                  {aiAnalysis.issueIdentification.summary}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm text-slate-500 mb-1">影响环节</div>
                <div className="text-sm text-slate-700">
                  {aiAnalysis.issueIdentification.affectedStep ?? "当前未明确到单一主环节"}
                </div>
                <div className="mt-2">
                  <Badge variant="outline">
                    优先级：{getPriorityLabel(aiAnalysis.issueIdentification.severity)}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-sm text-slate-500 mb-2">证据列表</div>
                <div className="space-y-2">
                  {aiAnalysis.issueIdentification.evidence.length > 0 ? (
                    aiAnalysis.issueIdentification.evidence.map((item, index) => (
                      <div key={`${item}-${index}`} className="text-sm text-slate-700 leading-6">
                        {index + 1}. {normalizeEvidenceText(item)}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-600">
                      当前暂无可展示的依据，请结合补充数据继续分析。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 mb-6">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
            环节转化率详情
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {ruleAnalysisResult.conversionRates.map((item) => (
              <div
                key={item.stepKey}
                className={`p-4 rounded-lg ${
                  item.isAbnormal ? "bg-red-50 border-2 border-red-300" : "bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    {item.stepLabel}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">阈值 {item.threshold}%</Badge>
                    {item.isAbnormal && (
                      <Badge variant="destructive" className="text-xs">
                        异常
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${item.isAbnormal ? "bg-red-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min(item.rate, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-lg font-bold ${
                      item.isAbnormal ? "text-red-600" : "text-slate-900"
                    }`}
                  >
                    {item.rate.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  与其他环节平均值差距 {item.gapVsAverage.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              问题拆解
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {aiAnalysis.problemBreakdown.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-lg bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900 mb-1">{item.title}</div>
                  <div className="text-sm text-slate-700 mb-2">{item.detail}</div>
                  <div className="text-xs text-slate-500 mb-1">
                    支撑信息：{item.supportingData}
                  </div>
                  {item.missingData && (
                    <div className="text-xs text-amber-700">仍需补充：{item.missingData}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              可能原因
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {aiAnalysis.possibleCauses.map((item, index) => (
                <div
                  key={`${item.cause}-${index}`}
                  className="rounded-lg border border-blue-100 bg-white px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-sm font-medium text-slate-900">{item.cause}</div>
                    <Badge variant="outline">
                      置信度：{getPriorityLabel(item.confidence)}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600">{item.rationale}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 mb-6">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600" />
            优化建议
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiAnalysis.optimizationSuggestions.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <Badge variant="outline">
                    优先级：{getPriorityLabel(item.priority)}
                  </Badge>
                </div>
                <p className="text-sm text-slate-700 mb-2">{item.action}</p>
                <p className="text-xs text-slate-500">{item.expectedImpact}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {referencedKnowledge.length > 0 && (
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-600" />
              本次参考知识
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {referencedKnowledge.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <Badge variant="outline">{item.category}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-6">
                    {truncateContent(item.content)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
