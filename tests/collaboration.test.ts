import { describe, it, expect, beforeEach } from "vitest";
import {
  createConversation,
  addSystemMessage,
  addTextMessage,
  createMeeting,
  logMeetingEvent,
  conversations,
  participants,
  chatMessages,
  meetings,
  meetingLogs,
  messageAudits,
} from "@/lib/collaboration";

beforeEach(() => {
  conversations.length = 0;
  participants.length = 0;
  chatMessages.length = 0;
  meetings.length = 0;
  meetingLogs.length = 0;
  messageAudits.length = 0;
});

describe("lib/collaboration.ts", () => {
  it("T021 — createConversation crée conversation + 2 participants", () => {
    const conv = createConversation({
      contractId: "c-1",
      title: "Test Contract",
      clientId: "client-1",
      clientName: "Client",
      freelancerId: "f-1",
      freelancerName: "Freelance",
    });
    expect(conv.id).toBeDefined();
    expect(conv.contractId).toBe("c-1");
    expect(conversations).toHaveLength(1);
    expect(participants).toHaveLength(2);
    expect(participants[0].role).toBe("CLIENT");
    expect(participants[1].role).toBe("FREELANCER");
  });

  it("T022 — addSystemMessage crée un message type SYSTEM", () => {
    const conv = createConversation({ contractId: "c-1", title: "T", clientId: "c", clientName: "C", freelancerId: "f", freelancerName: "F" });
    const msg = addSystemMessage(conv.id, "Test system message");
    expect(msg.type).toBe("SYSTEM");
    expect(msg.senderId).toBe("system");
    expect(msg.content).toBe("Test system message");
  });

  it("T023 — addTextMessage crée message + audit", () => {
    const conv = createConversation({ contractId: "c-1", title: "T", clientId: "c", clientName: "C", freelancerId: "f", freelancerName: "F" });
    const msg = addTextMessage({ conversationId: conv.id, senderId: "u1", senderName: "U", content: "Hello" });
    expect(msg.type).toBe("TEXT");
    expect(msg.content).toBe("Hello");
    expect(messageAudits).toHaveLength(1);
    expect(messageAudits[0].messageId).toBe(msg.id);
  });

  it("T024 — createMeeting crée réunion avec statut scheduled", () => {
    const meeting = createMeeting({
      contractId: "c-1",
      conversationId: "conv-1",
      title: "Kick-off",
      hostId: "c",
      guestId: "f",
      meetUrl: "https://meet.google.com/abc",
      scheduledAt: new Date().toISOString(),
      duration: 30,
    });
    expect(meeting.status).toBe("scheduled");
    expect(meeting.provider).toBe("google_meet");
  });

  it("T025 — logMeetingEvent started crée un log", () => {
    const meeting = createMeeting({ contractId: "c-1", conversationId: "conv-1", title: "T", hostId: "h", guestId: "g", meetUrl: "http://x", scheduledAt: new Date().toISOString(), duration: 30 });
    logMeetingEvent(meeting.id, "started");
    expect(meeting.status).toBe("started");
    expect(meetingLogs).toHaveLength(1);
    expect(meetingLogs[0].startedAt).toBeDefined();
    expect(meetingLogs[0].endedAt).toBeNull();
  });

  it("T026 — logMeetingEvent ended remplit endedAt + duration", () => {
    const meeting = createMeeting({ contractId: "c-1", conversationId: "conv-1", title: "T", hostId: "h", guestId: "g", meetUrl: "http://x", scheduledAt: new Date().toISOString(), duration: 30 });
    logMeetingEvent(meeting.id, "started");
    logMeetingEvent(meeting.id, "ended");
    expect(meeting.status).toBe("ended");
    expect(meetingLogs[0].endedAt).toBeDefined();
    expect(meetingLogs[0].duration).toBeGreaterThanOrEqual(0);
  });
});
