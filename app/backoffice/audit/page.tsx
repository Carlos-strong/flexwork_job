// Journal d'audit — liste des actions critiques traçables

interface AuditEntry {
  id: string;
  who: string;
  role: string;
  action: string;
  target: string;
  targetId: string;
  timestamp: string;
  ip: string;
  result: "SUCCESS" | "FAILED";
}

const MOCK_ENTRIES: AuditEntry[] = [
  {
    id: "1",
    who: "admin@flexwork.fr",
    role: "ADMIN",
    action: "VALIDATE_KYC",
    target: "VerificationIdentite",
    targetId: "ver_001",
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    ip: "192.168.1.1",
    result: "SUCCESS",
  },
  {
    id: "2",
    who: "support@flexwork.fr",
    role: "SUPPORT",
    action: "VIEW_USER",
    target: "User",
    targetId: "usr_042",
    timestamp: new Date(Date.now() - 7200_000).toISOString(),
    ip: "192.168.1.2",
    result: "SUCCESS",
  },
  {
    id: "3",
    who: "admin@flexwork.fr",
    role: "ADMIN",
    action: "SUSPEND_USER",
    target: "User",
    targetId: "usr_015",
    timestamp: new Date(Date.now() - 86400_000).toISOString(),
    ip: "192.168.1.1",
    result: "SUCCESS",
  },
];

const ACTION_LABELS: Record<string, string> = {
  VALIDATE_KYC:    "Validation KYC",
  REJECT_KYC:      "Rejet KYC",
  VIEW_USER:       "Consultation utilisateur",
  SUSPEND_USER:    "Suspension utilisateur",
  DELETE_MISSION:  "Suppression mission",
  UPDATE_SETTINGS: "Modification paramètres",
  ASSIGN_ROLE:     "Attribution de rôle",
  EXPORT_DATA:     "Export de données",
  RESOLVE_DISPUTE: "Résolution litige",
};

export default function BackOfficeAuditPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1916]">Journal d&apos;audit</h2>
          <p className="text-[14px] text-[#5A5750]">
            Traçabilité des actions critiques — Qui ? Quand ? Quoi ?
          </p>
        </div>
        <button className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2 text-[14px] font-semibold text-[#1A1916] hover:bg-[#FAFAF8] transition-colors">
          📥 Exporter CSV
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {["Tous", "KYC", "Utilisateurs", "Missions", "Paiements", "Paramètres"].map((f) => (
          <button
            key={f}
            className={`rounded-[20px] px-3 py-1 text-[12px] font-semibold transition-colors ${
              f === "Tous"
                ? "bg-[#2D5BE3] text-white"
                : "border border-[#E2E0D9] bg-white text-[#5A5750] hover:bg-[#FAFAF8]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[16px] border border-[#E2E0D9] overflow-hidden bg-white shadow-sm">
        <table className="w-full text-[14px]">
          <thead className="border-b border-[#E2E0D9] bg-[#FAFAF8]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Qui</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Cible</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Quand</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">IP</th>
              <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[12px] uppercase tracking-wider">Résultat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E0D9]">
            {MOCK_ENTRIES.map((e) => (
              <tr key={e.id} className="hover:bg-[#FAFAF8] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#1A1916]">{e.who}</p>
                  <p className="text-[12px] text-[#5A5750]">{e.role}</p>
                </td>
                <td className="px-4 py-3 text-[#1A1916]">
                  {ACTION_LABELS[e.action] || e.action}
                </td>
                <td className="px-4 py-3 text-[#5A5750] text-[12px] font-mono">
                  {e.target} #{e.targetId}
                </td>
                <td className="px-4 py-3 text-[#5A5750] text-[12px]">
                  {new Date(e.timestamp).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-[#5A5750] text-[12px] font-mono">
                  {e.ip}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    e.result === "SUCCESS"
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  }`}>
                    {e.result === "SUCCESS" ? "✅ OK" : "❌ Échec"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-[#5A5750]">
        Le journal d&apos;audit est conservé 12 mois. Exportez les données avant expiration.
      </p>
    </div>
  );
}
