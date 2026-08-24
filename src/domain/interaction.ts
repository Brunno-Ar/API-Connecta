export type SelectionValue = string | number | boolean | null;
export type Selections = Record<string, SelectionValue>;

export interface InteractionInput {
  eventId?: string | undefined;
  contactId: string;
  botId: string;
  selections: Selections;
}

export interface InteractionRecord {
  id: string;
  externalEventId: string | null;
  contactId: string;
  botId: string;
  rawPayload: unknown;
  receivedAt: Date;
  createdAt: Date;
  selections: Array<{ key: string; value: SelectionValue }>;
}

export interface InteractionFilters {
  botId?: string | undefined;
  contactId?: string | undefined;
  selectionKey?: string | undefined;
  selectionValue?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface MetricsSummary {
  totalInteractions: number;
  totalSelections: number;
  uniqueContacts: number;
}

export interface SelectionMetric {
  key: string;
  value: SelectionValue;
  selectionCount: number;
  uniqueContacts: number;
}

export interface BotMetric extends MetricsSummary {
  botId: string;
}
