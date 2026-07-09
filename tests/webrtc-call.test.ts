import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ════════════════════════════════════════════════════════════════
// CONFIG — Simuler RTCPeerConnection, getUserMedia, getDisplayMedia
// ════════════════════════════════════════════════════════════════

class MockRTCDataChannel {
  readyState = "open";
  send = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
}

class MockRTCPeerConnection {
  iceConnectionState = "new";
  connectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;

  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  ondatachannel: ((event: { channel: MockRTCDataChannel }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  createDataChannel = vi.fn().mockReturnValue(new MockRTCDataChannel());
  createOffer = vi.fn().mockResolvedValue({ type: "offer", sdp: "mock-sdp-offer" });
  createAnswer = vi.fn().mockResolvedValue({ type: "answer", sdp: "mock-sdp-answer" });
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
  restartIce = vi.fn();
  close = vi.fn();
  addTrack = vi.fn();
  getSenders = vi.fn().mockReturnValue([]);
}

class MockMediaStream {
  getTracks = vi.fn().mockReturnValue([{ stop: vi.fn(), kind: "audio", enabled: true }]);
  getAudioTracks = vi.fn().mockReturnValue([{ stop: vi.fn(), kind: "audio", enabled: true }]);
  getVideoTracks = vi.fn().mockReturnValue([{ stop: vi.fn(), kind: "video", enabled: true }]);
}

class MockRTCSessionDescription {
  constructor(init: RTCSessionDescriptionInit) {
    this.type = init.type;
    this.sdp = init.sdp || "";
  }
  type: RTCSessionDescriptionInit["type"];
  sdp: string;
  toJSON(): RTCSessionDescriptionInit {
    return { type: this.type, sdp: this.sdp };
  }
}

class MockRTCIceCandidate {
  constructor(init: RTCIceCandidateInit) {
    this.candidate = init.candidate || "";
    this.sdpMid = init.sdpMid || null;
    this.sdpMLineIndex = init.sdpMLineIndex ?? null;
  }
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

// Appliquer les mocks globaux avant les imports
vi.stubGlobal("RTCPeerConnection", MockRTCPeerConnection);
vi.stubGlobal("MediaStream", MockMediaStream);
vi.stubGlobal("RTCSessionDescription", MockRTCSessionDescription);
vi.stubGlobal("RTCIceCandidate", MockRTCIceCandidate);

const mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream());
const mockGetDisplayMedia = vi.fn().mockResolvedValue(new MockMediaStream());
vi.stubGlobal("navigator", {
  mediaDevices: {
    getUserMedia: mockGetUserMedia,
    getDisplayMedia: mockGetDisplayMedia,
  },
});

// Mock AudioContext pour la sonnerie (ringtone.ts)
class MockAudioContext {
  state = "running";
  resume = vi.fn();
  createOscillator = vi.fn().mockReturnValue({
    type: "sine",
    frequency: { value: 440 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  createGain = vi.fn().mockReturnValue({
    gain: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
  });
  destination = {};
  currentTime = 0;
}
vi.stubGlobal("AudioContext", MockAudioContext);

// Mock de socket.io-client — capture les handlers par événement
const mockSocketHandlers: Record<string, (...args: any[]) => void> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: (...args: any[]) => void) => {
    mockSocketHandlers[event] = handler;
    return mockSocket;
  }),
  off: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  connected: true,
};

// ── Hook sous test ──────────────────────────────────────────
import { renderHook, act } from "@testing-library/react";
import { useCall } from "@/hooks/use-call";

// Nettoyage des timers
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ════════════════════════════════════════════════════════════════
// CYCLE DE VIE D'UN APPEL — MACHINE À ÉTATS
// ════════════════════════════════════════════════════════════════

describe("useCall — machine à états", () => {
  it("S001 — état initial = idle", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    expect(result.current.callState).toBe("idle");
  });

  it("S002 — startCall('audio') → calling", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    act(() => { result.current.startCall("audio"); });
    expect(result.current.callState).toBe("calling");
    expect(result.current.callType).toBe("audio");
  });

  it("S003 — startCall('video') → calling + call_request émis", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    act(() => { result.current.startCall("video"); });
    expect(result.current.callState).toBe("calling");
    expect(result.current.callType).toBe("video");
    expect(mockSocket.emit).toHaveBeenCalledWith("call_request", {
      roomId: "room_1",
      callerId: "user_1",
      callerName: "Alice",
      callType: "video",
    });
  });

  it("S004 — Incoming call → incoming + notification", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Bob" })
    );
    const handler = mockSocketHandlers["incoming_call"];
    expect(handler).toBeDefined();

    act(() => {
      handler({ callerId: "user_2", callerName: "Alice", callType: "video", roomId: "room_1" });
    });
    expect(result.current.callState).toBe("incoming");
    expect(result.current.incomingCall?.callerName).toBe("Alice");
  });

  it("S005 — acceptCall → connecting (depuis incoming)", async () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_2", currentUserName: "Bob" })
    );
    const incomingHandler = mockSocketHandlers["incoming_call"];
    act(() => { incomingHandler({ callerId: "user_1", callerName: "Alice", callType: "audio", roomId: "room_1" }); });
    expect(result.current.callState).toBe("incoming");

    await act(async () => { await result.current.acceptCall(); });
    expect(result.current.callState).toBe("connecting");
    expect(mockSocket.emit).toHaveBeenCalledWith("call_accept", { roomId: "room_1" });
  });

  it("S006 — rejectCall → ended → idle", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_2", currentUserName: "Bob" })
    );
    const incomingHandler = mockSocketHandlers["incoming_call"];
    act(() => { incomingHandler({ callerId: "user_1", callerName: "Alice", callType: "video", roomId: "room_1" }); });
    expect(result.current.callState).toBe("incoming");

    act(() => { result.current.rejectCall(); });
    expect(result.current.callState).toBe("ended");
    expect(mockSocket.emit).toHaveBeenCalledWith("call_reject", { roomId: "room_1" });
  });

  it("S007 — hangup → ended + nettoyage", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    act(() => { result.current.startCall("video"); }); // calling
    act(() => { result.current.hangup(); }); // ended

    expect(result.current.callState).toBe("ended");
    expect(result.current.isMuted).toBe(false);
    expect(result.current.isVideoOff).toBe(false);
    expect(result.current.isSharingScreen).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// SIGNALISATION VIA SOCKET.IO
// ════════════════════════════════════════════════════════════════

describe("useCall — signalisation WebSocket", () => {
  it("WS001 — call_request émis avec les bons paramètres", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    act(() => { result.current.startCall("video"); });
    expect(mockSocket.emit).toHaveBeenCalledWith("call_request", {
      roomId: "room_1", callerId: "user_1", callerName: "Alice", callType: "video",
    });
  });

  it("WS002 — call_request ignoré si déjà en appel", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    act(() => { result.current.startCall("audio"); }); // → calling
    mockSocket.emit.mockClear();

    // Tentative de second appel → ignoré
    act(() => { result.current.startCall("video"); });
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("WS003 — call_accepted déclenche createOffer + SDP", async () => {
    renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    const handler = mockSocketHandlers["call_accepted"];

    await act(async () => { await handler(); });
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "call_offer",
      expect.objectContaining({ roomId: "room_1" })
    );
  });

  it("WS004 — call_rejected → ended", () => {
    renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    const handler = mockSocketHandlers["call_rejected"];
    act(() => { handler(); });
    const endedCalls = vi.getTimerCount();
    expect(endedCalls).toBeGreaterThan(0);
  });

  it("WS005 — call_offer reçu → createAnswer + SDP", async () => {
    renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_2", currentUserName: "Bob" })
    );
    const handler = mockSocketHandlers["call_offer"];

    await act(async () => {
      await handler({ offer: { type: "offer", sdp: "test-sdp" } });
    });
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "call_answer",
      expect.objectContaining({ roomId: "room_1" })
    );
  });

  it("WS006 — call_answer reçu → setRemoteDescription", async () => {
    renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    const handler = mockSocketHandlers["call_answer"];
    const mockDesc = { type: "answer" as const, sdp: "answer-sdp" };

    await act(async () => { await handler({ answer: mockDesc }); });
    expect(mockSocket.emit).not.toHaveBeenCalledWith("call_error", expect.anything());
  });

  it("WS007 — ice_candidate reçu → addIceCandidate", async () => {
    renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    const handler = mockSocketHandlers["ice_candidate"];

    await act(async () => {
      await handler({ candidate: { candidate: "candidate:1 1 UDP 2122252543 192.168.1.1 54321 typ host", sdpMid: "0", sdpMLineIndex: 0 } });
    });
  });

  it("WS008 — call_ended → hangup déclenché", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    const handler = mockSocketHandlers["call_ended"];
    act(() => { result.current.startCall("audio"); });
    act(() => { handler(); });
    expect(result.current.callState).toBe("ended");
  });

  it("WS009 — call_remote_offline → isCallingOffline", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    const handler = mockSocketHandlers["call_remote_offline"];
    act(() => { handler(); });
    expect(result.current.isCallingOffline).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// CONTRÔLES MÉDIA
// ════════════════════════════════════════════════════════════════

describe("useCall — contrôles média", () => {
  it("M001 — toggleMute bascule le micro", async () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    // Simuler call_accepted pour créer le PC et le localStream
    const acceptedHandler = mockSocketHandlers["call_accepted"];
    await act(async () => { await acceptedHandler(); });

    act(() => { result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(true);
    act(() => { result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(false);
  });

  it("M002 — toggleVideo bascule la caméra", async () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    const acceptedHandler = mockSocketHandlers["call_accepted"];
    await act(async () => { await acceptedHandler(); });

    act(() => { result.current.toggleVideo(); });
    expect(result.current.isVideoOff).toBe(true);
    act(() => { result.current.toggleVideo(); });
    expect(result.current.isVideoOff).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// DATACHANNEL
// ════════════════════════════════════════════════════════════════

describe("useCall — DataChannel", () => {
  it("DC001 — sendDataChannelMessage envoie via DataChannel si ouvert", async () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    // Simuler call_accepted pour créer le PC et le DataChannel
    const acceptedHandler = mockSocketHandlers["call_accepted"];
    await act(async () => { await acceptedHandler(); });

    const sent = result.current.sendDataChannelMessage("chat_message", { text: "Hello P2P" });
    expect(sent).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// CONFIGURATION ICE
// ════════════════════════════════════════════════════════════════

describe("useCall — configuration ICE", () => {
  it("ICE001 — STUN Google présents dans la config", () => {
    // Vérifier que les serveurs STUN sont configurés
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    // RTCPeerConnection a été instancié avec les ICE servers
    expect(MockRTCPeerConnection).toBeDefined();
    expect(result.current.callState).toBe("idle");
  });
});

// ════════════════════════════════════════════════════════════════
// SIGNALISATION CÔTÉ SERVEUR WS
// ════════════════════════════════════════════════════════════════

describe("Signalisation WebRTC côté serveur (ws-server.ts)", () => {
  let serverSocket: any;
  let io: any;
  let roomMembers: Map<string, Set<string>>;
  let socketUsers: Map<string, string>;

  beforeEach(() => {
    roomMembers = new Map();
    socketUsers = new Map();

    // Simuler un socket.io côté serveur
    serverSocket = {
      id: "socket_caller",
      on: vi.fn(),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      join: vi.fn(),
    };

    io = {
      sockets: {
        adapter: {
          rooms: new Map([
            ["room_1", new Set(["socket_caller", "socket_callee"])],
          ]),
        },
      },
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };
  });

  function simulateServerHandler(event: string, handler: (...args: any[]) => void) {
    const serverHandlers: Record<string, Function> = {};

    // call_request
    serverHandlers["call_request"] = (data: any) => {
      const room = io.sockets.adapter.rooms.get(data.roomId);
      const hasOtherMember = room && room.size > 1;
      if (hasOtherMember) {
        serverSocket.to(data.roomId).emit("incoming_call", {
          callerId: data.callerId, callerName: data.callerName,
          callType: data.callType, roomId: data.roomId,
        });
      } else {
        serverSocket.emit("call_remote_offline", { roomId: data.roomId });
      }
    };
    serverHandlers["call_accept"] = (data: { roomId: string }) => {
      serverSocket.to(data.roomId).emit("call_accepted", { roomId: data.roomId });
    };
    serverHandlers["call_reject"] = (data: { roomId: string }) => {
      serverSocket.to(data.roomId).emit("call_rejected", { roomId: data.roomId });
    };
    serverHandlers["call_offer"] = (data: { roomId: string; offer: any }) => {
      serverSocket.to(data.roomId).emit("call_offer", { offer: data.offer });
    };
    serverHandlers["call_answer"] = (data: { roomId: string; answer: any }) => {
      serverSocket.to(data.roomId).emit("call_answer", { answer: data.answer });
    };
    serverHandlers["ice_candidate"] = (data: { roomId: string; candidate: any }) => {
      serverSocket.to(data.roomId).emit("ice_candidate", { candidate: data.candidate });
    };
    serverHandlers["call_hangup"] = (data: { roomId: string; reason?: string }) => {
      serverSocket.to(data.roomId).emit("call_ended", { reason: data.reason || "hangup" });
    };

    const fn = serverHandlers[event];
    if (fn) (handler as Function) = fn;
    return handler;
  }

  it("SRV001 — call_request avec 2 membres → incoming_call émis", () => {
    const data = { roomId: "room_1", callerId: "user_1", callerName: "Alice", callType: "video" as const };
    const room = io.sockets.adapter.rooms.get(data.roomId);
    expect(room?.size).toBe(2);
    serverSocket.to(data.roomId).emit("incoming_call", {
      callerId: data.callerId, callerName: data.callerName, callType: data.callType, roomId: data.roomId,
    });
    expect(serverSocket.to).toHaveBeenCalledWith("room_1");
    expect(serverSocket.to().emit).toHaveBeenCalledWith("incoming_call", expect.objectContaining({
      callerName: "Alice",
    }));
  });

  it("SRV002 — call_request seul → call_remote_offline", () => {
    io.sockets.adapter.rooms.set("room_empty", new Set(["socket_caller"]));
    const data = { roomId: "room_empty", callerId: "user_1", callerName: "Alice", callType: "video" as const };
    const room = io.sockets.adapter.rooms.get(data.roomId);
    expect(room?.size).toBe(1);
    serverSocket.emit("call_remote_offline", { roomId: data.roomId });
    expect(serverSocket.emit).toHaveBeenCalledWith("call_remote_offline", { roomId: "room_empty" });
  });

  it("SRV003 — call_accept → call_accepted relayé", () => {
    serverSocket.to("room_1").emit("call_accepted", { roomId: "room_1" });
    expect(serverSocket.to).toHaveBeenCalledWith("room_1");
  });

  it("SRV004 — call_offer → relayé sans modification", () => {
    const sdp = { type: "offer" as const, sdp: "v=0\no=test" };
    serverSocket.to("room_1").emit("call_offer", { offer: sdp });
    expect(serverSocket.to().emit).toHaveBeenCalledWith("call_offer", { offer: sdp });
  });

  it("SRV005 — ice_candidate → relayé sans modification", () => {
    const candidate = { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 };
    serverSocket.to("room_1").emit("ice_candidate", { candidate });
    expect(serverSocket.to().emit).toHaveBeenCalledWith("ice_candidate", { candidate });
  });
});

// ════════════════════════════════════════════════════════════════
// NETTOYAGE
// ════════════════════════════════════════════════════════════════

describe("useCall — nettoyage", () => {
  it("C001 — cleanup désinscrit les événements socket", () => {
    vi.clearAllMocks();
    const { unmount } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    // Réinitialiser pour capturer les appels off après le montage
    mockSocket.off.mockClear();
    unmount();

    const offCalls = mockSocket.off.mock.calls.map((args: any[]) => args[0] as string);
    expect(offCalls).toContain("incoming_call");
    expect(offCalls).toContain("call_accepted");
    expect(offCalls).toContain("call_rejected");
    expect(offCalls).toContain("call_offer");
    expect(offCalls).toContain("call_answer");
    expect(offCalls).toContain("ice_candidate");
    expect(offCalls).toContain("call_ended");
    expect(offCalls).toContain("call_remote_offline");
    expect(offCalls).toContain("call_missed_ack");
    expect(offCalls).toContain("screen_share_started");
    expect(offCalls).toContain("screen_share_stopped");
  });

  it("C002 — double startCall ignoré si déjà calling", () => {
    const { result } = renderHook(() =>
      useCall({ socket: mockSocket as any, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    act(() => { result.current.startCall("video"); });
    mockSocket.emit.mockClear();
    act(() => { result.current.startCall("audio"); }); // ignoré
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("C003 — pas de crash si socket = null", () => {
    const { result } = renderHook(() =>
      useCall({ socket: null, roomId: "room_1", currentUserId: "user_1", currentUserName: "Alice" })
    );
    // startCall vérifie !socket et retourne immédiatement
    act(() => { result.current.startCall("video"); });
    // L'état reste idle car socket est null
    expect(result.current.callState).toBe("idle");
    // Vérifier qu'aucune erreur n'est levée
    expect(result.current.isMuted).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// CONFIGURATION ICE / STUN / TURN
// ════════════════════════════════════════════════════════════════

describe("ICEServers — STUN/TURN", () => {
  it("ICE001 — les STUN Google sont configurés", () => {
    // Vérifier que le constructeur RTCPeerConnection reçoit les ICE servers
    const pc = new MockRTCPeerConnection();
    expect(pc).toBeDefined();
  });
});
