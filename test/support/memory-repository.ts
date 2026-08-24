import { randomUUID } from 'node:crypto';
import type { InteractionRepository } from '../../src/application/interaction-repository.js';
import type {
  BotMetric,
  InteractionFilters,
  InteractionInput,
  InteractionRecord,
  MetricsSummary,
  Pagination,
  SelectionMetric,
} from '../../src/domain/interaction.js';

function matches(item: InteractionRecord, filters: InteractionFilters) {
  return (
    (!filters.botId || item.botId === filters.botId) &&
    (!filters.contactId || item.contactId === filters.contactId) &&
    (!filters.from || item.receivedAt >= filters.from) &&
    (!filters.to || item.receivedAt <= filters.to) &&
    ((!filters.selectionKey && filters.selectionValue === undefined) ||
      item.selections.some(
        (selection) =>
          (!filters.selectionKey || selection.key === filters.selectionKey) &&
          (filters.selectionValue === undefined ||
            String(selection.value) === filters.selectionValue),
      ))
  );
}

export class MemoryInteractionRepository implements InteractionRepository {
  readonly items: InteractionRecord[] = [];
  healthy = true;
  failCreate = false;

  async create(input: InteractionInput, rawPayload: unknown = input) {
    if (this.failCreate) throw new Error('database failed');
    const now = new Date();
    const item: InteractionRecord = {
      id: randomUUID(),
      externalEventId: input.eventId ?? null,
      contactId: input.contactId,
      botId: input.botId,
      rawPayload: structuredClone(rawPayload),
      receivedAt: now,
      createdAt: now,
      selections: Object.entries(input.selections).map(([key, value]) => ({ key, value })),
    };
    this.items.push(item);
    return item;
  }

  async findByExternalEventId(eventId: string) {
    return this.items.find((item) => item.externalEventId === eventId) ?? null;
  }

  async findById(id: string) {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async list(filters: InteractionFilters, pagination: Pagination) {
    const matchesFilters = this.items.filter((item) => matches(item, filters)).reverse();
    const offset = (pagination.page - 1) * pagination.limit;
    return {
      items: matchesFilters.slice(offset, offset + pagination.limit),
      total: matchesFilters.length,
    };
  }

  async getSummary(filters: InteractionFilters): Promise<MetricsSummary> {
    const items = this.items.filter((item) => matches(item, filters));
    return {
      totalInteractions: items.length,
      totalSelections: items.reduce((total, item) => total + item.selections.length, 0),
      uniqueContacts: new Set(items.map((item) => item.contactId)).size,
    };
  }

  async getSelectionMetrics(filters: InteractionFilters): Promise<SelectionMetric[]> {
    const groups = new Map<string, { metric: SelectionMetric; contacts: Set<string> }>();
    for (const item of this.items.filter((entry) => matches(entry, filters))) {
      for (const selection of item.selections) {
        const id = `${selection.key}:${JSON.stringify(selection.value)}`;
        const group = groups.get(id) ?? {
          metric: {
            key: selection.key,
            value: selection.value,
            selectionCount: 0,
            uniqueContacts: 0,
          },
          contacts: new Set<string>(),
        };
        group.metric.selectionCount += 1;
        group.contacts.add(item.contactId);
        groups.set(id, group);
      }
    }
    return [...groups.values()]
      .map(({ metric, contacts }) => ({ ...metric, uniqueContacts: contacts.size }))
      .sort((a, b) => b.selectionCount - a.selectionCount || a.key.localeCompare(b.key));
  }

  async getBotMetrics(filters: InteractionFilters): Promise<BotMetric[]> {
    const botIds = new Set(
      this.items.filter((item) => matches(item, filters)).map((item) => item.botId),
    );
    return Promise.all(
      [...botIds].map(async (botId) => ({
        botId,
        ...(await this.getSummary({ ...filters, botId })),
      })),
    );
  }

  async isHealthy() {
    return this.healthy;
  }
}
