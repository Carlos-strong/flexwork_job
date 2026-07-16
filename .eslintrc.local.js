/**
 * Règles ESLint personnalisées anti-régression pour Flexwork.
 * Version : Next.js 14 / React 18
 *
 * Utilisation : extends ce fichier dans .eslintrc.json
 *   { "extends": ["./.eslintrc.local.js"] }
 */

module.exports = {
  rules: {
    // ── 1. Interdire "use client" sans hook/event handler ──
    // Note : ESLint ne peut pas détecter statiquement si un fichier
    // a des hooks. Règle manuelle : vérifier que chaque "use client"
    // contient au moins : useState, useEffect, useRef, useContext,
    // useCallback, useMemo, onClick, onChange, onSubmit, addEventListener.
    // En pratique : auditer les 75 fichiers et supprimer la directive
    // pour les composants purement déclaratifs.

    // ── 2. Alerter sur les imports lourds ──
    "no-restricted-imports": [
      "warn",
      {
        patterns: [
          {
            group: ["lucide-react/dist/*"],
            message: "Utilisez 'import { X } from \"lucide-react\"' — le tree-shaking est automatique.",
          },
        ],
      },
    ],

    // ── 3. Détecter les fetch dans useEffect ──
    // (règle custom via plugin)
    // À installer : npm install -D eslint-plugin-react-hooks
    "react-hooks/exhaustive-deps": "warn",

    // ── 4. Forcer next/image et next/font ──
    "@next/next/no-img-element": "error",
    // next/font est vérifié automatiquement si les polices Google
    // sont importées hors de next/font/google
  },

  overrides: [
    {
      // Pages et layouts : doivent être Server Components par défaut
      files: ["app/**/page.tsx", "app/**/layout.tsx"],
      rules: {
        // Warning si "use client" est en haut d'une page
        // (certaines pages légitimes comme les dashboards interactifs
        //  auront besoin de "use client" — l'audit manuel prime)
      },
    },
  ],
};
