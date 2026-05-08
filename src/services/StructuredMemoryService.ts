/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

export type MemoryWing = string;
export type MemoryHall = 'facts' | 'events' | 'discoveries' | 'preferences' | 'advice';
export type MemoryLayer = 'identity' | 'critical_facts' | 'room_recall' | 'deep_search';

export interface MemoryStructureInput {
  wing?: unknown;
  hall?: unknown;
  room?: unknown;
  layer?: unknown;
}

export interface StructuredMemoryShape {
  wing: MemoryWing;
  hall: MemoryHall;
  room: string;
  layer: MemoryLayer;
  path: string;
}

const VALID_HALLS: MemoryHall[] = ['facts', 'events', 'discoveries', 'preferences', 'advice'];
const VALID_LAYERS: MemoryLayer[] = ['identity', 'critical_facts', 'room_recall', 'deep_search'];

function slugify(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = safeString(value).trim();
    if (candidate) return candidate;
  }
  return '';
}

function inferWing(metadata: Record<string, any>): string {
  return pickFirstString(
    metadata.memoryWing,
    metadata.namespace,
    metadata.workspace,
    metadata.workspaceId,
    metadata.project,
    metadata.projectId,
    metadata.circleId,
    metadata.sectorId,
    metadata.verticalSku,
    'general'
  );
}

function inferHall(metadata: Record<string, any>, tags: string[]): MemoryHall {
  const hint = pickFirstString(metadata.memoryHall, metadata.kind, metadata.type, metadata.category);
  const lowerHint = hint.toLowerCase();

  if (VALID_HALLS.includes(lowerHint as MemoryHall)) return lowerHint as MemoryHall;
  if (tags.includes('preference') || tags.includes('preferences')) return 'preferences';
  if (tags.includes('event') || tags.includes('timeline')) return 'events';
  if (tags.includes('discovery') || tags.includes('insight')) return 'discoveries';
  if (tags.includes('advice') || tags.includes('recommendation')) return 'advice';
  return 'facts';
}

function inferRoom(content: string, metadata: Record<string, any>): string {
  const hint = pickFirstString(
    metadata.memoryRoom,
    metadata.topic,
    metadata.subject,
    metadata.query,
    metadata.title
  );

  if (hint) return hint;

  const prefix = content.trim().split(/\s+/).slice(0, 6).join(' ');
  return prefix || 'general';
}

function inferLayer(metadata: Record<string, any>): MemoryLayer {
  const hint = pickFirstString(metadata.memoryLayer, metadata.layer).toLowerCase();
  if (VALID_LAYERS.includes(hint as MemoryLayer)) return hint as MemoryLayer;
  return 'deep_search';
}

function normalizeHall(value: unknown, fallback: MemoryHall): MemoryHall {
  const candidate = safeString(value).trim().toLowerCase();
  return VALID_HALLS.includes(candidate as MemoryHall) ? (candidate as MemoryHall) : fallback;
}

function normalizeLayer(value: unknown, fallback: MemoryLayer): MemoryLayer {
  const candidate = safeString(value).trim().toLowerCase();
  return VALID_LAYERS.includes(candidate as MemoryLayer) ? (candidate as MemoryLayer) : fallback;
}

function parseTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => safeString(value).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 25);
}

export class StructuredMemoryService {
  normalize(input: {
    structure?: MemoryStructureInput | null;
    metadata?: Record<string, any> | null;
    tags?: unknown;
    content?: string;
  }): StructuredMemoryShape {
    const metadata = input.metadata || {};
    const tags = parseTags(input.tags);
    const structure = input.structure || {};
    const content = safeString(input.content);

    const wing = slugify(pickFirstString(structure.wing, inferWing(metadata)), 'general');
    const hall = normalizeHall(structure.hall, inferHall(metadata, tags));
    const room = slugify(pickFirstString(structure.room, inferRoom(content, metadata)), 'general');
    const layer = normalizeLayer(structure.layer, inferLayer(metadata));

    return {
      wing,
      hall,
      room,
      layer,
      path: `${wing}/${hall}/${room}`,
    };
  }

  decorateMetadata(input: {
    structure?: MemoryStructureInput | null;
    metadata?: Record<string, any> | null;
    tags?: unknown;
    content?: string;
  }): { metadata: Record<string, any>; structure: StructuredMemoryShape } {
    const metadata = input.metadata || {};
    const structure = this.normalize(input);

    return {
      structure,
      metadata: {
        ...metadata,
        memoryWing: structure.wing,
        memoryHall: structure.hall,
        memoryRoom: structure.room,
        memoryLayer: structure.layer,
        memoryPath: structure.path,
      },
    };
  }

  buildFilter(input?: {
    structure?: MemoryStructureInput | null;
    namespace?: unknown;
    tags?: unknown;
  }): Record<string, any> | undefined {
    const filter: Record<string, any> = {};
    const structure = input?.structure || {};

    const wing = safeString(structure.wing).trim();
    const hall = safeString(structure.hall).trim().toLowerCase();
    const room = safeString(structure.room).trim();
    const layer = safeString(structure.layer).trim().toLowerCase();
    const namespace = safeString(input?.namespace).trim();
    const tags = parseTags(input?.tags);

    if (wing) filter.memoryWing = slugify(wing, 'general');
    if (VALID_HALLS.includes(hall as MemoryHall)) filter.memoryHall = hall;
    if (room) filter.memoryRoom = slugify(room, 'general');
    if (VALID_LAYERS.includes(layer as MemoryLayer)) filter.memoryLayer = layer;
    if (namespace) filter.namespace = namespace;
    if (tags.length === 1) filter.tags = tags[0];

    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  matchesStructure(
    metadata: Record<string, any> | undefined,
    structure?: MemoryStructureInput | null
  ): boolean {
    if (!structure) return true;
    const candidate = metadata || {};

    const wing = safeString(structure.wing).trim();
    const hall = safeString(structure.hall).trim().toLowerCase();
    const room = safeString(structure.room).trim();
    const layer = safeString(structure.layer).trim().toLowerCase();

    if (wing && candidate.memoryWing !== slugify(wing, 'general')) return false;
    if (hall && candidate.memoryHall !== hall) return false;
    if (room && candidate.memoryRoom !== slugify(room, 'general')) return false;
    if (layer && candidate.memoryLayer !== layer) return false;

    return true;
  }

  summarize(results: Array<{ metadata?: Record<string, any> }>): {
    total: number;
    byWing: Record<string, number>;
    byHall: Record<string, number>;
    byLayer: Record<string, number>;
  } {
    const summary = {
      total: results.length,
      byWing: {} as Record<string, number>,
      byHall: {} as Record<string, number>,
      byLayer: {} as Record<string, number>,
    };

    for (const result of results) {
      const metadata = result.metadata || {};
      const wing = safeString(metadata.memoryWing || 'general');
      const hall = safeString(metadata.memoryHall || 'facts');
      const layer = safeString(metadata.memoryLayer || 'deep_search');

      summary.byWing[wing] = (summary.byWing[wing] || 0) + 1;
      summary.byHall[hall] = (summary.byHall[hall] || 0) + 1;
      summary.byLayer[layer] = (summary.byLayer[layer] || 0) + 1;
    }

    return summary;
  }
}

export const structuredMemoryService = new StructuredMemoryService();
