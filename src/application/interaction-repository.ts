import type {
  BotMetric,
  InteractionFilters,
  InteractionInput,
  InteractionRecord,
  MetricsSummary,
  Pagination,
  SelectionMetric,
} from '../domain/interaction.js';

export interface InteractionRepository {
  create(input: InteractionInput, rawPayload?: unknown): Promise<InteractionRecord>;
  findByExternalEventId(eventId: string): Promise<InteractionRecord | null>;
  findById(id: string): Promise<InteractionRecord | null>;
  list(
    filters: InteractionFilters,
    pagination: Pagination,
  ): Promise<{ items: InteractionRecord[]; total: number }>;
  getSummary(filters: InteractionFilters): Promise<MetricsSummary>;
  getSelectionMetrics(filters: InteractionFilters): Promise<SelectionMetric[]>;
  getBotMetrics(filters: InteractionFilters): Promise<BotMetric[]>;
  isHealthy(): Promise<boolean>;
}
