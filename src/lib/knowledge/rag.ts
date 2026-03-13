import type { RealAiAnalysisContext } from "@/lib/analysis/types";
import {
  retrieveKnowledgeFromAnalysisContext,
  type KnowledgeDocument,
} from "./retriever";

export interface KnowledgeContextPayload {
  documents: KnowledgeDocument[];
  knowledgeContext: string;
}

function formatKnowledgeDocument(document: KnowledgeDocument, index: number) {
  const stepLabel = document.stepKey ? `，关联环节：${document.stepKey}` : "";

  return [
    `[知识 ${index + 1}] ${document.title}`,
    `分类：${document.category}${stepLabel}`,
    `内容：${document.content}`,
  ].join("\n");
}

export function buildKnowledgeContext(
  context: Pick<RealAiAnalysisContext, "ruleAnalysisResult" | "supplementData">,
  limit = 3,
): KnowledgeContextPayload {
  const documents = retrieveKnowledgeFromAnalysisContext(context, limit);

  if (documents.length === 0) {
    return {
      documents: [],
      knowledgeContext: "暂无可用业务知识。",
    };
  }

  return {
    documents,
    knowledgeContext: documents
      .map((document, index) => formatKnowledgeDocument(document, index))
      .join("\n\n"),
  };
}
