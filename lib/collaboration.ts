/**
 * Module de collaboration TrustEngine
 *
 * Modèle de données (mock) pour :
 *   - Conversations (liées au contrat)
 *   - Messages (TEXT, FILE, IMAGE, VOICE, SYSTEM)
 *   - Meetings (Google Meet / calendrier)
 *   - Audit trail
 */

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

export const conversations: Conversation[] = [];
export const participants: ConversationParticipant[] = [];
export const chatMessages: ChatMessage[] = [];
export const meetings: Meeting[] = [];
export const meetingLogs: MeetingLog[] = [];
export const messageAudits: MessageAudit[] = [];

// ── Helpers ────────────────────────────────────

let idCounter = 1;
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${idCounter++}`;
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
}
