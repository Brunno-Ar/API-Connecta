import {
  Prisma,
  type Interaction,
  type InteractionSelection,
  type PrismaClient,
} from '@prisma/client';
import type { InteractionRepository } from '../application/interaction-repository.js';
import { DatabaseUnavailableError, DuplicateInteractionError } from '../domain/errors.js';
import type {
  BotMetric,
  InteractionFilters,
  InteractionInput,
  InteractionRecord,
  MetricsSummary,
  Pagination,
  SelectionMetric,
  SelectionValue,
} from '../domain/interaction.js';

type DbInteraction = Interaction & { selections: InteractionSelection[] };

function valueText(value: SelectionValue): string | null {
  return value === null ? null : String(value);
}

function jsonValue(value: SelectionValue): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
  return value === null ? Prisma.JsonNull : value;
}

function mapInteraction(row: DbInteraction): InteractionRecord {
  return {
    id: row.id,
    externalEventId: row.externalEventId,
    contactId: row.contactId,
    botId: row.botId,
    rawPayload: row.rawPayload,
    receivedAt: row.receivedAt,
    createdAt: row.createdAt,
    selections: row.selections.map((selection) => ({
      key: selection.key,
      value: selection.value === null ? null : (selection.value as SelectionValue),
    })),
  };
}

function whereInput(filters: InteractionFilters): Prisma.InteractionWhereInput {
  return {
    ...(filters.botId ? { botId: filters.botId } : {}),
    ...(filters.contactId ? { contactId: filters.contactId } : {}),
    ...(filters.from || filters.to
      ? {
          receivedAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.selectionKey || filters.selectionValue !== undefined
      ? {
          selections: {
            some: {
              ...(filters.selectionKey ? { key: filters.selectionKey } : {}),
              ...(filters.selectionValue !== undefined
                ? { valueText: filters.selectionValue }
                : {}),
            },
          },
        }
      : {}),
  };
}

function sqlFilters(filters: InteractionFilters, alias = 'i'): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  const column = (name: string) => Prisma.raw(`"${alias}"."${name}"`);
  if (filters.botId) conditions.push(Prisma.sql`${column('bot_id')} = ${filters.botId}`);
  if (filters.contactId)
    conditions.push(Prisma.sql`${column('contact_id')} = ${filters.contactId}`);
  if (filters.from) conditions.push(Prisma.sql`${column('received_at')} >= ${filters.from}`);
  if (filters.to) conditions.push(Prisma.sql`${column('received_at')} <= ${filters.to}`);
  if (filters.selectionKey || filters.selectionValue !== undefined) {
    const selectionConditions: Prisma.Sql[] = [
      Prisma.sql`s_filter.interaction_id = ${column('id')}`,
    ];
    if (filters.selectionKey)
      selectionConditions.push(Prisma.sql`s_filter.key = ${filters.selectionKey}`);
    if (filters.selectionValue !== undefined)
      selectionConditions.push(Prisma.sql`s_filter.value_text = ${filters.selectionValue}`);
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM interaction_selections s_filter WHERE ${Prisma.join(selectionConditions, ' AND ')})`,
    );
  }
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
}

function databaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw error;
  throw new DatabaseUnavailableError();
}

export class PrismaInteractionRepository implements InteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: InteractionInput, rawPayload: unknown = input): Promise<InteractionRecord> {
    try {
      const row = await this.prisma.interaction.create({
        data: {
          externalEventId: input.eventId ?? null,
          contactId: input.contactId,
          botId: input.botId,
          rawPayload: rawPayload as Prisma.InputJsonValue,
          selections: {
            create: Object.entries(input.selections).map(([key, value]) => ({
              key,
              value: jsonValue(value),
              valueText: valueText(value),
            })),
          },
        },
        include: { selections: { orderBy: { key: 'asc' } } },
      });
      return mapInteraction(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.eventId
      ) {
        const existing = await this.findByExternalEventId(input.eventId);
        if (existing) throw new DuplicateInteractionError(existing.id);
      }
      return databaseError(error);
    }
  }

  async findByExternalEventId(eventId: string) {
    const row = await this.prisma.interaction.findUnique({
      where: { externalEventId: eventId },
      include: { selections: { orderBy: { key: 'asc' } } },
    });
    return row ? mapInteraction(row) : null;
  }

  async findById(id: string) {
    const row = await this.prisma.interaction.findUnique({
      where: { id },
      include: { selections: { orderBy: { key: 'asc' } } },
    });
    return row ? mapInteraction(row) : null;
  }

  async list(filters: InteractionFilters, pagination: Pagination) {
    const where = whereInput(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.interaction.findMany({
        where,
        include: { selections: { orderBy: { key: 'asc' } } },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.interaction.count({ where }),
    ]);
    return { items: items.map(mapInteraction), total };
  }

  async getSummary(filters: InteractionFilters): Promise<MetricsSummary> {
    const rows = await this.prisma.$queryRaw<
      Array<{ totalInteractions: bigint; totalSelections: bigint; uniqueContacts: bigint }>
    >(Prisma.sql`
      SELECT COUNT(DISTINCT i.id) AS "totalInteractions",
             COUNT(s.id) AS "totalSelections",
             COUNT(DISTINCT i.contact_id) AS "uniqueContacts"
      FROM interactions i
      LEFT JOIN interaction_selections s ON s.interaction_id = i.id
      ${sqlFilters(filters)}
    `);
    const row = rows[0];
    return {
      totalInteractions: Number(row?.totalInteractions ?? 0),
      totalSelections: Number(row?.totalSelections ?? 0),
      uniqueContacts: Number(row?.uniqueContacts ?? 0),
    };
  }

  async getSelectionMetrics(filters: InteractionFilters): Promise<SelectionMetric[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ key: string; value: unknown; selectionCount: bigint; uniqueContacts: bigint }>
    >(Prisma.sql`
      SELECT s.key, s.value,
             COUNT(*) AS "selectionCount",
             COUNT(DISTINCT i.contact_id) AS "uniqueContacts"
      FROM interaction_selections s
      JOIN interactions i ON i.id = s.interaction_id
      ${sqlFilters(filters)}
      GROUP BY s.key, s.value
      ORDER BY "selectionCount" DESC, s.key ASC
    `);
    return rows.map((row) => ({
      key: row.key,
      value: row.value as SelectionValue,
      selectionCount: Number(row.selectionCount),
      uniqueContacts: Number(row.uniqueContacts),
    }));
  }

  async getBotMetrics(filters: InteractionFilters): Promise<BotMetric[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        botId: string;
        totalInteractions: bigint;
        totalSelections: bigint;
        uniqueContacts: bigint;
      }>
    >(Prisma.sql`
      SELECT i.bot_id AS "botId",
             COUNT(DISTINCT i.id) AS "totalInteractions",
             COUNT(s.id) AS "totalSelections",
             COUNT(DISTINCT i.contact_id) AS "uniqueContacts"
      FROM interactions i
      LEFT JOIN interaction_selections s ON s.interaction_id = i.id
      ${sqlFilters(filters)}
      GROUP BY i.bot_id
      ORDER BY "totalInteractions" DESC, i.bot_id ASC
    `);
    return rows.map((row) => ({
      botId: row.botId,
      totalInteractions: Number(row.totalInteractions),
      totalSelections: Number(row.totalSelections),
      uniqueContacts: Number(row.uniqueContacts),
    }));
  }

  async isHealthy() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
