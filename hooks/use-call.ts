"use client";

/**
 * Hook useCall — gère le cycle complet d'un appel WebRTC.
 *
 * Fonctionnalités :
 *   - Appel audio / vidéo (getUserMedia)
 *   - Partage d'écran (getDisplayMedia)
 *   - DataChannel pour l'échange de données P2P (messages, fichiers)
 *   - Signalisation via Socket.io (offer / answer / ICE)
 *   - ICE restart pour récupération de connexion
 *   - Gestion des états : idle → calling → incoming → connecting → active → ended
 *
 * STUN gratuit Google + TURN configurable via .env pour le NAT traversal.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Socket } from "socket.io-client";
import { startRingtone, stopRingtone } from "@/lib/ringtone";

// ── Types ──────────────────────────────────────────────────

export type CallState =
  | "idle"
  | "calling"      // appel sortant en attente
  | "incoming"     // appel entrant en attente de décision
  | "connecting"   // WebRTC en cours de connexion
  | "active"       // appel en cours
  | "ended";       // appel terminé

export type CallType = "audio" | "video";

export interface IncomingCallInfo {
  callerId: string;
  callerName: string;
  callType: CallType;
  roomId: string;
}

export interface UseCallOptions {
  socket: Socket | null;
  roomId: string;
  currentUserId: string;
  currentUserName: string;
}

// ── ICE (STUN/TURN) servers ─────────────────────────────────
// STUN gratuit Google + TURN optionnel via variable d'environnement
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// Ajouter un serveur TURN si configuré dans l'environnement
const turnUrl = typeof window !== "undefined"
  ? process.env.NEXT_PUBLIC_TURN_URL
  : process.env.TURN_URL;
const turnUser = typeof window !== "undefined"
  ? process.env.NEXT_PUBLIC_TURN_USERNAME
  : process.env.TURN_USERNAME;
const turnCred = typeof window !== "undefined"
  ? process.env.NEXT_PUBLIC_TURN_CREDENTIAL
  : process.env.TURN_CREDENTIAL;

if (turnUrl) {
  ICE_SERVERS.push({
    urls: turnUrl,
    username: turnUser || undefined,
    credential: turnCred || undefined,
  });
}

// ── Codecs préférés (ordre de priorité) ────────────────────
const PREFERRED_VIDEO_CODEC = "VP9";
const FALLBACK_VIDEO_CODECS = ["H264", "VP8"];

// ── Constraintes média ─────────────────────────────────────
// Résolution 1080p pour une image plus nette
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { min: 640, ideal: 1920 },
  height: { min: 360, ideal: 1080 },
  frameRate: { ideal: 30 },
};

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// ── Helper : ordonner les codecs SDP par préférence ────────
function setCodecPreferences(sdp: string): string {
  // Ordonner les codecs vidéo : VP9 > H.264 > VP8
  // en déplaçant le rtpmap du codec préféré en tête de section media.
  // Safari supporte H.264 mais pas VP9.
  const allCodecs = [PREFERRED_VIDEO_CODEC, ...FALLBACK_VIDEO_CODECS];
  let result = sdp;

  for (const codec of allCodecs) {
    const match = result.match(new RegExp(`a=rtpmap:(\\d+) ${codec}\\/90000`, "i"));
    if (!match) continue;
    const pt = match[1];
    const lines = result.split("\n");
    const mediaStart = lines.findIndex((l) => l.startsWith("m=video"));
    const rtpmapLine = lines.findIndex((l) => l.includes(`a=rtpmap:${pt}`));
    if (mediaStart >= 0 && rtpmapLine > mediaStart) {
      const [item] = lines.splice(rtpmapLine, 1);
      lines.splice(mediaStart + 1, 0, item);
      result = lines.join("\n");
    }
  }

  // Augmenter le débit binaire vidéo (~2.5 Mbps) pour une image plus nette
  // (b=AS est reconnu par Chrome/Firefox)
  result = result.replace(
    /^(m=video .*\r?\n)/m,
    "$1b=AS:2500\r\n"
  );

  return result;
}

// ── Hook ───────────────────────────────────────────────────
export function useCall({
  socket,
  roomId,
  currentUserId,
  currentUserName,
}: UseCallOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("video");
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isCallingOffline, setIsCallingOffline] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const isCallerRef = useRef(false);
  // Verrou anti-race-condition : empêche hangup() de fermer
  // un PC qui est en cours de configuration asynchrone
  const pcSetupLock = useRef(false);

  // ── Créer le RTCPeerConnection ──────────────────────────
  const createPC = useCallback(
    (role: "caller" | "callee" = "caller") => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // ── Trickle ICE : envoyer les candidats au fur et à mesure ──
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socket) {
          socket.emit("ice_candidate", { roomId, candidate: candidate.toJSON() });
        }
      };

      // ── ICE restart automatique en cas de déconnexion ──────────
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "disconnected" || state === "failed") {
          console.log(`[WebRTC] ICE ${state} → restarting`);
          pc.restartIce();
        }
      };

      // ── Réception des pistes audio/vidéo distantes ────────────
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteStream(stream);
        // srcObject sera défini par le useEffect de synchronisation
      };

      // ── DataChannel pour l'échange de données P2P ────────────
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dataChannelRef.current = dc;
        setupDataChannel(dc);
      };

      // ── Si caller, créer le DataChannel ───────────────────────
      if (role === "caller") {
        const dc = pc.createDataChannel("flexwork-chat", {
          ordered: true,
        });
        dataChannelRef.current = dc;
        setupDataChannel(dc);
      }

      // ── État global de la connexion ───────────────────────────
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") setCallState("active");
        if (state === "failed") {
          console.log("[WebRTC] Connexion failed → tentatives ICE…");
        }
        if (state === "disconnected") {
          console.log("[WebRTC] Connexion interrompue");
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket, roomId]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Configuration du DataChannel ──────────────────────────
  const setupDataChannel = useCallback((dc: RTCDataChannel) => {
    dc.onopen = () => console.log("[WebRTC] DataChannel ouvert");
    dc.onclose = () => console.log("[WebRTC] DataChannel fermé");
    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Les messages reçus via DataChannel sont relayés au state
        if (data.type === "chat_message" && data.conversationId) {
          // Émettre un événement personnalisé pour que le composant chat
          // puisse l'intercepter même sans WS
          window.dispatchEvent(
            new CustomEvent("rtc_message", { detail: data.payload })
          );
        }
      } catch {
        // Message texte brut
        console.log("[WebRTC] DataChannel message:", event.data);
      }
    };
  }, []);

  // ── Obtenir le flux local (caméra/micro) ────────────────
  const getLocalStream = useCallback(async (type: CallType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
        video: type === "video" ? VIDEO_CONSTRAINTS : false,
      });
      localStreamRef.current = stream;
      // Ne pas définir srcObject ici — le DOM n'est pas encore monté.
      // Un useEffect s'en charge quand la ref sera disponible.
      return stream;
    } catch (err: any) {
      const name = err?.name || "";
      let message = "Impossible d'accéder au micro/caméra.";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        message = "Accès micro/caméra refusé. Vérifiez les permissions dans les paramètres de votre navigateur.";
      } else if (name === "NotFoundError") {
        message = "Aucun micro/caméra trouvé. Branchez un périphérique.";
      } else if (name === "NotReadableError") {
        message = "Périphérique audio/vidéo occupé par une autre application.";
      } else if (name === "OverconstrainedError") {
        message = "Aucune caméra ne répond aux critères requis.";
      }
      alert(message);
      throw err;
    }
  }, []);

  // ── Ajouter les pistes locales au PeerConnection ────────
  const addLocalTracks = useCallback(
    (pc: RTCPeerConnection, stream: MediaStream) => {
      if (pc.signalingState === "closed") {
        console.warn("[WebRTC] PC déjà fermé, ajout des pistes ignoré");
        return;
      }
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    },
    []
  );

  // ── 1. Initier un appel (rôle : caller) ────────────────
  const startCall = useCallback(
    async (type: CallType = "video") => {
      if (!socket || callState !== "idle") return;

      setCallType(type);
      setCallState("calling");
      isCallerRef.current = true;

      socket.emit("call_request", {
        roomId,
        callerId: currentUserId,
        callerName: currentUserName,
        callType: type,
      });
    },
    [socket, callState, roomId, currentUserId, currentUserName]
  );

  // ── 2. Accepter un appel entrant ────────────────────────
  const acceptCall = useCallback(async () => {
    if (!socket || !incomingCall) return;

    // Verrouiller AVANT toute opération asynchrone
    pcSetupLock.current = true;
    setCallState("connecting");
    isCallerRef.current = false;

    try {
      const pc = createPC("callee");
      const stream = await getLocalStream(incomingCall.callType);

      if (!pcRef.current || pcRef.current.signalingState === "closed") {
        console.warn("[WebRTC] PC fermé pendant getLocalStream, abandon");
        return;
      }
      addLocalTracks(pcRef.current, stream);
      socket.emit("call_accept", { roomId: incomingCall.roomId });
    } finally {
      pcSetupLock.current = false;
    }
  }, [socket, incomingCall, createPC, getLocalStream, addLocalTracks]);

  // ── Rejeter un appel entrant ────────────────────────────
  const rejectCall = useCallback(() => {
    if (!socket || !incomingCall) return;
    socket.emit("call_reject", { roomId: incomingCall.roomId });
    setIncomingCall(null);
    setCallState("ended");
    setTimeout(() => setCallState("idle"), 2000);
  }, [socket, incomingCall]);

  // ── Raccrocher ──────────────────────────────────────────
  const hangup = useCallback(() => {
    // Ne pas fermer le PC si une configuration asynchrone est en cours
    if (pcSetupLock.current) {
      console.log("[WebRTC] hangup bloqué — setup PC en cours");
      return;
    }
    // Si le caller raccroche sans que l'appel n'ait été accepté → appel manqué
    const wasCalling = callState === "calling";
    const wasIncoming = callState === "incoming";

    if (socket && callState !== "idle") {
      socket.emit("call_hangup", { roomId, reason: callState === "calling" ? "missed" : "manual" });
    }

    // Notifier d'un appel manqué si le caller a appelé mais n'a jamais eu de réponse
    if (wasCalling && socket && roomId) {
      socket.emit("call_missed", {
        roomId,
        callerId: currentUserId,
        callerName: currentUserName,
        callType,
        targetUserId: "",
      });
    }

    // Si l'appelé rejette alors qu'il était en "incoming" → notifier le caller
    if (wasIncoming && socket) {
      socket.emit("call_reject", { roomId });
    }

    pcRef.current?.close();
    pcRef.current = null;

    // Fermer le DataChannel
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setRemoteStream(null);
    setCallState("ended");
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSharingScreen(false);
    setIsCallingOffline(false);

    // Revenir à idle après un court délai (pour afficher l'écran "Terminé")
    setTimeout(() => setCallState("idle"), 2000);
  }, [socket, callState, roomId, currentUserId, currentUserName, callType]);

  // ── Basculer micro ──────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((m) => !m);
  }, []);

  // ── Basculer caméra ─────────────────────────────────────
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsVideoOff((v) => !v);
  }, []);

  // ── Démarrer le partage d'écran ─────────────────────────
  const startScreenShare = useCallback(async () => {
    if (!pcRef.current || isSharingScreen) return;

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
    screenStreamRef.current = screenStream;

    const screenTrack = screenStream.getVideoTracks()[0];

    // Remplacer la piste vidéo dans le sender
    const sender = pcRef.current
      .getSenders()
      .find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(screenTrack);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = screenStream;
    }

    setIsSharingScreen(true);
    socket?.emit("screen_share_started", { roomId });

    // Arrêt automatique quand l'utilisateur clique sur "Arrêter" dans le navigateur
    screenTrack.onended = () => stopScreenShare();
  }, [isSharingScreen, socket, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Arrêter le partage d'écran ──────────────────────────
  const stopScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    const camTrack = localStreamRef.current.getVideoTracks()[0];
    const sender = pcRef.current
      .getSenders()
      .find((s) => s.track?.kind === "video");
    if (sender && camTrack) await sender.replaceTrack(camTrack);

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsSharingScreen(false);
    socket?.emit("screen_share_stopped", { roomId });
  }, [socket, roomId]);

  // ── Gestion des événements Socket.io ───────────────────
  useEffect(() => {
    if (!socket) return;

    // ── Appel entrant ──────────────────────────────────
    const onIncomingCall = (data: IncomingCallInfo) => {
      if (callState !== "idle") return; // Déjà en appel
      setIncomingCall(data);
      setCallType(data.callType);
      setCallState("incoming");
    };

    // ── Appelé accepte (côté caller) ───────────────────
    const onCallAccepted = async () => {
      pcSetupLock.current = true;
      setCallState("connecting");
      try {
        const pc = createPC("caller");
        const stream = await getLocalStream(callType);

        if (pc.signalingState === "closed") {
          console.warn("[WebRTC] PC fermé pendant création d'offre, abandon");
          return;
        }
        addLocalTracks(pc, stream);

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "video",
        });
        const sdp = setCodecPreferences(offer.sdp || "");
        await pc.setLocalDescription({ type: "offer", sdp });
        socket.emit("call_offer", { roomId, offer: pc.localDescription! });
      } finally {
        pcSetupLock.current = false;
      }
    };

    // ── Appelé refuse ──────────────────────────────────
    const onCallRejected = () => {
      setCallState("ended");
      setTimeout(() => setCallState("idle"), 2000);
    };

    // ── Offer reçue (côté callee) ──────────────────────
    const onCallOffer = async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      pcSetupLock.current = true;
      try {
        // Utiliser le PC déjà créé par acceptCall plutôt que d'en créer un nouveau
        // (évite de perdre les pistes locales déjà ajoutées)
        const pc = pcRef.current || createPC("callee");
        const stream = localStreamRef.current || await getLocalStream(callType);

        // Si c'est un nouveau PC (pas de stream pré-existant), ajouter les pistes
        if (!localStreamRef.current) {
          addLocalTracks(pc, stream);
        }

        if (pc.signalingState === "closed") {
          console.warn("[WebRTC] PC fermé pendant traitement offer, abandon");
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        const answerSdp = setCodecPreferences(answer.sdp || "");
        await pc.setLocalDescription({ type: "answer", sdp: answerSdp });
        socket.emit("call_answer", { roomId, answer: pc.localDescription! });
        setCallState("active");
      } finally {
        pcSetupLock.current = false;
      }
    };

    // ── Answer reçue (côté caller) ─────────────────────
    const onCallAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      await pcRef.current?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    };

    // ── Candidat ICE reçu ──────────────────────────────
    const onIceCandidate = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore */ }
    };

    // ── Appel raccroché par l'autre ─────────────────────
    const onCallEnded = hangup;

    // ── Le destinataire est hors ligne (caller) ────────
    const onCallRemoteOffline = () => {
      setCallState("ended");
      setIsCallingOffline(true);
      setTimeout(() => {
        setCallState("idle");
        setIsCallingOffline(false);
      }, 3000);
    };

    // ── L'appel manqué a bien été notifié ──────────────
    const onCallMissedAck = () => {
      setCallState("ended");
      setTimeout(() => setCallState("idle"), 2000);
    };

    // ── Partage d'écran ────────────────────────────────
    const onScreenShareStarted = () => setIsSharingScreen(true);
    const onScreenShareStopped = () => setIsSharingScreen(false);

    socket.on("incoming_call", onIncomingCall);
    socket.on("call_accepted", onCallAccepted);
    socket.on("call_rejected", onCallRejected);
    socket.on("call_offer", onCallOffer);
    socket.on("call_answer", onCallAnswer);
    socket.on("ice_candidate", onIceCandidate);
    socket.on("call_ended", onCallEnded);
    socket.on("call_remote_offline", onCallRemoteOffline);
    socket.on("call_missed_ack", onCallMissedAck);
    socket.on("screen_share_started", onScreenShareStarted);
    socket.on("screen_share_stopped", onScreenShareStopped);

    return () => {
      socket.off("incoming_call", onIncomingCall);
      socket.off("call_accepted", onCallAccepted);
      socket.off("call_rejected", onCallRejected);
      socket.off("call_offer", onCallOffer);
      socket.off("call_answer", onCallAnswer);
      socket.off("ice_candidate", onIceCandidate);
      socket.off("call_ended", onCallEnded);
      socket.off("call_remote_offline", onCallRemoteOffline);
      socket.off("call_missed_ack", onCallMissedAck);
      socket.off("screen_share_started", onScreenShareStarted);
      socket.off("screen_share_stopped", onScreenShareStopped);
    };
  }, [
    socket,
    roomId,
    callState,
    callType,
    createPC,
    getLocalStream,
    addLocalTracks,
    hangup,
  ]);

  // ── Synchroniser le flux distant vers la <video> distante ──
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  // ── Synchroniser le flux local vers la <video> locale ──────
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [callState, localStreamRef.current !== null]);

  // ── Sonnerie ──────────────────────────────────────────────
  useEffect(() => {
    if (callState === "incoming" || callState === "calling") {
      startRingtone();
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [callState]);

  // ── Envoyer un message via DataChannel P2P ─────────────
  const sendDataChannelMessage = useCallback(
    (type: string, payload: unknown) => {
      const dc = dataChannelRef.current;
      if (dc?.readyState === "open") {
        dc.send(JSON.stringify({ type, payload }));
        return true;
      }
      return false; // DataChannel pas disponible → utiliser WS
    },
    []
  );

  return {
    callState,
    callType,
    incomingCall,
    isMuted,
    isVideoOff,
    isSharingScreen,
    isCallingOffline,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    sendDataChannelMessage,
    isDataChannelOpen: dataChannelRef.current?.readyState === "open",
  };
}
