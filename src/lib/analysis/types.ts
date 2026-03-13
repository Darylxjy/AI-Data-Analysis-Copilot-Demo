export const MINIMUM_SAMPLE_SIZE = 100;

export const FUNNEL_FIELDS = [
  "clickLoan",
  "fillInfo",
  "clickNext",
  "idVerified",
  "faceVerified",
  "resultDistributed",
] as const;

export type FunnelField = (typeof FUNNEL_FIELDS)[number];

export const FUNNEL_FIELD_LABELS: Record<FunnelField, string> = {
  clickLoan: "点击借款",
  fillInfo: "填写信息",
  clickNext: "点击下一步",
  idVerified: "身份证验证",
  faceVerified: "人脸识别",
  resultDistributed: "分发结果",
};

export const CONVERSION_STEP_DEFINITIONS = [
  {
    stepKey: "click-loan_to_fill-info",
    label: "点击借款 -> 填写信息",
    fromField: "clickLoan",
    toField: "fillInfo",
    threshold: 68,
  },
  {
    stepKey: "fill-info_to_click-next",
    label: "填写信息 -> 点击下一步",
    fromField: "fillInfo",
    toField: "clickNext",
    threshold: 75,
  },
  {
    stepKey: "click-next_to_id-verified",
    label: "点击下一步 -> 身份证验证",
    fromField: "clickNext",
    toField: "idVerified",
    threshold: 80,
  },
  {
    stepKey: "id-verified_to_face-verified",
    label: "身份证验证 -> 人脸识别",
    fromField: "idVerified",
    toField: "faceVerified",
    threshold: 72,
  },
  {
    stepKey: "face-verified_to_result-distributed",
    label: "人脸识别 -> 分发结果",
    fromField: "faceVerified",
    toField: "resultDistributed",
    threshold: 78,
  },
] as const satisfies readonly {
  stepKey: string;
  label: string;
  fromField: FunnelField;
  toField: FunnelField;
  threshold: number;
}[];

export type ConversionStepKey = (typeof CONVERSION_STEP_DEFINITIONS)[number]["stepKey"];

export type AnalysisStatus = "ready" | "insufficient_sample";

export type NextAction =
  | "ABNORMAL_SUPPLEMENT"
  | "DIMENSION_SUPPLEMENT"
  | "INSUFFICIENT_SAMPLE";

export type AnalysisPriority = "high" | "medium" | "low";

export type AiProvider = "mock" | "openai" | "dashscope" | "disabled";

export interface FunnelInput {
  clickLoan: number;
  fillInfo: number;
  clickNext: number;
  idVerified: number;
  faceVerified: number;
  resultDistributed: number;
}

export interface FunnelStepMetric {
  field: FunnelField;
  label: string;
  value: number;
  rateFromEntry: number;
}

export interface ConversionRateMetric {
  stepKey: ConversionStepKey;
  stepLabel: string;
  fromField: FunnelField;
  toField: FunnelField;
  fromValue: number;
  toValue: number;
  rate: number;
  threshold: number;
  gapVsAverage: number;
  belowThreshold: boolean;
  belowAverage: boolean;
  isAbnormal: boolean;
}

export interface RuleAnalysisResult {
  status: AnalysisStatus;
  minimumSampleSize: number;
  sampleSizeMessage: string | null;
  funnelSteps: FunnelStepMetric[];
  conversionRates: ConversionRateMetric[];
  overallRate: number | null;
  isAbnormal: boolean;
  abnormalStep: string | null;
  abnormalReason: string | null;
  nextAction: NextAction;
}

export interface SupplementData {
  segmentData: string;
  dimensionData: string;
}

export interface AnalysisScenario {
  id: string;
  name: string;
  industry: string;
  goal: string;
  description: string;
}

export const DEFAULT_ANALYSIS_SCENARIO: AnalysisScenario = {
  id: "credit-funnel-demo",
  name: "信贷业务漏斗",
  industry: "消费信贷",
  goal: "识别关键流失环节并输出可执行优化建议",
  description:
    "围绕信贷申请主漏斗，结合规则层结果与补充数据进行二阶段分析。",
};

export interface RealAiAnalysisContext {
  scenario: AnalysisScenario;
  funnelData: FunnelInput;
  ruleAnalysisResult: RuleAnalysisResult;
  supplementData: SupplementData;
}

export interface AiMetricSummaryItem {
  label: string;
  value: string;
  note: string;
}

export interface AiMetricSummary {
  overview: string;
  keyMetrics: AiMetricSummaryItem[];
}

export interface AiIssueIdentification {
  summary: string;
  severity: AnalysisPriority;
  affectedStep: string | null;
  evidence: string[];
}

export interface AiProblemBreakdownItem {
  title: string;
  detail: string;
  supportingData: string;
  missingData: string | null;
}

export interface AiPossibleCauseItem {
  cause: string;
  confidence: AnalysisPriority;
  rationale: string;
}

export interface AiOptimizationSuggestionItem {
  title: string;
  action: string;
  expectedImpact: string;
  priority: AnalysisPriority;
}

export interface StructuredAiAnalysisResult {
  metricSummary: AiMetricSummary;
  issueIdentification: AiIssueIdentification;
  problemBreakdown: AiProblemBreakdownItem[];
  possibleCauses: AiPossibleCauseItem[];
  optimizationSuggestions: AiOptimizationSuggestionItem[];
}

export interface AiAnalysisMeta {
  provider: AiProvider;
  model: string;
  promptVersion: string;
  usedFallback: boolean;
  generatedAt: string;
}

export interface ReferencedKnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  stepKey?: string;
}

export interface BaseAiAnalysisResult extends RealAiAnalysisContext {
  stage: "initial" | "final";
  aiAnalysis: StructuredAiAnalysisResult;
  aiMeta: AiAnalysisMeta;
}

export interface InitialAnalysisResult extends BaseAiAnalysisResult {
  stage: "initial";
}

export interface FinalAnalysisResult extends BaseAiAnalysisResult {
  stage: "final";
  initialAnalysisResult: InitialAnalysisResult;
  referencedKnowledge: ReferencedKnowledgeItem[];
}

export interface StoredAnalysisSession {
  scenario: AnalysisScenario;
  funnelData: FunnelInput;
  ruleAnalysisResult: RuleAnalysisResult;
  nextAction: NextAction;
  initialAnalysisResult: InitialAnalysisResult | null;
  supplementData: SupplementData | null;
  finalAnalysisResult: FinalAnalysisResult | null;
}

export interface AnalysisHistoryItem {
  id: number;
  savedAt: string;
  scenario: string;
  hasAnomaly: boolean;
  anomalyStep?: string;
  resultGeneratedAt: string;
  sessionSnapshot: StoredAnalysisSession;
}

export interface AnalyzeRuleRequest {
  scenario?: AnalysisScenario;
  funnelData: FunnelInput;
}

export interface FirstStageAnalysisResponse {
  ruleAnalysisResult: RuleAnalysisResult;
  initialAnalysisResult: InitialAnalysisResult | null;
}

export interface AnalyzeRuleSuccessResponse {
  success: true;
  data: FirstStageAnalysisResponse;
}

export interface AnalyzeRuleErrorResponse {
  success: false;
  error: {
    message: string;
  };
}

export type AnalyzeRuleResponse =
  | AnalyzeRuleSuccessResponse
  | AnalyzeRuleErrorResponse;

export interface FinalAnalyzeRequest {
  scenario: AnalysisScenario;
  funnelData: FunnelInput;
  ruleAnalysisResult: RuleAnalysisResult;
  initialAnalysisResult: InitialAnalysisResult;
  supplementData: SupplementData;
}

export interface FinalAnalyzeSuccessResponse {
  success: true;
  data: FinalAnalysisResult;
}

export interface FinalAnalyzeErrorResponse {
  success: false;
  error: {
    message: string;
  };
}

export type FinalAnalyzeResponse =
  | FinalAnalyzeSuccessResponse
  | FinalAnalyzeErrorResponse;
