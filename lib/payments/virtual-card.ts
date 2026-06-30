/**
 * Virtual Visa Card — Moteur de paiement de test
 *
 * Permet de simuler des transactions par carte bancaire sans Stripe réel.
 * Idéal pour le développement local et les tests automatisés.
 *
 * 🔑 Principe KYC Différé :
 *   - Aucune pièce d'identité exigée pour créer une carte de test
 *   - La carte est préchargée avec un solde fictif (10 000 € par défaut)
 *   - Utilisable immédiatement après la création du compte
 *
 * 💳 Format des cartes générées :
 *   - Numéro : 4532 01XX XXXX XXXX (plage BIN 453201 = Visa test)
 *   - CVV : 3 chiffres aléatoires
 *   - Expiration : +3 ans
 */

// ── Types ──────────────────────────────────────

export interface VirtualCardData {
  id: string;
  userId: string;
  cardNumber: string;       // Masqué : 4532 01** **** 1234
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  brand: string;
  balance: number;
  initialBalance: number;
  currency: string;
  isActive: boolean;
  label: string | null;
  isTestCard: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualCardTransactionData {
  id: string;
  virtualCardId: string;
  type: "DEPOSIT" | "RELEASE" | "PAYOUT" | "REFUND";
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  contractId: string | null;
  missionTitle: string | null;
  description: string | null;
  balanceBefore: number;
  balanceAfter: number;
  stripePaymentId: string | null;
  createdAt: string;
}

export interface VirtualCardCreateParams {
  userId: string;
  cardholderName: string;
  label?: string;
  initialBalance?: number;
  currency?: string;
}

export interface VirtualCardPayParams {
  virtualCardId: string;
  amount: number;
  currency?: string;
  contractId?: string;
  missionTitle?: string;
  description?: string;
}

// ── Constantes ─────────────────────────────────

const VISA_TEST_BIN = "453201"; // BIN de test Visa
const DEFAULT_BALANCE = 10000;  // 10 000 € par défaut
const EXPIRY_YEARS = 3;        // Validité 3 ans

// ── Store en mémoire (dev) — remplaçable par Prisma ──

interface CardRecord {
  id: string;
  userId: string;
  cardNumber: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  brand: string;
  balance: number;
  initialBalance: number;
  currency: string;
  isActive: boolean;
  label: string | null;
  isTestCard: boolean;
  usedInProduction: boolean;
  createdAt: Date;
  updatedAt: Date;
  transactions: TransactionRecord[];
}

interface TransactionRecord {
  id: string;
  virtualCardId: string;
  type: "DEPOSIT" | "RELEASE" | "PAYOUT" | "REFUND";
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  contractId: string | null;
  missionTitle: string | null;
  description: string | null;
  balanceBefore: number;
  balanceAfter: number;
  stripePaymentId: string | null;
  createdAt: Date;
}

const virtualCards: Map<string, CardRecord> = new Map();
const transactions: Map<string, TransactionRecord> = new Map();

// ── Utilitaires ────────────────────────────────

function generateId(): string {
  return `vc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateTxId(): string {
  return `vctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Génère un numéro de carte Visa valide (algorithme de Luhn).
 * Format : 4532 01XX XXXX XXXX (BIN = 453201 = plage test Visa)
 */
function generateCardNumber(): string {
  const prefix = VISA_TEST_BIN;
  // 9 chiffres aléatoires
  let partial = prefix;
  for (let i = 0; i < 9; i++) {
    partial += Math.floor(Math.random() * 10).toString();
  }
  // Calcul du checksum Luhn
  const digits = partial.split("").map(Number);
  const checkDigit = computeLuhnCheckDigit(digits);
  return partial + checkDigit;
}

function computeLuhnCheckDigit(digits: number[]): number {
  let sum = 0;
  let alternate = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (alternate) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alternate = !alternate;
  }
  return (10 - (sum % 10)) % 10;
}

function formatCardNumber(raw: string): string {
  return raw.replace(/(.{4})/g, "$1 ").trim();
}

function maskCardNumber(raw: string): string {
  return raw.slice(0, 6) + "******" + raw.slice(-4);
}

function generateCVV(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

// ── Service ────────────────────────────────────

export const virtualCardService = {
  /**
   * Crée une carte Visa virtuelle pour un utilisateur.
   * Aucun document requis (KYC Différé) — la carte est utilisable immédiatement.
   *
   * @example
   *   const card = await virtualCardService.create({
   *     userId: "user_abc",
   *     cardholderName: "Jean Dupont",
   *     label: "Carte test UMA",
   *     initialBalance: 5000,
   *   });
   */
  async create(params: VirtualCardCreateParams): Promise<VirtualCardData> {
    console.log(`[VirtualCard] 💳 Création carte pour ${params.cardholderName}`);

    const now = new Date();
    const card: CardRecord = {
      id: generateId(),
      userId: params.userId,
      cardNumber: generateCardNumber(),
      cardholderName: params.cardholderName,
      expiryMonth: now.getMonth() + 1,
      expiryYear: now.getFullYear() + EXPIRY_YEARS,
      cvv: generateCVV(),
      brand: "Visa",
      balance: params.initialBalance ?? DEFAULT_BALANCE,
      initialBalance: params.initialBalance ?? DEFAULT_BALANCE,
      currency: params.currency ?? "EUR",
      isActive: true,
      label: params.label ?? null,
      isTestCard: true,
      usedInProduction: false,
      createdAt: now,
      updatedAt: now,
      transactions: [],
    };

    virtualCards.set(card.id, card);

    console.log(`[VirtualCard] ✅ Carte créée : ${maskCardNumber(card.cardNumber)} (${card.balance} ${card.currency})`);

    return this.toData(card);
  },

  /**
   * Récupère une carte par son ID.
   */
  async getById(cardId: string): Promise<VirtualCardData | null> {
    const card = virtualCards.get(cardId);
    if (!card) return null;
    return this.toData(card);
  },

  /**
   * Liste les cartes d'un utilisateur.
   */
  async listByUser(userId: string): Promise<VirtualCardData[]> {
    const cards = Array.from(virtualCards.values())
      .filter((c) => c.userId === userId)
      .map((c) => this.toData(c));
    return cards;
  },

  /**
   * Effectue un paiement avec une carte virtuelle.
   * Simule une transaction Visa réelle.
   *
   * Flow :
   *   1. Vérifie que la carte existe et est active
   *   2. Vérifie le solde disponible
   *   3. Débite le montant
   *   4. Enregistre la transaction
   *   5. Retourne le reçu
   *
   * @throws {Error} si solde insuffisant ou carte inactive
   */
  async pay(params: VirtualCardPayParams): Promise<{
    success: boolean;
    transaction: VirtualCardTransactionData;
    receipt: {
      transactionId: string;
      maskedCard: string;
      amount: number;
      currency: string;
      description: string | null;
      timestamp: string;
      authorizationCode: string;
    };
  }> {
    console.log(`[VirtualCard] 💸 Paiement de ${params.amount} € sur carte ${params.virtualCardId}`);

    const card = virtualCards.get(params.virtualCardId);
    if (!card) {
      throw new Error(`Carte virtuelle introuvable : ${params.virtualCardId}`);
    }
    if (!card.isActive) {
      throw new Error("Carte virtuelle désactivée");
    }
    if (card.balance < params.amount) {
      throw new Error(
        `Solde insuffisant : ${card.balance} ${card.currency} (besoin de ${params.amount} ${card.currency})`
      );
    }

    const currency = params.currency ?? card.currency;
    const balanceBefore = card.balance;
    const balanceAfter = card.balance - params.amount;

    // Simule l'autorisation bancaire
    const authorizationCode = `AUTH${Date.now().toString(36).toUpperCase()}`;

    const tx: TransactionRecord = {
      id: generateTxId(),
      virtualCardId: card.id,
      type: "RELEASE",
      amount: params.amount,
      currency,
      status: "SUCCEEDED",
      contractId: params.contractId ?? null,
      missionTitle: params.missionTitle ?? null,
      description: params.description ?? null,
      balanceBefore,
      balanceAfter,
      stripePaymentId: null,
      createdAt: new Date(),
    };

    // Mise à jour du solde
    card.balance = balanceAfter;
    card.updatedAt = new Date();
    card.transactions.push(tx);
    transactions.set(tx.id, tx);

    console.log(`[VirtualCard] ✅ Paiement autorisé : ${authorizationCode}`);
    console.log(`[VirtualCard]   → Nouveau solde : ${balanceAfter} ${currency}`);

    return {
      success: true,
      transaction: this.txToData(tx),
      receipt: {
        transactionId: tx.id,
        maskedCard: maskCardNumber(card.cardNumber),
        amount: params.amount,
        currency,
        description: params.description ?? null,
        timestamp: tx.createdAt.toISOString(),
        authorizationCode,
      },
    };
  },

  /**
   * Crédite le solde d'une carte (simule un virement entrant).
   * Utilisé pour recharger une carte de test.
   */
  async deposit(params: {
    virtualCardId: string;
    amount: number;
    currency?: string;
    description?: string;
  }): Promise<VirtualCardTransactionData> {
    const card = virtualCards.get(params.virtualCardId);
    if (!card) {
      throw new Error(`Carte virtuelle introuvable : ${params.virtualCardId}`);
    }
    if (!card.isActive) {
      throw new Error("Carte virtuelle désactivée");
    }

    const currency = params.currency ?? card.currency;
    const balanceBefore = card.balance;
    const balanceAfter = card.balance + params.amount;

    const tx: TransactionRecord = {
      id: generateTxId(),
      virtualCardId: card.id,
      type: "DEPOSIT",
      amount: params.amount,
      currency,
      status: "SUCCEEDED",
      contractId: null,
      missionTitle: null,
      description: params.description ?? "Dépôt sur carte virtuelle",
      balanceBefore,
      balanceAfter,
      stripePaymentId: null,
      createdAt: new Date(),
    };

    card.balance = balanceAfter;
    card.updatedAt = new Date();
    card.transactions.push(tx);
    transactions.set(tx.id, tx);

    return this.txToData(tx);
  },

  /**
   * Rembourse une transaction (crédite le solde de la carte).
   */
  async refund(params: {
    virtualCardId: string;
    amount: number;
    currency?: string;
    originalTransactionId?: string;
    description?: string;
  }): Promise<VirtualCardTransactionData> {
    const card = virtualCards.get(params.virtualCardId);
    if (!card) {
      throw new Error(`Carte virtuelle introuvable : ${params.virtualCardId}`);
    }
    if (!card.isActive) {
      throw new Error("Carte virtuelle désactivée");
    }

    const currency = params.currency ?? card.currency;
    const balanceBefore = card.balance;
    const balanceAfter = card.balance + params.amount;

    const tx: TransactionRecord = {
      id: generateTxId(),
      virtualCardId: card.id,
      type: "REFUND",
      amount: params.amount,
      currency,
      status: "REFUNDED",
      contractId: null,
      missionTitle: null,
      description: params.description ?? "Remboursement sur carte virtuelle",
      balanceBefore,
      balanceAfter,
      stripePaymentId: null,
      createdAt: new Date(),
    };

    card.balance = balanceAfter;
    card.updatedAt = new Date();
    card.transactions.push(tx);
    transactions.set(tx.id, tx);

    return this.txToData(tx);
  },

  /**
   * Désactive une carte (plus utilisable pour les paiements).
   */
  async deactivate(cardId: string): Promise<void> {
    const card = virtualCards.get(cardId);
    if (!card) {
      throw new Error(`Carte virtuelle introuvable : ${cardId}`);
    }
    card.isActive = false;
    card.updatedAt = new Date();
    console.log(`[VirtualCard] 🔒 Carte ${maskCardNumber(card.cardNumber)} désactivée`);
  },

  /**
   * Récupère l'historique des transactions d'une carte.
   */
  async getTransactions(cardId: string): Promise<VirtualCardTransactionData[]> {
    const card = virtualCards.get(cardId);
    if (!card) return [];
    return card.transactions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((tx) => this.txToData(tx));
  },

  /**
   * Réinitialise le solde d'une carte à son montant initial.
   * Utile pour les cycles de test.
   */
  async resetBalance(cardId: string): Promise<VirtualCardData> {
    const card = virtualCards.get(cardId);
    if (!card) {
      throw new Error(`Carte virtuelle introuvable : ${cardId}`);
    }
    card.balance = card.initialBalance;
    card.updatedAt = new Date();
    console.log(`[VirtualCard] 🔄 Solde réinitialisé : ${card.balance} ${card.currency}`);
    return this.toData(card);
  },

  /**
   * Retourne le nombre de cartes actives (pour debug/admin).
   */
  getStats(): { totalCards: number; totalTransactions: number; totalBalance: number } {
    const allCards = Array.from(virtualCards.values());
    return {
      totalCards: allCards.length,
      totalTransactions: transactions.size,
      totalBalance: allCards.reduce((sum, c) => sum + c.balance, 0),
    };
  },

  // ── Helpers de transformation ──

  toData(card: CardRecord): VirtualCardData {
    return {
      id: card.id,
      userId: card.userId,
      cardNumber: maskCardNumber(card.cardNumber),
      cardholderName: card.cardholderName,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cvv: "***",
      brand: card.brand,
      balance: card.balance,
      initialBalance: card.initialBalance,
      currency: card.currency,
      isActive: card.isActive,
      label: card.label,
      isTestCard: card.isTestCard,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  },

  txToData(tx: TransactionRecord): VirtualCardTransactionData {
    return {
      id: tx.id,
      virtualCardId: tx.virtualCardId,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      contractId: tx.contractId,
      missionTitle: tx.missionTitle,
      description: tx.description,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      stripePaymentId: tx.stripePaymentId,
      createdAt: tx.createdAt.toISOString(),
    };
  },
};

export { maskCardNumber, formatCardNumber };
