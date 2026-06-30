/** 
 * Illustrations SVG inline pour la page d'accueil
 * Pas besoin de fichiers images externes
 */

export function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 500 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      {/* Connexion entre personnes */}
      <circle cx="150" cy="160" r="50" className="fill-primary/20" />
      <circle cx="350" cy="160" r="50" className="fill-primary/20" />
      <circle cx="250" cy="280" r="60" className="fill-primary/10" />

      {/* Icônes de personnes */}
      <g className="fill-primary/40">
        <circle cx="150" cy="150" r="18" className="fill-primary/60" />
        <ellipse cx="150" cy="200" rx="25" ry="15" className="fill-primary/60" />
        <circle cx="350" cy="150" r="18" className="fill-primary/60" />
        <ellipse cx="350" cy="200" rx="25" ry="15" className="fill-primary/60" />
        <circle cx="250" cy="268" r="18" className="fill-primary/40" />
        <ellipse cx="250" cy="318" rx="25" ry="15" className="fill-primary/40" />
      </g>

      {/* Lignes de connexion */}
      <path
        d="M170 165 Q250 120 330 165"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="6 4"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M170 185 Q250 230 330 185"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="6 4"
        fill="none"
        opacity="0.5"
      />

      {/* Carte mission flottante */}
      <g className="animate-float">
        <rect x="30" y="50" width="100" height="60" rx="8" className="fill-background stroke-border" strokeWidth="1" />
        <rect x="40" y="60" width="50" height="6" rx="3" className="fill-primary/60" />
        <rect x="40" y="72" width="80" height="4" rx="2" className="fill-muted-foreground/30" />
        <rect x="40" y="82" width="60" height="4" rx="2" className="fill-muted-foreground/30" />
        <rect x="40" y="94" width="40" height="8" rx="4" className="fill-primary/30" />
      </g>

      {/* Carte profil flottante */}
      <g className="animate-float-delayed">
        <rect x="370" y="220" width="100" height="70" rx="8" className="fill-background stroke-border" strokeWidth="1" />
        <circle cx="395" cy="240" r="8" className="fill-primary/50" />
        <rect x="410" y="236" width="50" height="6" rx="3" className="fill-muted-foreground/40" />
        <rect x="410" y="248" width="40" height="4" rx="2" className="fill-muted-foreground/30" />
        <rect x="380" y="264" width="70" height="6" rx="3" className="fill-green-500/40" />
        <rect x="380" y="276" width="50" height="6" rx="3" className="fill-blue-500/40" />
        <rect x="440" y="276" width="20" height="6" rx="3" className="fill-yellow-500/40" />
      </g>

      {/* Badge paiement sécurisé */}
      <g className="animate-float-slower">
        <rect x="360" y="40" width="110" height="55" rx="10" className="fill-green-50 dark:fill-green-950 stroke-green-300 dark:stroke-green-700" strokeWidth="1" />
        <text x="385" y="62" fontSize="12" className="fill-green-600 dark:fill-green-400" fontWeight="bold">🔒 Paiement</text>
        <text x="380" y="80" fontSize="11" className="fill-green-500 dark:fill-green-500">sécurisé</text>
      </g>
    </svg>
  );
}

export function ClientIllustration() {
  return (
    <svg
      viewBox="0 0 400 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      {/* Fond */}
      <rect x="20" y="20" width="360" height="280" rx="16" className="fill-background stroke-border" strokeWidth="1" />

      {/* En-tête de la carte mission */}
      <rect x="40" y="40" width="320" height="40" rx="8" className="fill-primary/10" />
      <circle cx="60" cy="60" r="6" className="fill-primary/50" />
      <rect x="75" y="56" width="120" height="8" rx="4" className="fill-primary/60" />

      {/* Champs du formulaire */}
      <rect x="50" y="100" width="300" height="12" rx="4" className="fill-muted" />
      <rect x="50" y="122" width="300" height="12" rx="4" className="fill-muted" />
      <rect x="50" y="144" width="200" height="12" rx="4" className="fill-muted" />

      {/* Skills / Tags */}
      <rect x="50" y="170" width="70" height="24" rx="12" className="fill-primary/20" />
      <rect x="130" y="170" width="80" height="24" rx="12" className="fill-primary/20" />
      <rect x="220" y="170" width="60" height="24" rx="12" className="fill-primary/20" />

      {/* Budget */}
      <rect x="50" y="210" width="100" height="8" rx="4" className="fill-muted-foreground/30" />
      <text x="50" y="240" fontSize="18" className="fill-primary" fontWeight="bold">€ 5 000</text>

      {/* Bouton Publier */}
      <rect x="50" y="260" width="140" height="36" rx="8" className="fill-primary" />
      <text x="80" y="283" fontSize="13" className="fill-primary-foreground" fontWeight="600">Publier la mission</text>

      {/* Check de confirmation */}
      <circle cx="330" cy="270" r="20" className="fill-green-500/20" />
      <path d="M322 270 l6 6 l12 -12" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function FreelancerIllustration() {
  return (
    <svg
      viewBox="0 0 400 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      {/* Fond */}
      <rect x="20" y="20" width="360" height="280" rx="16" className="fill-background stroke-border" strokeWidth="1" />

      {/* Photo de profil */}
      <circle cx="80" cy="70" r="30" className="fill-primary/20" />
      <circle cx="80" cy="60" r="12" className="fill-primary/40" />
      <ellipse cx="80" cy="90" rx="18" ry="10" className="fill-primary/40" />

      {/* Infos profil */}
      <rect x="125" y="55" width="140" height="10" rx="5" className="fill-foreground/80" />
      <rect x="125" y="72" width="100" height="7" rx="3" className="fill-muted-foreground/40" />

      {/* Badges compétences */}
      <rect x="125" y="90" width="60" height="22" rx="11" className="fill-blue-500/20" />
      <text x="135" y="105" fontSize="10" className="fill-blue-600 dark:fill-blue-400" fontWeight="500">React</text>

      <rect x="193" y="90" width="70" height="22" rx="11" className="fill-purple-500/20" />
      <text x="202" y="105" fontSize="10" className="fill-purple-600 dark:fill-purple-400" fontWeight="500">Node.js</text>

      <rect x="271" y="90" width="50" height="22" rx="11" className="fill-green-500/20" />
      <text x="280" y="105" fontSize="10" className="fill-green-600 dark:fill-green-400" fontWeight="500">TypeScript</text>

      {/* TJM */}
      <rect x="40" y="130" width="160" height="50" rx="10" className="fill-primary/5" />
      <text x="55" y="150" fontSize="11" className="fill-muted-foreground">Taux journalier</text>
      <text x="55" y="170" fontSize="16" className="fill-primary" fontWeight="bold">450 € / jour</text>

      {/* Disponibilité */}
      <rect x="220" y="130" width="140" height="50" rx="10" className="fill-green-500/10" />
      <circle cx="245" cy="148" r="5" className="fill-green-500" />
      <text x="258" y="152" fontSize="11" className="fill-green-600 dark:fill-green-400" fontWeight="500">Disponible</text>
      <text x="245" y="170" fontSize="11" className="fill-muted-foreground">Temps plein</text>

      {/* Barre de complétion */}
      <rect x="40" y="200" width="320" height="8" rx="4" className="fill-muted" />
      <rect x="40" y="200" width="290" height="8" rx="4" className="fill-primary" />
      <text x="45" y="222" fontSize="11" className="fill-muted-foreground">Profil complété à 92%</text>

      {/* Bouton contact */}
      <rect x="40" y="250" width="140" height="36" rx="8" className="fill-primary" />
      <text x="68" y="273" fontSize="13" className="fill-primary-foreground" fontWeight="600">Contacter</text>
    </svg>
  );
}

export function StatsIllustration() {
  return (
    <svg
      viewBox="0 0 200 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      {/* Barres de statistiques */}
      <rect x="10" y="30" width="20" height="25" rx="4" className="fill-primary/30" />
      <rect x="40" y="18" width="20" height="37" rx="4" className="fill-primary/40" />
      <rect x="70" y="8" width="20" height="47" rx="4" className="fill-primary/50" />
      <rect x="100" y="25" width="20" height="30" rx="4" className="fill-primary/35" />
      <rect x="130" y="15" width="20" height="40" rx="4" className="fill-primary/45" />
      <rect x="160" y="5" width="20" height="50" rx="4" className="fill-primary/55" />
    </svg>
  );
}

export function SecurePaymentIllustration() {
  return (
    <svg
      viewBox="0 0 300 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      {/* Bouclier */}
      <path
        d="M150 30 L230 65 L230 115 C230 155 195 180 150 190 C105 180 70 155 70 115 L70 65 Z"
        className="fill-primary/10 stroke-primary/30"
        strokeWidth="2"
      />
      <path
        d="M150 50 L210 75 L210 115 C210 145 185 165 150 173 C115 165 90 145 90 115 L90 75 Z"
        className="fill-primary/5 stroke-primary/20"
        strokeWidth="1.5"
      />

      {/* Cadenas */}
      <rect x="135" y="100" width="30" height="24" rx="4" className="fill-primary" />
      <circle cx="150" cy="110" r="7" className="fill-background" />
      <rect x="147" y="113" width="6" height="6" rx="1" className="fill-background" />
      <path d="M135 104 Q135 92 150 92 Q165 92 165 104" className="stroke-primary" strokeWidth="3" fill="none" />

      {/* Euro */}
      <text x="142" y="140" fontSize="22" className="fill-primary" fontWeight="bold">€</text>

      {/* Check de validation */}
      <circle cx="190" cy="70" r="15" className="fill-green-500/20" />
      <path d="M183 70 l5 5 l10 -10" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
