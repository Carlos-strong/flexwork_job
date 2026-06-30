type RoleName = "SUPER_ADMIN" | "ADMIN" | "MODERATEUR" | "SUPPORT" | "FINANCE";

const ROLES: {
  name: RoleName;
  label: string;
  description: string;
  color: string;
  permissions: string[];
}[] = [
  {
    name: "SUPER_ADMIN",
    label: "Super Administrateur",
    description: "Accès total à toutes les fonctionnalités, y compris le Back Office.",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    permissions: [
      "Accès Back Office (paramètres, RBAC, taxonomie)",
      "Accès Admin Métier complet",
      "Gestion des rôles",
      "Suppression de données",
      "Export financier",
    ],
  },
  {
    name: "ADMIN",
    label: "Administrateur",
    description: "Accès Admin Métier complet. Pas d'accès aux paramètres critiques.",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    permissions: [
      "Gestion utilisateurs",
      "Validation KYC (freelances + entreprises)",
      "Gestion missions",
      "Gestion litiges",
      "Gestion paiements",
    ],
  },
  {
    name: "MODERATEUR",
    label: "Modérateur",
    description: "Traitement des signalements et supervision du contenu.",
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    permissions: [
      "Lecture utilisateurs",
      "Traitement signalements",
      "Masquage missions",
      "Suspensions temporaires",
    ],
  },
  {
    name: "SUPPORT",
    label: "Support",
    description: "Support client en lecture seule — pas d'actions destructives.",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    permissions: [
      "Lecture utilisateurs",
      "Lecture contrats et paiements",
      "Lecture conversations",
      "Ouverture de litiges",
    ],
  },
  {
    name: "FINANCE",
    label: "Finance",
    description: "Accès limité aux données financières et exports comptables.",
    color: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    permissions: [
      "Lecture paiements et transactions",
      "Exports financiers (CSV/Excel)",
      "Consultation escrow",
      "Accès Back Office Finance",
    ],
  },
];

export default function BackOfficeRolesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Rôles & Accès</h2>
        <p className="text-sm text-[#5A5750]">
          RBAC — Contrôle d&apos;accès basé sur les rôles (Role-Based Access Control)
        </p>
      </div>

      {/* Matrice des rôles */}
      <div className="space-y-4">
        {ROLES.map((role) => (
          <div key={role.name} className="rounded-xl border border-[#E2E0D9] p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{role.label}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${role.color}`}>
                    {role.name}
                  </span>
                </div>
                <p className="text-sm text-[#5A5750] mt-1">{role.description}</p>
              </div>
              <button className="shrink-0 rounded-lg border border-[#E2E0D9] px-3 py-1.5 text-xs font-medium hover:bg-[#EEF2FD] transition-colors">
                Modifier
              </button>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-[#5A5750] mb-2">Permissions :</p>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.map((p) => (
                  <span key={p} className="rounded-md bg-[#F5F5F0] px-2 py-0.5 text-xs">
                    ✅ {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      <div className="rounded-xl border border-[#E2E0D9] p-4 text-sm text-[#5A5750]">
        <p className="font-medium text-[#1A1916] mb-1">Assignation des rôles</p>
        <p>
          Les rôles sont assignés dans la section{" "}
          <a href="/admin/utilisateurs" className="underline text-[#2D5BE3]">Gestion Utilisateurs</a>.
          Seul un <strong>SUPER_ADMIN</strong> peut attribuer le rôle ADMIN ou SUPER_ADMIN.
        </p>
      </div>
    </div>
  );
}
