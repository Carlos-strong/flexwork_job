/**
 * 🌀 Lanceur du serveur TURN/STUN
 *
 * Essaye Docker (coturn) d'abord, sinon guide l'utilisateur.
 * Le WebRTC fonctionne avec STUN seul dans la majorité des cas ;
 * TURN n'est nécessaire qu'en NAT symétrique (rare en local).
 *
 * Utilisation :
 *   npm run turn
 *
 * Configuration .env :
 *   NEXT_PUBLIC_TURN_URL="turn:localhost:3478"
 *   NEXT_PUBLIC_TURN_USERNAME="flexwork"
 *   NEXT_PUBLIC_TURN_CREDENTIAL="flexwork123"
 */

const { execSync, spawn } = require("child_process");

const PORT = process.env.TURN_PORT || "3478";
const USERNAME = process.env.TURN_USERNAME || process.env.NEXT_PUBLIC_TURN_USERNAME || "flexwork";
const CREDENTIAL = process.env.TURN_CREDENTIAL || process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "flexwork123";

console.log([ "",
  "╔══════════════════════════════════════════════════════════╗",
  "║  🌀 Configuration TURN/STUN pour WebRTC                ║",
  "║  ──────────────────────────                             ║",
  "║  URL  : turn:localhost:" + PORT.padEnd(4) + "                               ║",
  "║  User : " + (USERNAME + "@localhost").padEnd(39) + "║",
  "║  Pass : " + CREDENTIAL.padEnd(39) + "║",
  "╚══════════════════════════════════════════════════════════╝"
].join("\n"));

// 1. Essayer Docker (coturn)
try {
  console.log("\n🔍 Vérification de Docker…");
  execSync("docker info", { stdio: "ignore" });
  console.log("✅ Docker disponible → lancement de coturn");
  const child = spawn("docker", [
    "run", "--rm", "--network", "host", "--name", "flexwork-coturn",
    "coturn/coturn",
    "-n", "--log-file=stdout", "--lt-cred-mech", "--realm=localhost",
    "--user=" + USERNAME + ":" + CREDENTIAL,
    "--min-port=49152", "--max-port=65535",
    "--fingerprint", "--no-tls", "--no-dtls",
  ], { stdio: "inherit" });
  process.on("SIGINT", () => child.kill());
  process.on("SIGTERM", () => child.kill());
  return;
} catch { console.log("⚠️  Docker non disponible"); }

// 2. Pas de Docker
console.log([ "",
  "╔══════════════════════════════════════════════════════════╗",
  "║  ⚠️  Serveur TURN non démarré                           ║",
  "║                                                         ║",
  "║  Le WebRTC fonctionne avec STUN seul dans ~90% des cas. ║",
  "║  Si besoin de TURN (NAT symétrique) :                   ║",
  "║                                                         ║",
  "║  • Docker Desktop : docker compose --profile turn up    ║",
  "║  • WSL : sudo apt install coturn                        ║",
  "║    turnserver -n -a -f --realm=localhost                 ║",
  "║      --user=" + USERNAME + ":" + CREDENTIAL + "              ║",
  "║      --no-tls --no-dtls                                  ║",
  "║                                                         ║",
  "║  Serveurs STUN Google déjà configurés (fallback).       ║",
  "╚══════════════════════════════════════════════════════════╝"
].join("\n"));
