import {
  CONVERSION_STEP_DEFINITIONS,
  FUNNEL_FIELDS,
  FUNNEL_FIELD_LABELS,
  MINIMUM_SAMPLE_SIZE,
  type ConversionRateMetric,
  type FunnelInput,
  type FunnelStepMetric,
  type RuleAnalysisResult,
} from "@/lib/analysis/types";

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function calculateRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return roundToTwo((numerator / denominator) * 100);
}

function buildFunnelSteps(funnelData: FunnelInput): FunnelStepMetric[] {
  const entryCount = funnelData.clickLoan;

  return FUNNEL_FIELDS.map((field) => ({
    field,
    label: FUNNEL_FIELD_LABELS[field],
    value: funnelData[field],
    rateFromEntry: field === "clickLoan" ? 100 : calculateRate(funnelData[field], entryCount),
  }));
}

function buildConversionRates(funnelData: FunnelInput): ConversionRateMetric[] {
  const rawRates = CONVERSION_STEP_DEFINITIONS.map((definition) => ({
    definition,
    rate: calculateRate(
      funnelData[definition.toField],
      funnelData[definition.fromField],
    ),
  }));

  const averageRate =
    rawRates.reduce((sum, item) => sum + item.rate, 0) / rawRates.length;

  return rawRates.map(({ definition, rate }) => {
    const gapVsAverage = roundToTwo(averageRate - rate);
    const belowThreshold = rate < definition.threshold;
    const belowAverage = gapVsAverage > 10;

    return {
      stepKey: definition.stepKey,
      stepLabel: definition.label,
      fromField: definition.fromField,
      toField: definition.toField,
      fromValue: funnelData[definition.fromField],
      toValue: funnelData[definition.toField],
      rate,
      threshold: definition.threshold,
      gapVsAverage,
      belowThreshold,
      belowAverage,
      isAbnormal: belowThreshold || belowAverage,
    };
  });
}

export function analyzeFunnelRules(funnelData: FunnelInput): RuleAnalysisResult {
  const funnelSteps = buildFunnelSteps(funnelData);

  if (funnelData.clickLoan < MINIMUM_SAMPLE_SIZE) {
    return {
      status: "insufficient_sample",
      minimumSampleSize: MINIMUM_SAMPLE_SIZE,
      sampleSizeMessage: `样本量不足：点击借款人数需大于等于 ${MINIMUM_SAMPLE_SIZE}`,
      funnelSteps,
      conversionRates: [],
      overallRate: null,
      isAbnormal: false,
      abnormalStep: null,
      abnormalReason: "样本量不足，暂不进行异常判断",
      nextAction: "INSUFFICIENT_SAMPLE",
    };
  }

  const conversionRates = buildConversionRates(funnelData);
  const overallRate = calculateRate(
    funnelData.resultDistributed,
    funnelData.clickLoan,
  );

  const lowestRateStep = conversionRates.reduce((lowest, current) =>
    current.rate < lowest.rate ? current : lowest,
  );

  const isAbnormal = lowestRateStep.belowThreshold || lowestRateStep.belowAverage;

  const abnormalReason = !isAbnormal
    ? null
    : [
        lowestRateStep.belowThreshold
          ? `${lowestRateStep.stepLabel}转化率 ${lowestRateStep.rate}% 低于经验阈值 ${lowestRateStep.threshold}%`
          : null,
        lowestRateStep.belowAverage
          ? `${lowestRateStep.stepLabel}较其他环节平均转化率低 ${lowestRateStep.gapVsAverage}%`
          : null,
      ]
        .filter(Boolean)
        .join("；");

  return {
    status: "ready",
    minimumSampleSize: MINIMUM_SAMPLE_SIZE,
    sampleSizeMessage: null,
    funnelSteps,
    conversionRates,
    overallRate,
    isAbnormal,
    abnormalStep: isAbnormal ? lowestRateStep.stepLabel : null,
    abnormalReason,
    nextAction: isAbnormal ? "ABNORMAL_SUPPLEMENT" : "DIMENSION_SUPPLEMENT",
  };
}
