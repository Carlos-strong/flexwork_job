/**
 * SyncStore — Bus d'événements in-process pour les connexions SSE.
 * Partage les événements entre les routes API et les clients SSE connectés.
 * Survit au hot-reload Next.js en dev grâce au singleton globalThis.
 */

export type SyncEventType = "message" | "contract_update" | "milestone_update" | "workflow_update";

export interface SyncEvent {
  type: SyncEventType;
  data: Record<string, unknown>;
}

type Subscriber = (event: SyncEvent) => void;

class SyncStore {
  private rooms = new Map<string, Set<Subscriber>>();

  subscribe(room: string, cb: Subscriber): () => void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Set());
    this.rooms.get(room)!.add(cb);
    return () => {
      this.rooms.get(room)?.delete(cb);
    };
  }

  emit(room: string, event: SyncEvent): void {
    this.rooms.get(room)?.forEach((cb) => {
      try {
        cb(event);
      } catch {
        // subscriber déconnecté
      }
    });
  }

  roomCount(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __syncStore: SyncStore | undefined;
}

// Singleton — survit aux rechargements de modules en dev
const syncStore: SyncStore =
  globalThis.__syncStore ?? (globalThis.__syncStore = new SyncStore());

export { syncStore };
