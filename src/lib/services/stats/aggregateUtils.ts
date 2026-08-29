import { LruCache } from '@utils/lruCacheUtils';

import type {
  HistoryEntry,
  SessionSummary,
  TokenUsage,
} from '../history/types';
import type { PricingEntry } from './pricingUtils';

export interface ToolUsage {
  readonly tool: string;
  readonly count: number;
}

export interface DayActivity {
  readonly date: string;
  readonly messages: number;
  readonly tokens: number;
}

export interface SessionTokenTotals {
  readonly filePath: string;
  readonly sessionId: string;
  readonly title?: string | undefined;
  readonly tokens: number;
  readonly messages: number;
  readonly lastTimestampMs: number;
}

interface DayCount {
  messages: number;
  tokens: number;
}

/**
 * Everything one transcript contributes to a report, folded down to counters.
 * Two things depend on this staying small: it is held for every session at
 * once, and it is what lets a re-run skip transcripts that have not changed.
 */
export interface SessionAggregate {
  readonly usageRecorded: boolean;
  readonly messages: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly conversationTokens: number;
  readonly nonConversationTokens: number;
  readonly billingTokens: number;
  readonly splitUnavailable: boolean;
  readonly durationMs: number;
  readonly pricing: readonly PricingEntry[];
  readonly tools: Readonly<Record<string, number>>;
  readonly days: Readonly<Record<string, DayCount>>;
  // Turns per local hour of day, and per weekday with Monday first.
  readonly hours: Readonly<Record<string, number>>;
  readonly weekdays: Readonly<Record<string, number>>;
  // Only what the person typed themselves, so tool output does not read as effort.
  readonly userMessages: number;
  readonly userChars: number;
}

export interface Accumulator {
  usageRecorded: boolean;
  sessions: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  conversationTokens: number;
  nonConversationTokens: number;
  billingTokens: number;
  splitUnavailable: boolean;
  durationMs: number;
  pricingEntries: PricingEntry[];
  tools: Map<string, number>;
  days: Map<string, DayActivity>;
  perSession: SessionTokenTotals[];
  hours: Map<number, number>;
  weekdays: Map<number, number>;
  userMessages: number;
  userChars: number;
}

interface Draft {
  usageRecorded: boolean;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  conversationTokens: number;
  nonConversationTokens: number;
  billingTokens: number;
  splitUnavailable: boolean;
  durationMs: number;
}

interface CachedAggregate {
  readonly fingerprint: string;
  readonly aggregate: SessionAggregate;
}

export const HOURS_IN_DAY = 24;
export const DAYS_IN_WEEK = 7;

const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
};

const totalTokens = (usage: TokenUsage): number => {
  return usage.inputTokens + usage.outputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
};

export const createAccumulator = (): Accumulator => {
  return {
    usageRecorded: false,
    sessions: 0,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    conversationTokens: 0,
    nonConversationTokens: 0,
    billingTokens: 0,
    splitUnavailable: false,
    durationMs: 0,
    pricingEntries: [],
    tools: new Map(),
    days: new Map(),
    perSession: [],
    hours: new Map(),
    weekdays: new Map(),
    userMessages: 0,
    userChars: 0,
  };
};

const createDraft = (): Draft => {
  return {
    usageRecorded: false,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    conversationTokens: 0,
    nonConversationTokens: 0,
    billingTokens: 0,
    splitUnavailable: false,
    durationMs: 0,
  };
};

const addAssistant = (
  draft: Draft,
  entry: Extract<HistoryEntry, { kind: 'assistant' }>,
  splitAvailable: boolean,
  pricing: PricingEntry[],
  tools: Record<string, number>,
): void => {
  const usage = entry.usage ?? EMPTY_USAGE;
  const conversationTokens = usage.inputTokens + usage.outputTokens;
  const nonConversationTokens = usage.cacheCreationTokens + usage.cacheReadTokens;
  const billingTokens = conversationTokens + nonConversationTokens;

  draft.messages += 1;
  draft.usageRecorded ||= entry.usage != null || entry.costUsd != null || entry.durationMs != null;
  draft.inputTokens += usage.inputTokens;
  draft.outputTokens += usage.outputTokens;
  draft.cacheCreationTokens += usage.cacheCreationTokens;
  draft.cacheReadTokens += usage.cacheReadTokens;
  draft.conversationTokens += splitAvailable ? conversationTokens : billingTokens;
  draft.nonConversationTokens += splitAvailable ? nonConversationTokens : 0;
  draft.billingTokens += billingTokens;
  draft.splitUnavailable ||= !splitAvailable && entry.usage != null;
  draft.durationMs += entry.durationMs ?? 0;
  pricing.push({
    model: entry.model ?? 'unknown',
    inputTokens: usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens,
    outputTokens: usage.outputTokens,
    costUsd: entry.costUsd,
  });

  for (const block of entry.blocks) {
    if (block.blockType === 'tool-use') {
      tools[block.call.name] = (tools[block.call.name] ?? 0) + 1;
    }
  }
};

const addDay = (days: Record<string, DayCount>, day: string, tokens: number): void => {
  const existing = days[day] ?? {
    messages: 0,
    tokens: 0,
  };

  days[day] = {
    messages: existing.messages + 1,
    tokens: existing.tokens + tokens,
  };
};

// Buckets follow the reader's own clock, since the question they answer is
// when this person works, not when a server recorded it.
const bump = (counts: Record<string, number>, slot: number): void => {
  counts[slot] = (counts[slot] ?? 0) + 1;
};

const addClock = (
  hours: Record<string, number>,
  weekdays: Record<string, number>,
  timestamp: string,
): void => {
  const when = new Date(timestamp);

  if (Number.isNaN(when.getTime())) {
    return;
  }

  bump(hours, when.getHours());
  bump(weekdays, (when.getDay() + 6) % DAYS_IN_WEEK);
};

export const aggregateSession = (
  entries: readonly HistoryEntry[],
  splitAvailable: boolean,
): SessionAggregate => {
  const draft = createDraft();
  const pricing: PricingEntry[] = [];
  const tools: Record<string, number> = {};
  const days: Record<string, DayCount> = {};
  const hours: Record<string, number> = {};
  const weekdays: Record<string, number> = {};
  let userMessages = 0;
  let userChars = 0;

  for (const entry of entries) {
    if (entry.kind !== 'user' && entry.kind !== 'assistant') {
      continue;
    }

    const tokens = entry.kind === 'assistant' ? totalTokens(entry.usage ?? EMPTY_USAGE) : 0;
    const day = entry.timestamp.slice(0, 10);

    if (entry.kind === 'assistant') {
      addAssistant(draft, entry, splitAvailable, pricing, tools);
    }

    if (entry.kind === 'user' && !entry.meta) {
      userMessages += 1;
      userChars += entry.text.length;
    }

    addClock(hours, weekdays, entry.timestamp);

    if (day.length === 10) {
      addDay(days, day, tokens);
    }
  }

  return {
    ...draft,
    pricing,
    tools,
    days,
    hours,
    weekdays,
    userMessages,
    userChars,
  };
};

export const foldAggregate = (
  accumulator: Accumulator,
  aggregate: SessionAggregate,
  session: SessionSummary,
): void => {
  accumulator.usageRecorded ||= aggregate.usageRecorded;
  accumulator.sessions += 1;
  accumulator.messages += aggregate.messages;
  accumulator.inputTokens += aggregate.inputTokens;
  accumulator.outputTokens += aggregate.outputTokens;
  accumulator.cacheCreationTokens += aggregate.cacheCreationTokens;
  accumulator.cacheReadTokens += aggregate.cacheReadTokens;
  accumulator.conversationTokens += aggregate.conversationTokens;
  accumulator.nonConversationTokens += aggregate.nonConversationTokens;
  accumulator.billingTokens += aggregate.billingTokens;
  accumulator.splitUnavailable ||= aggregate.splitUnavailable;
  accumulator.durationMs += aggregate.durationMs;
  accumulator.pricingEntries.push(...aggregate.pricing);
  accumulator.userMessages += aggregate.userMessages;
  accumulator.userChars += aggregate.userChars;

  for (const [slot, count] of Object.entries(aggregate.hours)) {
    accumulator.hours.set(Number(slot), (accumulator.hours.get(Number(slot)) ?? 0) + count);
  }

  for (const [slot, count] of Object.entries(aggregate.weekdays)) {
    accumulator.weekdays.set(Number(slot), (accumulator.weekdays.get(Number(slot)) ?? 0) + count);
  }

  for (const [tool, count] of Object.entries(aggregate.tools)) {
    accumulator.tools.set(tool, (accumulator.tools.get(tool) ?? 0) + count);
  }

  for (const [date, day] of Object.entries(aggregate.days)) {
    const existing = accumulator.days.get(date) ?? {
      date,
      messages: 0,
      tokens: 0,
    };

    accumulator.days.set(date, {
      date,
      messages: existing.messages + day.messages,
      tokens: existing.tokens + day.tokens,
    });
  }

  accumulator.perSession.push({
    filePath: session.filePath,
    sessionId: session.id,
    title: session.title ?? session.summary ?? session.preview,
    tokens: aggregate.billingTokens,
    messages: aggregate.messages,
    lastTimestampMs: session.lastTimestampMs,
  });
};

// Aggregates are counters rather than transcripts, so a generous cap still
// costs far less memory than one page of parsed entries.
const aggregates = new LruCache<CachedAggregate>(4096);

// A transcript that has neither grown nor been touched cannot have new counters,
// and every format reports both from its listing without re-reading the file.
const fingerprintOf = (session: SessionSummary): string => {
  return [session.modifiedMs, session.sizeBytes, session.messageCount].join(':');
};

export const cachedAggregate = async (
  session: SessionSummary,
  compute: () => Promise<SessionAggregate>,
): Promise<SessionAggregate> => {
  const fingerprint = fingerprintOf(session);
  const cached = aggregates.get(session.filePath);

  if (cached?.fingerprint === fingerprint) {
    return cached.aggregate;
  }

  const aggregate = await compute();

  aggregates.set(session.filePath, {
    fingerprint,
    aggregate,
  });

  return aggregate;
};
