/**
 * Payment Module — Façade unifiée
 *
 * Regroupe tous les services de paiement :
 *   - VirtualCard : Paiements de test / dev (cartes Visa virtuelles)
 *   - Stripe Escrow : Paiements réels via Stripe Connect
 *   - TrustEngine Escrow : Séquestre contractuel et milestones
 *
 * Le choix du provider se fait automatiquement selon l'environnement :
 *   - Développement / Test : VirtualCard (KYC Différé, pas de documents requis)
 *   - Production : Stripe + TrustEngine
 */

import { virtualCardService } from "./virtual-card";

export { virtualCardService } from "./virtual-card";
export type {
  VirtualCardData,
  VirtualCardTransactionData,
  VirtualCardCreateParams,
  VirtualCardPayParams,
} from "./virtual-card";

/**
 * Détecte si on doit utiliser les cartes virtuelles de test.
 * En développement, on évite d'appeler Stripe pour les tests.
 */
export function isVirtualCardEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VIRTUAL_CARD_ENABLED === "true" ||
    !process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY === "sk_test_xxxxxxxx"
  );
}
