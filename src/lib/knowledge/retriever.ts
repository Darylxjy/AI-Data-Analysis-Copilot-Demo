import type {
  NextAction,
  RealAiAnalysisContext,
  SupplementData,
} from "@/lib/analysis/types";
import rawDocuments from "./documents.json";

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: "漏斗环节解释" | "常见异常原因" | "常见优化建议";
  stepKey?: string;
  content: string;
}

export interface KnowledgeRetrieveInput {
  abnormalStep: string | null;
  nextAction: NextAction;
  supplementData: SupplementData;
}

const KNOWLEDGE_DOCUMENTS = rawDocuments as KnowledgeDocument[];

const STEP_KEYWORDS: Record<string, string[]> = {
  "click-loan_to_fill-info": [
    "点击借款 -> 填写信息",
    "点击借款",
    "填写信息",
    "首屏",
    "落地页",
    "按钮",
    "启动",
  ],
  "fill-info_to_click-next": [
    "填写信息 -> 点击下一步",
    "填写信息",
    "点击下一步",
    "表单",
    "字段",
    "授权",
    "隐私",
  ],
  "click-next_to_id-verified": [
    "点击下一步 -> 身份证验证",
    "身份证验证",
    "二要素",
    "ocr",
    "证件",
  ],
  "id-verified_to_face-verified": [
    "身份证验证 -> 人脸识别",
    "人脸识别",
    "活体",
    "相机",
    "权限",
    "光线",
  ],
  "face-verified_to_result-distributed": [
    "人脸识别 -> 分发结果",
    "分发结果",
    "资方",
    "路由",
    "结果回传",
    "风控",
  ],
};

const DIMENSION_KEYWORDS = [
  "渠道",
  "h5",
  "微信",
  "app",
  "投放",
  "来源",
  "工作日",
  "周末",
  "时间",
  "时段",
  "新客",
  "老客",
  "用户",
  "客群",
  "地域",
  "设备",
  "机型",
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function toSearchText(input: KnowledgeRetrieveInput) {
  return normalizeText(
    [input.abnormalStep ?? "", input.supplementData.segmentData, input.supplementData.dimensionData]
      .filter(Boolean)
      .join("\n"),
  );
}

function resolveMatchedStepKeys(searchText: string, abnormalStep: string | null) {
  const matched = new Set<string>();
  const combinedText = normalizeText([abnormalStep ?? "", searchText].join("\n"));

  for (const [stepKey, keywords] of Object.entries(STEP_KEYWORDS)) {
    if (keywords.some((keyword) => combinedText.includes(normalizeText(keyword)))) {
      matched.add(stepKey);
    }
  }

  return matched;
}

function resolveMatchedDimensionKeywords(searchText: string) {
  return DIMENSION_KEYWORDS.filter((keyword) =>
    searchText.includes(normalizeText(keyword)),
  );
}

function getCategoryBonus(category: KnowledgeDocument["category"], nextAction: NextAction) {
  if (nextAction === "ABNORMAL_SUPPLEMENT") {
    if (category === "常见异常原因") {
      return 4;
    }

    if (category === "常见优化建议") {
      return 3;
    }

    return 2;
  }

  if (nextAction === "DIMENSION_SUPPLEMENT") {
    if (category === "常见异常原因") {
      return 3;
    }

    if (category === "常见优化建议") {
      return 4;
    }

    return 2;
  }

  return 1;
}

function scoreDocument(
  document: KnowledgeDocument,
  input: KnowledgeRetrieveInput,
  searchText: string,
  matchedStepKeys: Set<string>,
  matchedDimensionKeywords: string[],
) {
  let score = getCategoryBonus(document.category, input.nextAction);
  const docText = normalizeText(`${document.title} ${document.content}`);

  if (document.stepKey && matchedStepKeys.has(document.stepKey)) {
    score += 8;
  }

  if (!document.stepKey && input.nextAction === "DIMENSION_SUPPLEMENT") {
    score += 2;
  }

  if (!document.stepKey && matchedDimensionKeywords.length > 0) {
    score += 2;
  }

  for (const keyword of matchedDimensionKeywords) {
    if (docText.includes(normalizeText(keyword))) {
      score += 2;
    }
  }

  for (const [stepKey, keywords] of Object.entries(STEP_KEYWORDS)) {
    if (document.stepKey !== stepKey) {
      continue;
    }

    for (const keyword of keywords) {
      if (searchText.includes(normalizeText(keyword))) {
        score += 1;
      }
    }
  }

  if (input.nextAction === "ABNORMAL_SUPPLEMENT" && document.stepKey) {
    score += 1;
  }

  return score;
}

export function retrieveRelevantKnowledge(
  input: KnowledgeRetrieveInput,
  limit = 3,
) {
  const searchText = toSearchText(input);
  const matchedStepKeys = resolveMatchedStepKeys(searchText, input.abnormalStep);
  const matchedDimensionKeywords = resolveMatchedDimensionKeywords(searchText);

  const rankedDocuments = KNOWLEDGE_DOCUMENTS.map((document) => ({
    document,
    score: scoreDocument(
      document,
      input,
      searchText,
      matchedStepKeys,
      matchedDimensionKeywords,
    ),
  }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.document.id.localeCompare(right.document.id);
    })
    .slice(0, limit);

  return rankedDocuments.map((item) => item.document);
}

export function retrieveKnowledgeFromAnalysisContext(
  context: Pick<RealAiAnalysisContext, "ruleAnalysisResult" | "supplementData">,
  limit = 3,
) {
  return retrieveRelevantKnowledge(
    {
      abnormalStep: context.ruleAnalysisResult.abnormalStep,
      nextAction: context.ruleAnalysisResult.nextAction,
      supplementData: context.supplementData,
    },
    limit,
  );
}
