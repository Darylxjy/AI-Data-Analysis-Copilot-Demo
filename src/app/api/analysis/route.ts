import { NextResponse } from "next/server";
import { buildInitialAnalysis } from "@/lib/analysis/final";
import { analyzeFunnelRules } from "@/lib/analysis/rules";
import {
  DEFAULT_ANALYSIS_SCENARIO,
  FUNNEL_FIELDS,
  type AnalysisScenario,
  type AnalyzeRuleErrorResponse,
  type AnalyzeRuleResponse,
  type AnalyzeRuleSuccessResponse,
  type FunnelField,
  type FunnelInput,
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

function parseFunnelData(body: unknown): FunnelInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const funnelData = (body as { funnelData?: Record<string, unknown> }).funnelData;
  if (!funnelData || typeof funnelData !== "object") {
    return null;
  }

  const parsed = {} as FunnelInput;

  for (const field of FUNNEL_FIELDS) {
    const value = parseNumberField(funnelData[field]);
    if (value === null || value < 0) {
      return null;
    }

    parsed[field as FunnelField] = value;
  }

  return parsed;
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

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    const response: AnalyzeRuleErrorResponse = {
      success: false,
      error: {
        message: "请求体必须是合法的 JSON",
      },
    };

    return NextResponse.json<AnalyzeRuleResponse>(response, { status: 400 });
  }

  const funnelData = parseFunnelData(body);
  if (!funnelData) {
    const response: AnalyzeRuleErrorResponse = {
      success: false,
      error: {
        message: "funnelData 缺失或字段格式不正确",
      },
    };

    return NextResponse.json<AnalyzeRuleResponse>(response, { status: 400 });
  }

  const scenario = parseScenario(
    body && typeof body === "object" ? (body as { scenario?: unknown }).scenario : undefined,
  );
  const ruleAnalysisResult = analyzeFunnelRules(funnelData);
  const initialAnalysisResult =
    ruleAnalysisResult.nextAction === "INSUFFICIENT_SAMPLE"
      ? null
      : await buildInitialAnalysis({
          scenario,
          funnelData,
          ruleAnalysisResult,
        });

  const response: AnalyzeRuleSuccessResponse = {
    success: true,
    data: {
      ruleAnalysisResult,
      initialAnalysisResult,
    },
  };

  return NextResponse.json<AnalyzeRuleResponse>(response);
}
