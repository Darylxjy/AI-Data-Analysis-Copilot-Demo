import type {
  InitialAnalysisResult,
  RealAiAnalysisContext,
} from "@/lib/analysis/types";

export const AI_PROMPT_VERSION = "v3-rag";

export const AI_ANALYSIS_SYSTEM_PROMPT = `
你是一名面向产品经理和业务分析师的资深数据分析顾问。

你的职责：
1. 读取已经计算好的规则层分析结果和补充数据。
2. 不重新计算规则层指标，不推翻规则层结论。
3. 不编造不存在的数据，不引用输入中没有出现的事实。
4. 重点输出：
   - 问题识别
   - 问题拆解
   - 可能原因
   - 优化建议
5. 分析风格要求简洁、专业、结论先行，使用产品经理可以直接复用的中文表达。
6. 输出内容必须可直接用于前端展示，避免空字段、空标题、空原因、空建议。

严格要求：
- 如果某项信息不足，请明确说明“需要补充数据”，不要猜测为既定事实。
- 对原因判断使用“可能”“倾向于”“建议验证”等表述，不要伪装成确定结论。
- 不要返回空字符串，除非该字段协议明确允许为 null。
- 不能因为信息不足就留空，应优先输出“需要补充数据”“当前证据不足，但建议验证……”这类可展示文本。
- problemBreakdown、possibleCauses、optimizationSuggestions 中的每一项都要尽量写完整句子。
- 不要输出“同上”“略”“待补充”“暂无”等低信息量词语作为完整结论。
- 不要输出 markdown，不要输出解释性前缀，不要输出 JSON 之外的任何文字。
- 输出必须是 JSON，对象顶层字段只能包含：
  metricSummary
  issueIdentification
  problemBreakdown
  possibleCauses
  optimizationSuggestions

字段完整度要求：
- metricSummary.overview 不能为空，必须是一句完整结论。
- issueIdentification.summary 不能为空，必须明确说明当前问题判断。
- problemBreakdown 至少输出 2 条，至少要保证 1 条内容完整；每条都要尽量包含非空的 title 和 detail。
- possibleCauses 至少输出 2 条完整原因，每条都要包含 cause 和 rationale。
- optimizationSuggestions 至少输出 2 条完整建议，每条都要包含 title、action、expectedImpact。
- 如果缺少证据，请在 detail、rationale、expectedImpact 中写明“需要补充数据后进一步验证”，而不是留空。
`.trim();

function buildCommonPromptSections(
  context: RealAiAnalysisContext,
  initialAnalysisResult?: InitialAnalysisResult,
) {
  const abnormalSummary = context.ruleAnalysisResult.isAbnormal
    ? `规则层已识别异常环节：${context.ruleAnalysisResult.abnormalStep ?? "未命名环节"}。异常依据：${context.ruleAnalysisResult.abnormalReason ?? "已触发异常判定，但原因描述缺失。"}`
    : `规则层未识别主漏斗明显异常。整体转化率：${context.ruleAnalysisResult.overallRate?.toFixed(2) ?? "--"}%。下一步动作为 ${context.ruleAnalysisResult.nextAction}。`;

  const supplementSummary = [
    context.supplementData.segmentData.trim()
      ? "已提供环节细分数据，可用于拆解子步骤问题。"
      : "未提供环节细分数据。",
    context.supplementData.dimensionData.trim()
      ? "已提供维度数据，可用于渠道、时间、用户分层分析。"
      : "未提供维度数据。",
  ].join(" ");

  const initialSummary = initialAnalysisResult
    ? `
第一阶段 AI 已有初步判断，请在其基础上叠加补充数据继续分析：
- 第一阶段指标摘要：${initialAnalysisResult.aiAnalysis.metricSummary.overview}
- 第一阶段问题判断：${initialAnalysisResult.aiAnalysis.issueIdentification.summary}
- 第二阶段目标不是推翻第一次结论，而是基于补充数据深化、修正或补充。
`.trim()
    : `
当前是第一次 AI 分析，补充数据为空或较少时，应基于主漏斗和规则层结果输出第一版可展示结论。
`.trim();

  return {
    abnormalSummary,
    supplementSummary,
    initialSummary,
  };
}

export function buildAiAnalysisUserPrompt(
  context: RealAiAnalysisContext,
  options?: {
    stage?: "initial" | "final";
    initialAnalysisResult?: InitialAnalysisResult;
    knowledgeContext?: string;
  },
) {
  const stage = options?.stage ?? "final";
  const { abnormalSummary, supplementSummary, initialSummary } =
    buildCommonPromptSections(context, options?.initialAnalysisResult);
  const knowledgeSection =
    stage === "final" && options?.knowledgeContext
      ? `
可参考的业务知识：
${options.knowledgeContext}
`.trim()
      : "";

  const stageGoal =
    stage === "initial"
      ? `当前分析目标：
- 这是第一次 AI 分析。
- 用户刚提交基础漏斗数据，补充数据尚未参与分析。
- 你需要基于第一阶段规则层结果，输出第一版产品分析结论，帮助用户理解当前主要问题与下一步需要补充什么数据。`
      : `当前分析目标：
- 这是第二次 AI 分析。
- 用户已经完成第一次分析，并补充了 supplementData。
- 你需要在第一次分析基础上叠加补充信息，输出更完整、更可执行的产品分析结论。`;

  return `
请基于以下上下文输出结构化分析结果。

${stageGoal}

通用要求：
1. 不重新计算规则层结果，直接引用已有 ruleAnalysisResult。
2. 不编造不存在的数据；所有数字和事实只能来自输入上下文。
3. supplementData 的作用是帮助你解释问题、拆解问题和提出建议，而不是生成新的虚构指标。
4. metricSummary 用于总结关键指标与当前分析重点，overview 不能为空。
5. issueIdentification 用于给出核心问题判断、影响环节、证据，summary 不能为空。
6. problemBreakdown 用于拆解需要继续排查的问题面，至少输出 2 条，且每条尽量包含完整的 title、detail、supportingData。
7. possibleCauses 用于列出至少 2 条完整原因，每条必须包含 cause、confidence、rationale。
8. optimizationSuggestions 用于给出至少 2 条完整建议，每条必须包含 title、action、expectedImpact、priority。
9. 如果证据不足，请直接写“需要补充数据后进一步验证”，不要留空。
10. 所有字段都要结构化，便于前端直接展示。

已知规则层结论：
- ${abnormalSummary}

supplementData 的使用提示：
- ${supplementSummary}

${knowledgeSection ? `${knowledgeSection}\n` : ""}

阶段说明：
${initialSummary}

输出质量要求：
- 所有字符串字段尽量填写完整中文句子。
- 不要输出空标题、空原因、空建议。
- 不要使用“暂无”“无”“-”作为主要内容。
- 如果没有足够证据，请给出保守但完整的表述，例如“当前更倾向于……，仍需补充数据验证”。
- 输出必须让产品经理看完就知道：当前问题是什么、为什么值得关注、下一步应该做什么。

上下文 JSON：
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`
`.trim();
}
