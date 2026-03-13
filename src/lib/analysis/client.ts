import type {
  AnalysisHistoryItem,
  AnalysisScenario,
  AnalyzeRuleRequest,
  AnalyzeRuleResponse,
  FinalAnalysisResult,
  FinalAnalyzeRequest,
  FinalAnalyzeResponse,
  FirstStageAnalysisResponse,
  FunnelInput,
  InitialAnalysisResult,
  RuleAnalysisResult,
  StoredAnalysisSession,
  SupplementData,
} from "@/lib/analysis/types";
import { DEFAULT_ANALYSIS_SCENARIO as DEFAULT_SCENARIO } from "@/lib/analysis/types";

const ANALYSIS_SESSION_KEY = "analysisSession";
const ANALYSIS_HISTORY_KEY = "analysisHistory";
const SUPPLEMENT_DATA_KEY = "supplementData";

function parseStoredJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeAnalysisSession(
  value: string | null,
): StoredAnalysisSession | null {
  const parsed = parseStoredJson<Record<string, unknown>>(value);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const funnelData = parsed.funnelData;
  const ruleAnalysisResult =
    parsed.ruleAnalysisResult ?? parsed.analysisResult ?? null;

  if (!funnelData || !ruleAnalysisResult) {
    return null;
  }

  const finalAnalysisResult =
    parsed.finalAnalysisResult &&
    typeof parsed.finalAnalysisResult === "object" &&
    "aiAnalysis" in parsed.finalAnalysisResult
      ? normalizeFinalAnalysisResult(parsed.finalAnalysisResult)
      : null;

  const initialAnalysisResult =
    parsed.initialAnalysisResult &&
    typeof parsed.initialAnalysisResult === "object" &&
    "aiAnalysis" in parsed.initialAnalysisResult
      ? (parsed.initialAnalysisResult as InitialAnalysisResult)
      : null;

  return {
    scenario:
      (parsed.scenario as AnalysisScenario | undefined) ?? DEFAULT_SCENARIO,
    funnelData: funnelData as FunnelInput,
    ruleAnalysisResult: ruleAnalysisResult as RuleAnalysisResult,
    nextAction:
      (parsed.nextAction as RuleAnalysisResult["nextAction"] | undefined) ??
      (ruleAnalysisResult as RuleAnalysisResult).nextAction,
    initialAnalysisResult,
    supplementData: (parsed.supplementData as SupplementData | null | undefined) ?? null,
    finalAnalysisResult,
  };
}

function normalizeFinalAnalysisResult(value: unknown): FinalAnalysisResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as FinalAnalysisResult & {
    referencedKnowledge?: FinalAnalysisResult["referencedKnowledge"];
  };

  return {
    ...candidate,
    referencedKnowledge: Array.isArray(candidate.referencedKnowledge)
      ? candidate.referencedKnowledge
      : [],
  };
}

function normalizeHistoryItem(value: unknown): AnalysisHistoryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AnalysisHistoryItem> & {
    date?: string;
  };

  if (
    typeof candidate.id !== "number" ||
    typeof candidate.scenario !== "string" ||
    typeof candidate.hasAnomaly !== "boolean" ||
    typeof candidate.resultGeneratedAt !== "string" ||
    !candidate.sessionSnapshot
  ) {
    return null;
  }

  return {
    id: candidate.id,
    savedAt:
      typeof candidate.savedAt === "string"
        ? candidate.savedAt
        : typeof candidate.date === "string"
          ? candidate.date
          : new Date().toISOString(),
    scenario: candidate.scenario,
    hasAnomaly: candidate.hasAnomaly,
    anomalyStep:
      typeof candidate.anomalyStep === "string" ? candidate.anomalyStep : undefined,
    resultGeneratedAt: candidate.resultGeneratedAt,
    sessionSnapshot: candidate.sessionSnapshot,
  };
}

function persistAnalysisSession(session: StoredAnalysisSession) {
  localStorage.setItem(ANALYSIS_SESSION_KEY, JSON.stringify(session));
}

export async function submitRuleAnalysis(
  scenario: AnalysisScenario,
  funnelData: FunnelInput,
) {
  const payload: AnalyzeRuleRequest = { scenario, funnelData };

  const response = await fetch("/api/analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as AnalyzeRuleResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      result.success ? "规则分析请求失败" : result.error.message,
    );
  }

  return result.data as FirstStageAnalysisResponse;
}

export async function submitFinalAnalysis(
  payload: FinalAnalyzeRequest,
) {
  const response = await fetch("/api/analysis/final", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as FinalAnalyzeResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      result.success ? "第二阶段分析请求失败" : result.error.message,
    );
  }

  return result.data;
}

export function saveAnalysisSession(
  scenario: AnalysisScenario,
  funnelData: FunnelInput,
  ruleAnalysisResult: RuleAnalysisResult,
  initialAnalysisResult: InitialAnalysisResult | null,
) {
  const session: StoredAnalysisSession = {
    scenario,
    funnelData,
    ruleAnalysisResult,
    nextAction: ruleAnalysisResult.nextAction,
    initialAnalysisResult,
    supplementData: null,
    finalAnalysisResult: null,
  };

  persistAnalysisSession(session);
  localStorage.removeItem(SUPPLEMENT_DATA_KEY);
}

export function getAnalysisSession() {
  return normalizeAnalysisSession(localStorage.getItem(ANALYSIS_SESSION_KEY));
}

export function clearAnalysisSession() {
  localStorage.removeItem(ANALYSIS_SESSION_KEY);
  localStorage.removeItem(SUPPLEMENT_DATA_KEY);
}

export function saveSupplementData(data: SupplementData) {
  localStorage.setItem(SUPPLEMENT_DATA_KEY, JSON.stringify(data));

  const session = getAnalysisSession();
  if (!session) {
    return;
  }

  const nextSession: StoredAnalysisSession = {
    ...session,
    supplementData: data,
  };

  persistAnalysisSession(nextSession);
}

export function getSupplementData() {
  return parseStoredJson<SupplementData>(
    localStorage.getItem(SUPPLEMENT_DATA_KEY),
  );
}

export function saveFinalAnalysisResult(
  finalAnalysisResult: FinalAnalysisResult,
) {
  const session = getAnalysisSession();
  if (!session) {
    return;
  }

  const nextSession: StoredAnalysisSession = {
    ...session,
    supplementData: finalAnalysisResult.supplementData,
    initialAnalysisResult: finalAnalysisResult.initialAnalysisResult,
    finalAnalysisResult,
  };

  persistAnalysisSession(nextSession);
}

export function setAnalysisSession(session: StoredAnalysisSession) {
  persistAnalysisSession(session);
}

export function getAnalysisHistory() {
  const rawHistory = parseStoredJson<unknown[]>(
    localStorage.getItem(ANALYSIS_HISTORY_KEY),
  );

  if (!Array.isArray(rawHistory)) {
    return [];
  }

  return rawHistory.map(normalizeHistoryItem).filter(Boolean) as AnalysisHistoryItem[];
}

export function saveCurrentAnalysisToHistory() {
  const session = getAnalysisSession();
  const finalAnalysisResult = session?.finalAnalysisResult;

  if (!session || !finalAnalysisResult) {
    return false;
  }

  const history = getAnalysisHistory();
  const resultGeneratedAt = finalAnalysisResult.aiMeta.generatedAt;

  const exists = history.some(
    (item) => item.resultGeneratedAt === resultGeneratedAt,
  );

  if (exists) {
    return true;
  }

  const nextHistory: AnalysisHistoryItem[] = [
    {
      id: Date.now(),
      savedAt: new Date().toISOString(),
      scenario: session.scenario.name,
      hasAnomaly: session.ruleAnalysisResult.isAbnormal,
      anomalyStep: session.ruleAnalysisResult.abnormalStep ?? undefined,
      resultGeneratedAt,
      sessionSnapshot: session,
    },
    ...history,
  ].slice(0, 20);

  localStorage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify(nextHistory));

  return true;
}

export function deleteAnalysisHistoryItem(id: number) {
  const nextHistory = getAnalysisHistory().filter((item) => item.id !== id);
  localStorage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function restoreAnalysisHistoryItem(id: number) {
  const target = getAnalysisHistory().find((item) => item.id === id);

  if (!target) {
    return false;
  }

  persistAnalysisSession(target.sessionSnapshot);
  localStorage.setItem(
    SUPPLEMENT_DATA_KEY,
    JSON.stringify(target.sessionSnapshot.supplementData ?? {
      segmentData: "",
      dimensionData: "",
    }),
  );

  return true;
}

export function isCurrentAnalysisSaved() {
  const finalAnalysisResult = getAnalysisSession()?.finalAnalysisResult;

  if (!finalAnalysisResult) {
    return false;
  }

  return getAnalysisHistory().some(
    (item) => item.resultGeneratedAt === finalAnalysisResult.aiMeta.generatedAt,
  );
}
