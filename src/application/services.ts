import { AppError, DuplicateInteractionError, NotFoundError } from '../domain/errors.js';
import type { InteractionFilters, InteractionInput, Pagination } from '../domain/interaction.js';
import type { InteractionRepository } from './interaction-repository.js';

export class InteractionService {
  constructor(
    private readonly repository: InteractionRepository,
    private readonly requireEventId: boolean,
  ) {}

  async create(input: InteractionInput, rawPayload: unknown = input) {
    if (this.requireEventId && !input.eventId) {
      throw new AppError('EVENT_ID_REQUIRED', 'eventId is required by server configuration.', 422);
    }
    if (input.eventId) {
      const existing = await this.repository.findByExternalEventId(input.eventId);
      if (existing) throw new DuplicateInteractionError(existing.id);
    }
    return this.repository.create(input, rawPayload);
  }

  async findById(id: string) {
    const interaction = await this.repository.findById(id);
    if (!interaction) throw new NotFoundError();
    return interaction;
  }

  list(filters: InteractionFilters, pagination: Pagination) {
    return this.repository.list(filters, pagination);
  }
}

export class MetricsService {
  constructor(private readonly repository: InteractionRepository) {}

  async getOverview(filters: InteractionFilters) {
    const [summary, selections] = await Promise.all([
      this.repository.getSummary(filters),
      this.repository.getSelectionMetrics(filters),
    ]);
    return { ...summary, selections };
  }

  getSummary(filters: InteractionFilters) {
    return this.repository.getSummary(filters);
  }

  getSelections(filters: InteractionFilters) {
    return this.repository.getSelectionMetrics(filters);
  }

  getBots(filters: InteractionFilters) {
    return this.repository.getBotMetrics(filters);
  }
}
