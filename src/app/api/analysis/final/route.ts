import { NextResponse } from "next/server";
import { buildFinalAnalysis } from "@/lib/analysis/final";
import {
  DEFAULT_ANALYSIS_SCENARIO,
  FUNNEL_FIELDS,
  type AnalysisScenario,
  type FinalAnalyzeErrorResponse,
  type FinalAnalyzeRequest,
  type FinalAnalyzeResponse,
  type FinalAnalyzeSuccessResponse,
  type FunnelField,
  type FunnelInput,
  type InitialAnalysisResult,
  type RuleAnalysisResult,
  type SupplementData,
} from "@/lib/analysis/types";

function parseNumberField(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseFunnelData(data: unknown): FunnelInput | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const parsed = {} as FunnelInput;

  for (const field of FUNNEL_FIELDS) {
    const value = parseNumberField((data as Record<string, unknown>)[field]);
    if (value === null || value < 0) {
      return null;
    }

    parsed[field as FunnelField] = value;
  }

  return parsed;
}

function isRuleAnalysisResult(data: unknown): data is RuleAnalysisResult {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as Partial<RuleAnalysisResult>;

  return (
    typeof candidate.status === "string" &&
    Array.isArray(candidate.funnelSteps) &&
    Array.isArray(candidate.conversionRates) &&
    typeof candidate.isAbnormal === "boolean" &&
    typeof candidate.nextAction === "string"
  );
}

function isInitialAnalysisResult(data: unknown): data is InitialAnalysisResult {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as Partial<InitialAnalysisResult>;

  return (
    candidate.stage === "initial" &&
    typeof candidate.aiMeta === "object" &&
    Boolean(candidate.aiMeta) &&
    typeof candidate.aiAnalysis === "object" &&
    Boolean(candidate.aiAnalysis) &&
    isRuleAnalysisResult(candidate.ruleAnalysisResult)
  );
}

function parseScenario(data: unknown): AnalysisScenario {
  if (!data || typeof data !== "object") {
    return DEFAULT_ANALYSIS_SCENARIO;
  }

  const candidate = data as Partial<AnalysisScenario>;

  return {
    id: typeof candidate.id === "string" ? candidate.id : DEFAULT_ANALYSIS_SCENARIO.id,
    name:
      typeof candidate.name === "string"
        ? candidate.name
        : DEFAULT_ANALYSIS_SCENARIO.name,
    industry:
      typeof candidate.industry === "string"
        ? candidate.industry
        : DEFAULT_ANALYSIS_SCENARIO.industry,
    goal:
      typeof candidate.goal === "string"
        ? candidate.goal
        : DEFAULT_ANALYSIS_SCENARIO.goal,
    description:
      typeof candidate.description === "string"
        ? candidate.description
        : DEFAULT_ANALYSIS_SCENARIO.description,
  };
}

function parseSupplementData(data: unknown): SupplementData | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const candidate = data as Partial<SupplementData>;

  return {
    segmentData:
      typeof candidate.segmentData === "string" ? candidate.segmentData : "",
    dimensionData:
      typeof candidate.dimensionData === "string" ? candidate.dimensionData : "",
  };
}

function parseFinalAnalyzeRequest(body: unknown): FinalAnalyzeRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const candidate = body as {
    scenario?: unknown;
    funnelData?: unknown;
    ruleAnalysisResult?: unknown;
    initialAnalysisResult?: unknown;
    supplementData?: unknown;
  };

  const scenario = parseScenario(candidate.scenario);
  const funnelData = parseFunnelData(candidate.funnelData);
  const supplementData = parseSupplementData(candidate.supplementData);

  if (
    !funnelData ||
    !supplementData ||
    !isRuleAnalysisResult(candidate.ruleAnalysisResult) ||
    !isInitialAnalysisResult(candidate.initialAnalysisResult)
  ) {
    return null;
  }

  return {
    scenario,
    funnelData,
    ruleAnalysisResult: candidate.ruleAnalysisResult,
    initialAnalysisResult: candidate.initialAnalysisResult,
    supplementData,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    const response: FinalAnalyzeErrorResponse = {
      success: false,
      error: {
        message: "请求体必须是合法的 JSON",
      },
    };

    return NextResponse.json<FinalAnalyzeResponse>(response, { status: 400 });
  }

  const finalAnalyzeRequest = parseFinalAnalyzeRequest(body);

  if (!finalAnalyzeRequest) {
    const response: FinalAnalyzeErrorResponse = {
      success: false,
      error: {
        message: "第二阶段分析请求缺失必要字段或字段格式不正确",
      },
    };

    return NextResponse.json<FinalAnalyzeResponse>(response, { status: 400 });
  }

  const result = await buildFinalAnalysis(finalAnalyzeRequest);
  const response: FinalAnalyzeSuccessResponse = {
    success: true,
    data: result,
  };

  return NextResponse.json<FinalAnalyzeResponse>(response);
}
