/**
 * Module de collaboration TrustEngine
 *
 * Modèle de données (mock) pour :
 *   - Conversations (liées au contrat)
 *   - Messages (TEXT, FILE, IMAGE, VOICE, SYSTEM)
 *   - Meetings (Google Meet / calendrier)
 *   - Audit trail
 */

import { saveToDisk, loadFromDisk } from "@/lib/persist";

const STORAGE_KEY = "collaboration";

// ── Types ──────────────────────────────────────

export type MessageType = "TEXT" | "FILE" | "IMAGE" | "VOICE" | "SYSTEM";

export interface Conversation {
  id: string;
  contractId: string;
  title: string;
  createdAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  role: "CLIENT" | "FREELANCER";
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string;
  /** URL du fichier (si type = FILE ou IMAGE) */
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

export interface Meeting {
  id: string;
  contractId: string;
  conversationId: string;
  provider: "google_meet";
  meetingUrl: string;
  title: string;
  scheduledAt: string;
  duration: number; // minutes
  status: "scheduled" | "started" | "ended" | "cancelled";
  hostId: string;
  guestId: string;
  createdAt: string;
}

export interface MeetingLog {
  id: string;
  meetingId: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null; // secondes
}

export interface MessageAudit {
  id: string;
  messageId: string;
  action: "created" | "edited" | "deleted" | "read";
  userId: string;
  createdAt: string;
}

// ── Stores mock ────────────────────────────────
// Utilise globalThis pour survivre aux hot-reloads Next.js en développement.
// En production, ces données doivent être persistées en base (Prisma).

interface CollabStore {
  conversations: Conversation[];
  participants: ConversationParticipant[];
  chatMessages: ChatMessage[];
  meetings: Meeting[];
  meetingLogs: MeetingLog[];
  messageAudits: MessageAudit[];
  idCounter: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __collabStore: CollabStore | undefined;
}

function loadCollabStore(): CollabStore {
  // 1. Vérifier globalThis (déjà chargé = hot-reload)
  if (globalThis.__collabStore) {
    return globalThis.__collabStore;
  }

  // 2. Tenter de charger depuis le disque (survit aux redémarrages)
  const saved = loadFromDisk<CollabStore | null>(STORAGE_KEY, null);
  if (saved) {
    globalThis.__collabStore = saved;
    return saved;
  }

  // 3. Valeur par défaut (première exécution)
  const defaults: CollabStore = {
    conversations: [],
    participants: [],
    chatMessages: [],
    meetings: [],
    meetingLogs: [],
    messageAudits: [],
    idCounter: 1,
  };
  globalThis.__collabStore = defaults;
  return defaults;
}

const _store: CollabStore = loadCollabStore();

// Exports pointant sur les mêmes tableaux persistants
export const conversations    = _store.conversations;
export const participants     = _store.participants;
export const chatMessages     = _store.chatMessages;
export const meetings         = _store.meetings;
export const meetingLogs      = _store.meetingLogs;
export const messageAudits    = _store.messageAudits;

// ── Persistance auto ───────────────────────────

/** Sauvegarde immédiate du store complet sur disque */
function persistStore(): void {
  saveToDisk(STORAGE_KEY, _store);
}

// ── Helpers ────────────────────────────────────

export function generateId(prefix: string): string {
  const id = `${prefix}-${Date.now()}-${_store.idCounter++}`;
  persistStore(); // sauvegarder le compteur
  return id;
}

/** Crée une conversation automatiquement à la création d'un contrat */
export function createConversation(params: {
  contractId: string;
  title: string;
  clientId: string;
  clientName: string;
  freelancerId: string;
  freelancerName: string;
}): Conversation {
  const conv: Conversation = {
    id: generateId("conv"),
    contractId: params.contractId,
    title: params.title,
    createdAt: new Date().toISOString(),
  };
  conversations.push(conv);

  // Participants
  participants.push(
    { id: generateId("part"), conversationId: conv.id, userId: params.clientId, userName: params.clientName, role: "CLIENT" },
    { id: generateId("part"), conversationId: conv.id, userId: params.freelancerId, userName: params.freelancerName, role: "FREELANCER" },
  );

  persistStore(); // 💾 sauvegarde sur disque
  return conv;
}

/** Ajoute un message système dans une conversation (avec audit trail) */
export function addSystemMessage(conversationId: string, content: string): ChatMessage {
  const msg: ChatMessage = {
    id: generateId("msg"),
    conversationId,
    senderId: "system",
    senderName: "Système",
    type: "SYSTEM",
    content,
    createdAt: new Date().toISOString(),
  };
  chatMessages.push(msg);
  // Audit trail pour les messages système
  messageAudits.push({
    id: generateId("audit"),
    messageId: msg.id,
    action: "created",
    userId: "system",
    createdAt: msg.createdAt,
  });
  persistStore(); // 💾 sauvegarde sur disque
  return msg;
}

/** Ajoute un message texte */
export function addTextMessage(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
}): ChatMessage {
  const msg: ChatMessage = {
    id: generateId("msg"),
    conversationId: params.conversationId,
    senderId: params.senderId,
    senderName: params.senderName,
    type: "TEXT",
    content: params.content,
    createdAt: new Date().toISOString(),
  };
  chatMessages.push(msg);
  messageAudits.push({
    id: generateId("audit"),
    messageId: msg.id,
    action: "created",
    userId: params.senderId,
    createdAt: msg.createdAt,
  });
  persistStore(); // 💾 sauvegarde sur disque
  return msg;
}

/** Crée une réunion Google Meet */
export function createMeeting(params: {
  contractId: string;
  conversationId: string;
  title: string;
  hostId: string;
  guestId: string;
  meetUrl: string;
  scheduledAt: string;
  duration: number;
}): Meeting {
  const meeting: Meeting = {
    id: generateId("meet"),
    contractId: params.contractId,
    conversationId: params.conversationId,
    provider: "google_meet",
    meetingUrl: params.meetUrl,
    title: params.title,
    scheduledAt: params.scheduledAt,
    duration: params.duration,
    status: "scheduled",
    hostId: params.hostId,
    guestId: params.guestId,
    createdAt: new Date().toISOString(),
  };
  meetings.push(meeting);
  persistStore(); // 💾 sauvegarde sur disque
  return meeting;
}

/** Log le début/fin d'une réunion */
export function logMeetingEvent(meetingId: string, event: "started" | "ended"): void {
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return;

  if (event === "started") {
    meeting.status = "started";
    meetingLogs.push({
      id: generateId("mlog"),
      meetingId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      duration: null,
    });
  } else {
    meeting.status = "ended";
    const log = meetingLogs.find((l) => l.meetingId === meetingId && !l.endedAt);
    if (log) {
      log.endedAt = new Date().toISOString();
      log.duration = Math.round(
        (new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime()) / 1000
      );
    }
  }
  persistStore(); // 💾 sauvegarde sur disque
}
