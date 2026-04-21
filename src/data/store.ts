import { useSyncExternalStore } from "react";
import {
  availabilityRows as seedAvailability,
  properties as seedProperties,
  type AvailabilityRow,
  type AvailabilityStatus,
  type Property,
  type PropertyStatus,
} from "./mock";

interface State {
  availability: AvailabilityRow[];
  properties: Property[];
}

let state: State = {
  availability: seedAvailability.map((r) => ({ ...r })),
  properties: seedProperties.map((p) => ({ ...p })),
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const CURRENT_AGENT_ID = "U-001";

export interface AvailabilitySyncResult {
  syncedPropertyIds: string[];
}

function appendHistory(
  row: AvailabilityRow,
  from: AvailabilityStatus,
  to: AvailabilityStatus,
): AvailabilityRow["history"] {
  const entry = { at: nowIso(), from, to, agentId: CURRENT_AGENT_ID };
  const prev = row.history ?? [];
  return [...prev, entry];
}

/** Update one availability row and propagate status → linked property. */
export function updateAvailabilityRow(
  id: string,
  patch: Partial<Pick<AvailabilityRow, "price" | "delivery" | "status" | "notes">>,
): AvailabilitySyncResult {
  const synced: string[] = [];
  const updatedAt = today();
  const prevRow = state.availability.find((r) => r.id === id);
  const statusChanged = prevRow && patch.status && patch.status !== prevRow.status;

  const availability = state.availability.map((r) => {
    if (r.id !== id) return r;
    const history = statusChanged
      ? appendHistory(r, r.status, patch.status as AvailabilityStatus)
      : r.history;
    return { ...r, ...patch, updatedAt, history };
  });

  const target = availability.find((r) => r.id === id);
  let properties = state.properties;
  if (target?.propertyId && statusChanged) {
    properties = properties.map((p) =>
      p.id === target.propertyId
        ? { ...p, status: patch.status as PropertyStatus }
        : p,
    );
    synced.push(target.propertyId);
  }

  state = { availability, properties };
  emit();
  return { syncedPropertyIds: synced };
}

/** Bulk status change → propagate to all linked properties. */
export function bulkUpdateAvailabilityStatus(
  ids: Set<string>,
  status: AvailabilityStatus,
): AvailabilitySyncResult {
  const updatedAt = today();
  const synced: string[] = [];

  const availability = state.availability.map((r) => {
    if (!ids.has(r.id)) return r;
    const history = r.status !== status ? appendHistory(r, r.status, status) : r.history;
    return { ...r, status, updatedAt, history };
  });

  const linkedPropertyIds = new Set(
    availability
      .filter((r) => ids.has(r.id) && r.propertyId)
      .map((r) => r.propertyId as string),
  );

  const properties = state.properties.map((p) => {
    if (linkedPropertyIds.has(p.id)) {
      synced.push(p.id);
      return { ...p, status: status as PropertyStatus };
    }
    return p;
  });

  state = { availability, properties };
  emit();
  return { syncedPropertyIds: synced };
}

export function useAvailability() {
  return useSyncExternalStore(subscribe, () => state.availability, () => state.availability);
}

export function useProperties() {
  return useSyncExternalStore(subscribe, () => state.properties, () => state.properties);
}
