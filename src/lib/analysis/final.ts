import OpenAI from "openai";
import type {
  AnalysisPriority,
  AiAnalysisMeta,
  FinalAnalysisResult,
  FinalAnalyzeRequest,
  InitialAnalysisResult,
  ReferencedKnowledgeItem,
  RealAiAnalysisContext,
  StructuredAiAnalysisResult,
} from "@/lib/analysis/types";
import {
  AI_ANALYSIS_SYSTEM_PROMPT,
  AI_PROMPT_VERSION,
  buildAiAnalysisUserPrompt,
} from "@/lib/analysis/ai-prompts";
import { buildKnowledgeContext } from "@/lib/knowledge";

function countLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function isPriority(value: unknown): value is AnalysisPriority {
  return value === "high" || value === "medium" || value === "low";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function normalizeArray(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

function normalizePriority(value: unknown, fallback: AnalysisPriority = "medium") {
  return isPriority(value) ? value : fallback;
}

function buildContentPreview(content: string) {
  return content.replace(/\s+/g, " ").slice(0, 300);
}

function logAiDebug(step: string, detail: string) {
  console.warn(`[analysis.ai] ${step}: ${detail}`);
}

function logKnowledgeHits(step: string, documents: { id: string; title: string; category: string }[]) {
  if (documents.length === 0) {
    logAiDebug(step, "No knowledge hit");
    return;
  }

  logAiDebug(
    step,
    documents
      .map((document) => `${document.id} | ${document.title} | ${document.category}`)
      .join(" ; "),
  );
}

function extractBalancedJsonObject(content: string) {
  const start = content.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  return null;
}

function collectJsonCandidates(content: string) {
  const trimmed = content.trim();
  const candidates: string[] = [];

  if (trimmed) {
    candidates.push(trimmed);
  }

  const codeBlockMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of codeBlockMatches) {
    if (match[1]?.trim()) {
      candidates.push(match[1].trim());
    }
  }

  const balancedObject = extractBalancedJsonObject(trimmed);
  if (balancedObject?.trim()) {
    candidates.push(balancedObject.trim());
  }

  return [...new Set(candidates)];
}

function normalizeStructuredAiAnalysisResult(value: unknown): {
  result: StructuredAiAnalysisResult | null;
  warning: string | null;
} {
  if (!isRecord(value)) {
    return {
      result: null,
      warning: "Top-level JSON is not an object",
    };
  }

  const warnings: string[] = [];
  const metricSummary = isRecord(value.metricSummary) ? value.metricSummary : {};
  const issueIdentification = isRecord(value.issueIdentification)
    ? value.issueIdentification
    : {};

  if (!isRecord(value.metricSummary)) {
    warnings.push("metricSummary missing, filled with defaults");
  }

  if (!isRecord(value.issueIdentification)) {
    warnings.push("issueIdentification missing, filled with defaults");
  }

  const result: StructuredAiAnalysisResult = {
    metricSummary: {
      overview: normalizeString(metricSummary.overview),
      keyMetrics: normalizeArray(metricSummary.keyMetrics)
        .filter(isRecord)
        .map((item) => ({
          label: normalizeString(item.label),
          value: normalizeString(item.value),
          note: normalizeString(item.note),
        })),
    },
    issueIdentification: {
      summary: normalizeString(issueIdentification.summary),
      severity: normalizePriority(issueIdentification.severity),
      affectedStep: normalizeNullableString(issueIdentification.affectedStep),
      evidence: normalizeArray(issueIdentification.evidence)
        .map((item) => normalizeString(item))
        .filter(Boolean),
    },
    problemBreakdown: normalizeArray(value.problemBreakdown)
      .filter(isRecord)
      .map((item) => ({
        title: normalizeString(item.title),
        detail: normalizeString(item.detail),
        supportingData: normalizeString(item.supportingData),
        missingData: normalizeNullableString(item.missingData),
      })),
    possibleCauses: normalizeArray(value.possibleCauses)
      .filter(isRecord)
      .map((item) => ({
        cause: normalizeString(item.cause),
        confidence: normalizePriority(item.confidence),
        rationale: normalizeString(item.rationale),
      })),
    optimizationSuggestions: normalizeArray(value.optimizationSuggestions)
      .filter(isRecord)
      .map((item) => ({
        title: normalizeString(item.title),
        action: normalizeString(item.action),
        expectedImpact: normalizeString(item.expectedImpact),
        priority: normalizePriority(item.priority),
      })),
  };

  if (!result.metricSummary.overview) {
    warnings.push("metricSummary.overview missing");
  }

  if (!result.issueIdentification.summary) {
    warnings.push("issueIdentification.summary missing");
  }

  if (
    !result.metricSummary.overview &&
    result.metricSummary.keyMetrics.length === 0 &&
    !result.issueIdentification.summary &&
    result.problemBreakdown.length === 0 &&
    result.possibleCauses.length === 0 &&
    result.optimizationSuggestions.length === 0
  ) {
    return {
      result: null,
      warning: "Normalized result is effectively empty",
    };
  }

  return {
    result,
    warning: warnings.length > 0 ? warnings.join("; ") : null,
  };
}

function parseStructuredAiAnalysisFromContent(content: string) {
  const candidates = collectJsonCandidates(content);

  if (candidates.length === 0) {
    return {
      result: null,
      warning: "No JSON candidate found in model output",
    };
  }

  let lastParseError: string | null = null;
  let lastSchemaWarning: string | null = null;

  for (const candidate of candidates) {
    try {
      const parsedJson = JSON.parse(candidate) as unknown;
      const normalized = normalizeStructuredAiAnalysisResult(parsedJson);

      if (normalized.result) {
        return normalized;
      }

      lastSchemaWarning = normalized.warning;
    } catch (error) {
      lastParseError =
        error instanceof Error ? error.message : "Unknown JSON parse error";
    }
  }

  return {
    result: null,
    warning: lastSchemaWarning ?? lastParseError ?? "Unknown parse failure",
  };
}

function buildMockAiAnalysis(
  context: RealAiAnalysisContext,
  stage: "initial" | "final",
): StructuredAiAnalysisResult {
  const { ruleAnalysisResult, supplementData } = context;
  const hasSegmentData = Boolean(supplementData.segmentData.trim());
  const hasDimensionData = Boolean(supplementData.dimensionData.trim());
  const isInitial = stage === "initial";

  return {
    metricSummary: {
      overview: ruleAnalysisResult.isAbnormal
        ? `${isInitial ? "第一次" : "第二次"}分析显示，${ruleAnalysisResult.abnormalStep} 是当前最值得优先关注的环节。`
        : `${isInitial ? "第一次" : "第二次"}分析显示，主漏斗未发现显著异常，分析重点转向维度切片和结构性问题。`,
      keyMetrics: [
        {
          label: "整体转化率",
          value: `${ruleAnalysisResult.overallRate?.toFixed(2) ?? "--"}%`,
          note: "直接引用规则层结果。",
        },
        {
          label: "异常环节",
          value: ruleAnalysisResult.abnormalStep ?? "未识别到明显异常",
          note: ruleAnalysisResult.abnormalReason ?? "当前规则层未触发异常判定。",
        },
        {
          label: "补充数据概况",
          value: `${hasSegmentData ? countLines(supplementData.segmentData) : 0} 行细分 / ${
            hasDimensionData ? countLines(supplementData.dimensionData) : 0
          } 行维度`,
          note: isInitial ? "初次分析通常尚无补充数据。" : "用于说明第二阶段上下文完整度。",
        },
      ],
    },
    issueIdentification: {
      summary: ruleAnalysisResult.isAbnormal
        ? `当前最值得优先排查的问题集中在 ${ruleAnalysisResult.abnormalStep}。`
        : "当前未看到主漏斗层面的显著异常，更像是结构性差异或细分场景问题。",
      severity: ruleAnalysisResult.isAbnormal ? "high" : "medium",
      affectedStep: ruleAnalysisResult.abnormalStep,
      evidence: [
        ruleAnalysisResult.abnormalReason ?? "规则层未识别显著异常。",
        hasSegmentData
          ? "已收到环节细分数据，可继续做子步骤定位。"
          : "暂未收到足够环节细分数据。",
        hasDimensionData
          ? "已收到维度数据，可继续做渠道/时间/用户分层判断。"
          : "暂未收到足够维度数据。",
      ],
    },
    problemBreakdown: [
      {
        title: ruleAnalysisResult.isAbnormal ? "核心异常环节拆解" : "结构性问题排查",
        detail: ruleAnalysisResult.isAbnormal
          ? "建议继续拆解该环节中的关键动作、校验节点和返回结果，确认流失集中发生点。"
          : "建议优先按渠道、时间、用户类型拆分观察，确认是否存在被总量掩盖的局部问题。",
        supportingData: hasSegmentData
          ? "已收到部分细分数据，可作为后续定位基础。"
          : "当前仅有主漏斗数据，缺少细分证据。",
        missingData: hasSegmentData
          ? null
          : "建议补充子步骤数据或关键按钮点击/校验失败数据。",
      },
      {
        title: "规则、体验、技术三类因素验证",
        detail: "建议并行验证业务规则是否过严、页面体验是否阻塞、接口或校验是否导致异常流失。",
        supportingData: hasDimensionData
          ? "已提供部分维度信息，可辅助判断问题是否集中在特定渠道或时段。"
          : "当前缺少维度切片，暂时无法判断问题是否具有结构性分布。",
        missingData: hasDimensionData
          ? null
          : "建议补充渠道、时间、用户分层数据。",
      },
    ],
    possibleCauses: ruleAnalysisResult.isAbnormal
      ? [
          {
            cause: "异常环节本身存在流程复杂或理解成本高的问题",
            confidence: "medium",
            rationale: "规则层已确认该环节显著弱于其他环节，但当前仍需补充更细粒度数据进一步验证。",
          },
          {
            cause: "业务校验或准入规则偏严，导致用户在该环节集中流失",
            confidence: "medium",
            rationale: "如果流失集中发生在认证或校验节点，通常需要结合失败原因分布继续确认。",
          },
        ]
      : [
          {
            cause: "主漏斗整体稳定，但特定渠道或客群存在被汇总数据掩盖的局部问题",
            confidence: "medium",
            rationale: "规则层未识别全局异常时，问题更可能出现在切片维度而非整体主流程。",
          },
          {
            cause: "不同时间段或投放渠道的流量质量差异造成转化波动",
            confidence: "medium",
            rationale: "需要通过补充维度数据继续验证是否存在结构性差异。",
          },
        ],
    optimizationSuggestions: ruleAnalysisResult.isAbnormal
      ? [
          {
            title: "优先拆解异常环节子步骤",
            action: `围绕 ${ruleAnalysisResult.abnormalStep} 增补字段级、按钮级和失败原因级数据埋点。`,
            expectedImpact: "帮助快速定位流失发生点，减少排查范围。",
            priority: "high",
          },
          {
            title: isInitial ? "补充细分数据后进入第二次分析" : "补充渠道与用户分层验证",
            action: isInitial
              ? "继续补充该环节的细分动作数据与维度切片，基于第一次分析结果做更深入的第二次分析。"
              : "按渠道、时间、客群切片复看异常环节，确认问题是否集中在特定人群。",
            expectedImpact: isInitial
              ? "让第二次分析从定性判断升级为更精细的原因拆解。"
              : "避免针对整体流程做无差别优化，提高决策准确性。",
            priority: "high",
          },
        ]
      : [
          {
            title: "继续补充维度切片",
            action: "优先补充时间、渠道、地域、用户类型等维度数据。",
            expectedImpact: "帮助识别主漏斗之外的结构性差异。",
            priority: "high",
          },
          {
            title: isInitial ? "带着第一次结论做补充分析" : "建立历史对比基线",
            action: isInitial
              ? "基于当前第一阶段结论，继续补充维度数据并进入第二次分析。"
              : "将当前结果与历史周期、不同来源流量、不同客群做横向比较。",
            expectedImpact: isInitial
              ? "让第二次分析更快聚焦真正的问题方向。"
              : "判断问题是短期波动还是长期模式。",
            priority: "medium",
          },
        ],
  };
}

async function attemptDashScopeAnalysis(
  context: RealAiAnalysisContext,
  options?: {
    stage?: "initial" | "final";
    initialAnalysisResult?: InitialAnalysisResult;
    knowledgeContext?: string;
  },
): Promise<StructuredAiAnalysisResult | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.DASHSCOPE_BASE_URL;
  const model = process.env.DASHSCOPE_MODEL;

  if (!apiKey || !baseURL || !model) {
    logAiDebug("dashscope-skip", "Missing DashScope configuration");
    return null;
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL,
    });

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: AI_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildAiAnalysisUserPrompt(context, options),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      logAiDebug("dashscope-empty", "Model response content is empty");
      return null;
    }

    logAiDebug("dashscope-preview", buildContentPreview(content));

    const parsed = parseStructuredAiAnalysisFromContent(content);

    if (!parsed.result) {
      logAiDebug(
        "dashscope-schema",
        parsed.warning ?? "Unknown schema normalization failure",
      );
      return null;
    }

    if (parsed.warning) {
      logAiDebug("dashscope-normalize", parsed.warning);
    }

    return parsed.result;
  } catch (error) {
    logAiDebug(
      "dashscope-error",
      error instanceof Error ? error.message : "Unknown provider error",
    );
    return null;
  }
}

async function generateStructuredAiAnalysis(
  context: RealAiAnalysisContext,
  options?: {
    stage?: "initial" | "final";
    initialAnalysisResult?: InitialAnalysisResult;
    knowledgeContext?: string;
  },
): Promise<{
  aiAnalysis: StructuredAiAnalysisResult;
  aiMeta: AiAnalysisMeta;
}> {
  const provider = process.env.AI_PROVIDER;
  const stage = options?.stage ?? "final";

  if (provider === "dashscope") {
    const result = await attemptDashScopeAnalysis(context, options);
    if (result) {
      return {
        aiAnalysis: result,
        aiMeta: {
          provider: "dashscope",
          model: process.env.DASHSCOPE_MODEL ?? "unknown",
          promptVersion: AI_PROMPT_VERSION,
          usedFallback: false,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    logAiDebug("fallback", `Falling back after DashScope ${stage} attempt`);
  }

  return {
    aiAnalysis: buildMockAiAnalysis(context, stage),
    aiMeta: {
      provider: provider === "disabled" ? "disabled" : "mock",
      model: provider === "disabled" ? "disabled" : "mock-structured-v1",
      promptVersion: AI_PROMPT_VERSION,
      usedFallback: true,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function buildInitialAnalysis(input: {
  scenario: RealAiAnalysisContext["scenario"];
  funnelData: RealAiAnalysisContext["funnelData"];
  ruleAnalysisResult: RealAiAnalysisContext["ruleAnalysisResult"];
}): Promise<InitialAnalysisResult> {
  const context: RealAiAnalysisContext = {
    scenario: input.scenario,
    funnelData: input.funnelData,
    ruleAnalysisResult: input.ruleAnalysisResult,
    supplementData: {
      segmentData: "",
      dimensionData: "",
    },
  };

  const { aiAnalysis, aiMeta } = await generateStructuredAiAnalysis(context, {
    stage: "initial",
  });

  return {
    stage: "initial",
    ...context,
    aiAnalysis,
    aiMeta,
  };
}

export async function buildFinalAnalysis(
  input: FinalAnalyzeRequest,
): Promise<FinalAnalysisResult> {
  const context: RealAiAnalysisContext = {
    scenario: input.scenario,
    funnelData: input.funnelData,
    ruleAnalysisResult: input.ruleAnalysisResult,
    supplementData: input.supplementData,
  };
  const { documents, knowledgeContext } = buildKnowledgeContext(context);

  logKnowledgeHits(
    "knowledge-hit",
    documents.map((document) => ({
      id: document.id,
      title: document.title,
      category: document.category,
    })),
  );

  const { aiAnalysis, aiMeta } = await generateStructuredAiAnalysis(context, {
    stage: "final",
    initialAnalysisResult: input.initialAnalysisResult,
    knowledgeContext,
  });
  const referencedKnowledge: ReferencedKnowledgeItem[] = documents.map((document) => ({
    id: document.id,
    title: document.title,
    category: document.category,
    content: document.content,
    stepKey: document.stepKey,
  }));

  return {
    stage: "final",
    ...context,
    initialAnalysisResult: input.initialAnalysisResult,
    referencedKnowledge,
    aiAnalysis,
    aiMeta,
  };
}
