export type PricingBasis = 'exact' | 'estimated' | 'unpriced';

export interface PricingEntry {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd?: number | undefined;
}

export interface PricedModelUsage {
  readonly model: string;
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd?: number | undefined;
  readonly basis: PricingBasis;
}

export interface PricingSummary {
  readonly models: readonly PricedModelUsage[];
  readonly coveragePercent: number;
  readonly unpricedModelCount: number;
  readonly costUsd: number;
}

interface ModelRate {
  readonly inputUsdPerToken: number;
  readonly outputUsdPerToken: number;
}

const safeTokens = (tokens: number): number => {
  return Number.isFinite(tokens) && tokens > 0 ? tokens : 0;
};

const safeCost = (costUsd: number | undefined): number | undefined => {
  return costUsd != null && Number.isFinite(costUsd) && costUsd >= 0 ? costUsd : undefined;
};

export const median = (values: readonly number[]): number | undefined => {
  const sorted = values.filter((value) => {
    return Number.isFinite(value) && value >= 0;
  }).sort((left, right) => {
    return left - right;
  });
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];

  if (upper == null) {
    return undefined;
  }

  if (sorted.length % 2 === 1) {
    return upper;
  }

  return sorted.slice(middle - 1, middle + 1).reduce((total, value) => {
    return total + value;
  }, 0) / 2;
};

const observedRate = (entries: readonly PricingEntry[]): ModelRate | undefined => {
  const samples = entries.flatMap((entry) => {
    const inputTokens = safeTokens(entry.inputTokens);
    const outputTokens = safeTokens(entry.outputTokens);
    const billedTokens = inputTokens + outputTokens;
    const costUsd = safeCost(entry.costUsd);

    return costUsd == null || billedTokens === 0 ? [] : [costUsd / billedTokens];
  });
  const rate = median(samples);

  return rate == null
    ? undefined
    : {
        inputUsdPerToken: rate,
        outputUsdPerToken: rate,
      };
};

const summarizeModel = (
  model: string,
  entries: readonly PricingEntry[],
): PricedModelUsage => {
  const rate = observedRate(entries);
  const inputTokens = entries.reduce((total, entry) => {
    return total + safeTokens(entry.inputTokens);
  }, 0);
  const outputTokens = entries.reduce((total, entry) => {
    return total + safeTokens(entry.outputTokens);
  }, 0);

  if (rate == null) {
    return {
      model,
      requests: entries.length,
      inputTokens,
      outputTokens,
      basis: 'unpriced',
    };
  }

  const estimated = entries.some((entry) => {
    return safeCost(entry.costUsd) == null
      && safeTokens(entry.inputTokens) + safeTokens(entry.outputTokens) > 0;
  });
  const costUsd = entries.reduce((total, entry) => {
    const entryInput = safeTokens(entry.inputTokens);
    const entryOutput = safeTokens(entry.outputTokens);
    const reportedCost = safeCost(entry.costUsd);

    if (reportedCost != null) {
      return total + reportedCost;
    }

    return total
      + entryInput * rate.inputUsdPerToken
      + entryOutput * rate.outputUsdPerToken;
  }, 0);

  return {
    model,
    requests: entries.length,
    inputTokens,
    outputTokens,
    costUsd,
    basis: estimated ? 'estimated' : 'exact',
  };
};

export const summarizePricing = (entries: readonly PricingEntry[]): PricingSummary => {
  const byModel = new Map<string, PricingEntry[]>();

  for (const entry of entries) {
    const modelEntries = byModel.get(entry.model) ?? [];

    modelEntries.push(entry);
    byModel.set(entry.model, modelEntries);
  }

  const models = [...byModel.entries()].map(([model, modelEntries]) => {
    return summarizeModel(model, modelEntries);
  }).sort((left, right) => {
    return (right.costUsd ?? -1) - (left.costUsd ?? -1)
      || right.inputTokens + right.outputTokens - left.inputTokens - left.outputTokens;
  });
  const billedTokens = models.reduce((total, model) => {
    return total + model.inputTokens + model.outputTokens;
  }, 0);
  const pricedTokens = models.reduce((total, model) => {
    return total + (model.basis === 'unpriced' ? 0 : model.inputTokens + model.outputTokens);
  }, 0);

  return {
    models,
    coveragePercent: billedTokens === 0 ? 0 : (pricedTokens / billedTokens) * 100,
    unpricedModelCount: models.filter((model) => {
      return model.basis === 'unpriced';
    }).length,
    costUsd: models.reduce((total, model) => {
      return total + (model.costUsd ?? 0);
    }, 0),
  };
};
