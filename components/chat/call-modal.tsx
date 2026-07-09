"use client";

/**
 * CallModal — Interface complète d'appel audio/vidéo WebRTC.
 *
 * Design : UI sombre et épurée inspirée d'un client d'appel moderne.
 * États : incoming → calling → (connecting) → active → ended → idle
 */

import { useEffect, useRef, useState, RefObject } from "react";
import type { CallState, CallType, IncomingCallInfo } from "@/hooks/use-call";

// ── Constantes ──────────────────────────────────────────
const INITIALS_COLORS = [
  "linear-gradient(155deg,#2DA579,#14523B)",
  "linear-gradient(155deg,#5B6ABF,#2D4182)",
  "linear-gradient(155deg,#D4A243,#8F691C)",
  "linear-gradient(155deg,#BF5B7A,#822D4A)",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
}

// ── Hook : timer d'appel ───────────────────────────────
function useCallTimer(callState: CallState) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (callState === "active") {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (callState === "ended" || callState === "idle") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [callState]);

  const fmt = (s: number) => String(s).padStart(2, "0");
  return {
    display: `${fmt(Math.floor(seconds / 60))}:${fmt(seconds % 60)}`,
    seconds,
  };
}

// ════════════════════════════════════════════════════════════
// ÉCRAN 1 — APPEL ENTRANT
// ════════════════════════════════════════════════════════════
interface IncomingCallProps {
  info: IncomingCallInfo;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallOverlay({ info, onAccept, onReject }: IncomingCallProps) {
  const initials = getInitials(info.callerName);
  const bg = getAvatarColor(info.callerName);

  return (
    <div style={styles.stage}>
      <div style={{ ...styles.screen, alignItems: "center", justifyContent: "space-between", padding: "clamp(24px,6vh,64px) 20px" }}>
        {/* Top */}
        <div style={{ textAlign: "center", paddingTop: 12 }}>
          <p style={styles.eyebrow}>
            <span style={styles.liveDot} />
            Appel entrant
          </p>
        </div>

        {/* Center */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={styles.avatarWrap}>
            <div style={{ ...styles.ring, animationDelay: "0s" }} />
            <div style={{ ...styles.ring, animationDelay: ".8s" }} />
            <div style={{ ...styles.ring, animationDelay: "1.6s" }} />
            <div style={{ ...styles.avatar, background: bg }}>{initials}</div>
          </div>
          <div style={{ textAlign: "center", marginTop: 22 }}>
            <p style={styles.callerName}>{info.callerName}</p>
            <p style={styles.callerSub}>Appel {info.callType === "video" ? "vidéo" : "audio"}</p>
          </div>
          <div style={styles.wave}>
            <span style={{ ...styles.waveBar, height: 6, animationDelay: "0s" }} />
            <span style={{ ...styles.waveBar, height: 14, animationDelay: ".12s" }} />
            <span style={{ ...styles.waveBar, height: 20, animationDelay: ".24s" }} />
            <span style={{ ...styles.waveBar, height: 10, animationDelay: ".36s" }} />
            <span style={{ ...styles.waveBar, height: 16, animationDelay: ".48s" }} />
          </div>
        </div>

        {/* Bottom actions */}
        <div style={styles.incomingActions}>
          <button onClick={onReject} style={styles.declineBtn}>
            ✕
            <span style={styles.btnLabel}>Refuser</span>
          </button>
          <button onClick={onAccept} style={styles.acceptBtn}>
            ✆
            <span style={styles.btnLabel}>Accepter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ÉCRAN 1b — APPEL SORTANT (en attente)
// ════════════════════════════════════════════════════════════
function CallingScreen({
  otherPartyName,
  onHangup,
}: {
  otherPartyName: string;
  onHangup: () => void;
}) {
  const initials = getInitials(otherPartyName);
  const bg = getAvatarColor(otherPartyName);

  return (
    <div style={styles.stage}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 18 }}>
        <div style={styles.avatarWrap}>
          <div style={{ ...styles.ring, animationDelay: "0s" }} />
          <div style={{ ...styles.ring, animationDelay: ".8s" }} />
          <div style={{ ...styles.ring, animationDelay: "1.6s" }} />
          <div style={{ ...styles.avatar, background: bg }}>{initials}</div>
        </div>
        <p style={{ ...styles.callerName, marginTop: 8 }}>{otherPartyName}</p>
        <p style={{ fontSize: 13.5, color: "#8B93B0", margin: 0, animation: "pulse 1.4s ease-in-out infinite" }}>Appel en cours...</p>
        <button onClick={onHangup} style={{ ...styles.declineBtn, marginTop: 40 }}>
          ✕
          <span style={styles.btnLabel}>Raccrocher</span>
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ÉCRAN 2 — APPEL ACTIF
// ════════════════════════════════════════════════════════════
interface ActiveCallProps {
  callType: CallType;
  otherPartyName: string;
  currentUserName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSharingScreen: boolean;
  timerDisplay: string;
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
}

function ActiveCallScreen({
  callType,
  otherPartyName,
  currentUserName,
  isMuted,
  isVideoOff,
  isSharingScreen,
  timerDisplay,
  localVideoRef,
  remoteVideoRef,
  onHangup,
  onToggleMute,
  onToggleVideo,
  onToggleScreen,
}: ActiveCallProps) {
  const initials = getInitials(otherPartyName);
  const bg = getAvatarColor(otherPartyName);

  return (
    <div style={styles.stage}>
      {/* Remote video */}
      <div style={styles.remoteVideo}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div style={{ ...styles.avatar, width: "clamp(90px,20vw,140px)", height: "clamp(90px,20vw,140px)", fontSize: "clamp(28px,6vw,44px)", background: bg, position: "absolute", zIndex: 0, pointerEvents: "none" }}>
          {initials}
        </div>
      </div>

      {/* Top bar */}
      <div style={styles.topBar}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>{otherPartyName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: "#8B93B0" }}>{currentUserName}</span>
            <span style={{ fontSize: 11, color: "#5A5F7A" }}>avec</span>
            <span style={{ fontSize: 11.5, color: "#8B93B0" }}>{otherPartyName}</span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#8B93B0", marginTop: 2 }}>{timerDisplay}</div>
        </div>
        <div style={styles.recPill}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#C23B3B", marginRight: 6, animation: "blink 1.4s ease-in-out infinite" }} />
          Chiffr&eacute;
        </div>
      </div>

      {/* Self-view PiP */}
      <div style={styles.selfView}>
        {callType === "video" ? (
          <>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
            />
            {isVideoOff && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#243050,#151F38)", borderRadius: 12, color: "#8B93B0", fontSize: 13 }}>
                Vous
              </div>
            )}
          </>
        ) : (
          <span>Vous</span>
        )}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button onClick={onToggleMute} style={{ ...styles.ctrlBtn, ...(isMuted ? styles.ctrlOff : {}) }} title={isMuted ? "Activer micro" : "Couper micro"}>
          {isMuted ? "\u{1F507}" : "\u{1F399}\u{FE0F}"}
        </button>
        {callType === "video" && (
          <button onClick={onToggleVideo} style={{ ...styles.ctrlBtn, ...(isVideoOff ? styles.ctrlOff : {}) }} title={isVideoOff ? "Activer cam\u00e9ra" : "Couper cam\u00e9ra"}>
            {"\u{1F4F7}"}
          </button>
        )}
        <button onClick={onToggleScreen} style={{ ...styles.ctrlBtn, ...(isSharingScreen ? { background: "rgba(45,165,121,0.85)", borderColor: "transparent" } : {}) }} title={isSharingScreen ? "Arr\u00eater le partage" : "Partager l'\u00e9cran"}>
          {"\u{1F5A5}\u{FE0F}"}
        </button>
        <button onClick={onHangup} style={styles.endBtn} title="Raccrocher">
          {"\u23FB"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ÉCRAN 3 — APPEL TERMINÉ
// ════════════════════════════════════════════════════════════
function EndedScreen({ timerDisplay, wasRejected }: { timerDisplay: string; wasRejected: boolean }) {
  return (
    <div style={{ ...styles.stage, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: wasRejected ? "rgba(194,59,59,0.15)" : "#E4F1EC",
          color: wasRejected ? "#C23B3B" : "#1F7A5C",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, marginBottom: 6,
        }}>
          {wasRejected ? "\u2715" : "\u2713"}
        </div>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 500, fontSize: "clamp(20px,5vw,26px)", margin: 0, color: "#EDEFF5" }}>
          {wasRejected ? "Appel refus\u00e9" : "Appel termin\u00e9"}
        </h2>
        {!wasRejected && (
          <p style={{ color: "#8B93B0", fontSize: 13.5, margin: 0 }}>
            Dur\u00e9e de l&apos;appel : <strong>{timerDisplay}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════
interface CallModalProps {
  callState: CallState;
  callType: CallType;
  incomingCall: IncomingCallInfo | null;
  otherPartyName: string;
  currentUserName: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isSharingScreen: boolean;
  isCallingOffline?: boolean;
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
}

export function CallModal({
  callState,
  callType,
  incomingCall,
  otherPartyName,
  currentUserName,
  isMuted,
  isVideoOff,
  isSharingScreen,
  isCallingOffline,
  localVideoRef,
  remoteVideoRef,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleVideo,
  onToggleScreen,
}: CallModalProps) {
  const { display: timerDisplay, seconds } = useCallTimer(callState);

  if (callState === "idle") return null;

  // Hors ligne
  if (isCallingOffline) {
    return (
      <div style={styles.stage}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 16, padding: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>{"\u{1F634}"}</div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 500, fontSize: "clamp(20px,5vw,26px)", margin: 0, color: "#EDEFF5" }}>
            Destinataire hors ligne
          </h2>
          <p style={{ color: "#8B93B0", fontSize: 13.5, margin: 0, maxWidth: 280 }}>
            {otherPartyName} n&apos;est pas connect\u00e9(e) pour le moment.
          </p>
          <p style={{ color: "#8B93B0", fontSize: 12, margin: 0, opacity: 0.6 }}>
            Une notification d&apos;appel manqu\u00e9 lui a \u00e9t\u00e9 envoy\u00e9e.
          </p>
        </div>
      </div>
    );
  }

  if (callState === "incoming" && incomingCall) {
    return <IncomingCallOverlay info={incomingCall} onAccept={onAccept} onReject={onReject} />;
  }

  if (callState === "calling" || callState === "connecting") {
    return <CallingScreen otherPartyName={otherPartyName} onHangup={onHangup} />;
  }

  if (callState === "active") {
    return (
      <ActiveCallScreen
        callType={callType}
        otherPartyName={otherPartyName}
        currentUserName={currentUserName}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isSharingScreen={isSharingScreen}
        timerDisplay={timerDisplay}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        onHangup={onHangup}
        onToggleMute={onToggleMute}
        onToggleVideo={onToggleVideo}
        onToggleScreen={onToggleScreen}
      />
    );
  }

  if (callState === "ended") {
    return <EndedScreen timerDisplay={timerDisplay} wasRejected={seconds === 0} />;
  }

  return null;
}

// ════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  stage: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    overflow: "hidden",
    background: [
      "radial-gradient(circle at 20% 15%, rgba(31,122,92,0.25), transparent 55%)",
      "radial-gradient(circle at 85% 80%, rgba(21,31,56,0.9), transparent 50%)",
      "linear-gradient(160deg, #0D1526 0%, #131E38 60%, #0D1526 100%)",
    ].join(","),
    fontFamily: "'Inter', sans-serif",
    color: "#EDEFF5",
  },
  screen: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
  },
  eyebrow: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11.5,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "#8B93B0",
    margin: "0 0 6px",
  },
  liveDot: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#2DA579",
    marginRight: 6,
    animation: "blink 1.4s ease-in-out infinite",
  },
  avatarWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "clamp(150px,32vw,220px)",
    height: "clamp(150px,32vw,220px)",
  },
  ring: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "1.5px solid rgba(45,165,121,0.55)",
    animation: "pulse-ring 2.4s ease-out infinite",
  },
  avatar: {
    width: "70%",
    height: "70%",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Fraunces', serif",
    fontWeight: 500,
    fontSize: "clamp(28px,7vw,42px)",
    color: "#fff",
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    zIndex: 2,
  },
  callerName: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 500,
    fontSize: "clamp(22px,5vw,30px)",
    margin: "0 0 6px",
    letterSpacing: "-0.01em",
    color: "#EDEFF5",
  },
  callerSub: {
    fontSize: 13.5,
    color: "#8B93B0",
    margin: 0,
  },
  wave: {
    display: "flex",
    alignItems: "flex-end",
    gap: 3,
    height: 20,
    marginTop: 18,
    justifyContent: "center",
  },
  waveBar: {
    width: 3,
    background: "#2DA579",
    borderRadius: 2,
    animation: "wave 1.1s ease-in-out infinite",
  },
  incomingActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(36px,10vw,72px)",
    padding: "20px 16px clamp(18px,4vh,30px)",
    width: "100%",
  },
  declineBtn: {
    width: "clamp(58px,14vw,68px)",
    height: "clamp(58px,14vw,68px)",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(20px,5vw,24px)",
    color: "#fff",
    background: "#C23B3B",
    boxShadow: "0 8px 26px rgba(194,59,59,0.45)",
    position: "relative" as const,
  },
  acceptBtn: {
    width: "clamp(58px,14vw,68px)",
    height: "clamp(58px,14vw,68px)",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "clamp(20px,5vw,24px)",
    color: "#fff",
    background: "#2DA579",
    boxShadow: "0 8px 26px rgba(45,165,121,0.45)",
    animation: "jiggle 2.6s ease-in-out infinite",
    position: "relative" as const,
  },
  btnLabel: {
    position: "absolute",
    bottom: -24,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 11,
    color: "#8B93B0",
    whiteSpace: "nowrap" as const,
  },
  remoteVideo: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: [
      "radial-gradient(circle at 30% 30%, rgba(31,122,92,0.35), transparent 60%)",
      "linear-gradient(160deg, #182645, #0D1526 70%)",
    ].join(","),
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "clamp(14px,3vh,22px) clamp(16px,4vw,28px)",
    background: "linear-gradient(180deg, rgba(13,21,38,0.85), transparent)",
  },
  recPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', monospace",
    background: "rgba(255,255,255,0.08)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.12)",
    padding: "5px 11px",
    borderRadius: 20,
    color: "#8B93B0",
  },
  selfView: {
    position: "absolute",
    top: "clamp(70px,12vh,96px)",
    right: "clamp(14px,3vw,24px)",
    width: "clamp(84px,22vw,140px)",
    aspectRatio: "3/4",
    background: "linear-gradient(160deg,#243050,#151F38)",
    borderRadius: 12,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Fraunces', serif",
    color: "#8B93B0",
    fontSize: 13,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "clamp(10px,2.4vw,18px)",
    padding: "clamp(18px,4vh,30px) 16px",
    background: "linear-gradient(0deg, rgba(13,21,38,0.9), transparent)",
    flexWrap: "wrap" as const,
  },
  ctrlBtn: {
    width: "clamp(46px,11vw,54px)",
    height: "clamp(46px,11vw,54px)",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.12)",
    color: "#EDEFF5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    cursor: "pointer",
    transition: "background .15s ease, transform .12s ease",
  },
  ctrlOff: {
    background: "rgba(194,59,59,0.85)",
    borderColor: "transparent",
  },
  endBtn: {
    width: "clamp(58px,13vw,66px)",
    height: "clamp(58px,13vw,66px)",
    borderRadius: "50%",
    background: "#C23B3B",
    border: "none",
    color: "#EDEFF5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    cursor: "pointer",
  },
};

// ── Injecter les @keyframes une seule fois ─────────────
const styleSheetId = "call-modal-keyframes";

function injectKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(styleSheetId)) return;
  const style = document.createElement("style");
  style.id = styleSheetId;
  style.textContent = [
    "@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }",
    "@keyframes pulse-ring {",
    "  0% { transform: scale(0.75); opacity: 0; }",
    "  15% { opacity: .9; }",
    "  100% { transform: scale(1.55); opacity: 0; }",
    "}",
    "@keyframes wave {",
    "  0%,100% { transform: scaleY(0.4); }",
    "  50% { transform: scaleY(1); }",
    "}",
    "@keyframes jiggle {",
    "  0%,92%,100% { transform: rotate(0); }",
    "  94% { transform: rotate(-8deg); }",
    "  96% { transform: rotate(8deg); }",
    "  98% { transform: rotate(-4deg); }",
    "}",
    "@keyframes pulse {",
    "  0%,100% { opacity: 1; }",
    "  50% { opacity: .5; }",
    "}",
  ].join("\n");
  document.head.appendChild(style);
}

if (typeof window !== "undefined") {
  setTimeout(injectKeyframes, 0);
}
