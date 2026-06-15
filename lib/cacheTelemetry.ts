import { getDatabase } from "@/lib/db/sqlite";

export type CacheEventType = "hit" | "miss" | "expired" | "set";

export interface CacheTelemetryEvent {
  namespace: string;
  key: string;
  type: CacheEventType;
  ttlMs?: number;
  cacheAgeMs?: number | null;
  observedAt: string;
}

export interface CacheTelemetrySummary {
  totalEvents: number;
  hits: number;
  misses: number;
  expired: number;
  sets: number;
  hitRate: number | null;
  byNamespace: Array<{
    namespace: string;
    totalEvents: number;
    hits: number;
    misses: number;
    expired: number;
    sets: number;
    hitRate: number | null;
    lastEventAt: string | null;
  }>;
  recentEvents: CacheTelemetryEvent[];
  fetchedAt: string;
}

const MAX_EVENTS = 1_000;
const events: CacheTelemetryEvent[] = [];

export function recordCacheEvent(event: Omit<CacheTelemetryEvent, "observedAt">) {
  const observed = { ...event, observedAt: new Date().toISOString() };
  events.unshift(observed);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  try {
    getDatabase().prepare(`
      insert into cache_telemetry_events (
        namespace, cache_key, event_type, ttl_ms, cache_age_ms, observed_at
      ) values (?, ?, ?, ?, ?, ?)
    `).run(observed.namespace, observed.key, observed.type, observed.ttlMs ?? null, observed.cacheAgeMs ?? null, observed.observedAt);
  } catch {
    // Cache telemetry must never break a data request.
  }
}

export function getCacheTelemetrySummary(limit = 50): CacheTelemetrySummary {
  const sourceEvents = readPersistedEvents(Math.max(200, limit));
  const inputEvents = sourceEvents.length ? sourceEvents : events;
  const hits = count("hit", inputEvents);
  const misses = count("miss", inputEvents);
  const expired = count("expired", inputEvents);
  const sets = count("set", inputEvents);
  const lookupEvents = hits + misses + expired;
  const namespaceMap = new Map<string, CacheTelemetryEvent[]>();
  for (const event of inputEvents) namespaceMap.set(event.namespace, [...(namespaceMap.get(event.namespace) ?? []), event]);
  return {
    totalEvents: inputEvents.length,
    hits,
    misses,
    expired,
    sets,
    hitRate: lookupEvents ? hits / lookupEvents : null,
    byNamespace: [...namespaceMap.entries()].map(([namespace, namespaceEvents]) => {
      const namespaceHits = count("hit", namespaceEvents);
      const namespaceMisses = count("miss", namespaceEvents);
      const namespaceExpired = count("expired", namespaceEvents);
      const namespaceSets = count("set", namespaceEvents);
      const namespaceLookups = namespaceHits + namespaceMisses + namespaceExpired;
      return {
        namespace,
        totalEvents: namespaceEvents.length,
        hits: namespaceHits,
        misses: namespaceMisses,
        expired: namespaceExpired,
        sets: namespaceSets,
        hitRate: namespaceLookups ? namespaceHits / namespaceLookups : null,
        lastEventAt: namespaceEvents[0]?.observedAt ?? null
      };
    }).sort((a, b) => b.totalEvents - a.totalEvents),
    recentEvents: inputEvents.slice(0, Math.max(1, Math.min(limit, 200))),
    fetchedAt: new Date().toISOString()
  };
}

function readPersistedEvents(limit: number): CacheTelemetryEvent[] {
  try {
    const rows = getDatabase().prepare(`
      select namespace, cache_key, event_type, ttl_ms, cache_age_ms, observed_at
      from cache_telemetry_events
      order by observed_at desc, id desc
      limit ?
    `).all(Math.max(1, Math.min(limit, 1_000))) as Array<{
      namespace: string;
      cache_key: string;
      event_type: CacheEventType;
      ttl_ms: number | null;
      cache_age_ms: number | null;
      observed_at: string;
    }>;
    return rows.map((row) => ({
      namespace: row.namespace,
      key: row.cache_key,
      type: row.event_type,
      ttlMs: row.ttl_ms ?? undefined,
      cacheAgeMs: row.cache_age_ms,
      observedAt: row.observed_at
    }));
  } catch {
    return [];
  }
}

function count(type: CacheEventType, input: CacheTelemetryEvent[]) {
  return input.filter((event) => event.type === type).length;
}
