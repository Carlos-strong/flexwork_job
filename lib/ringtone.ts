/**
 * Sonnerie d'appel générée via Web Audio API.
 * Aucun fichier audio externe nécessaire.
 *
 * Pattern : tonalité téléphone classique (440Hz + 480Hz)
 *   - 2s son → 2s silence → répète
 */

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let osc1: OscillatorNode | null = null;
let osc2: OscillatorNode | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let isPlaying = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Démarre la sonnerie (en boucle).
 * Appel sécurisé : ne fait rien si déjà en cours.
 */
export function startRingtone(): void {
  if (isPlaying) return;
  isPlaying = true;

  const ctx = getAudioContext();

  // Gain master avec fondu pour éviter les clics
  gainNode = ctx.createGain();
  gainNode.gain.value = 0;
  gainNode.connect(ctx.destination);

  // Deux oscillateurs pour un son de sonnerie téléphonique réaliste
  osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.value = 440;
  osc1.connect(gainNode);

  osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 480;
  osc2.connect(gainNode);

  osc1.start();
  osc2.start();

  // Pattern : 2s son → 2s silence
  let isRingPhase = true;
  gainNode.gain.setValueAtTime(0.3, ctx.currentTime);

  function scheduleNext() {
    if (!isPlaying || !gainNode) return;
    const now = ctx.currentTime;
    if (isRingPhase) {
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.setValueAtTime(0, now + 2); // Son pendant 2s
    }
    isRingPhase = !isRingPhase;
    timeoutId = setTimeout(scheduleNext, 2000);
  }

  scheduleNext();
}

/**
 * Arrête la sonnerie immédiatement.
 */
export function stopRingtone(): void {
  if (!isPlaying) return;
  isPlaying = false;

  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  try {
    osc1?.stop();
    osc2?.stop();
  } catch {
    // Déjà arrêté
  }

  osc1 = null;
  osc2 = null;
  gainNode = null;

  // Ne pas fermer audioCtx — pourrait être réutilisé
}
