"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

type KycStatus = "VALIDÉ" | "EN_ATTENTE" | "REJETÉ" | "AUCUN";

interface UserWithProfiles {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  activeProfile: string;
  freelancerProfile: { id: string; title: string | null; isValidated: boolean } | null;
  clientProfile: { id: string; companyName: string | null; companyVerificationStatus?: string } | null;
  createdAt: string;
}

interface UserWithKyc extends UserWithProfiles {
  kycStatus: KycStatus;
  kycType?: "freelancer" | "company";
}

const KYC_STATUS_COLORS: Record<KycStatus, string> = {
  VALIDÉ: "bg-[#E6F5EE] text-[#1A7A4A] border-[#9FD4B4]",
  EN_ATTENTE: "bg-[#FEF9E7] text-[#B7950B] border-[#F9E79F]",
  REJETÉ: "bg-[#FDEDEC] text-[#C0392B] border-[#F5B7B1]",
  AUCUN: "bg-[#FAFAF8] text-[#5A5750] border-[#E2E0D9]",
};

const KYC_STATUS_ICONS: Record<KycStatus, string> = {
  VALIDÉ: "✅",
  EN_ATTENTE: "⏳",
  REJETÉ: "❌",
  AUCUN: "—",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithKyc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KycStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithProfiles | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    country: "",
    profileType: "FREELANCER" as string,
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      const usersWithKyc = data.map((user: UserWithProfiles) => {
        let status: KycStatus = "AUCUN";
        let type: "freelancer" | "company" | undefined;

        if (user.freelancerProfile) {
          status = user.freelancerProfile.isValidated ? "VALIDÉ" : "EN_ATTENTE";
          type = "freelancer";
        } else if (user.clientProfile) {
          const compStatus = user.clientProfile.companyVerificationStatus;
          status = compStatus === "VALIDE" ? "VALIDÉ" : compStatus === "REJETE" ? "REJETÉ" : "EN_ATTENTE";
          type = "company";
        }

        return { ...user, kycStatus: status, kycType: type };
      });
      setUsers(usersWithKyc);
    } catch (error) {
      console.error("Erreur chargement utilisateurs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        if (editingUser) {
          await fetch("/api/users", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editingUser.id,
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              country: formData.country,
            }),
          });
        } else {
          await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              country: formData.country,
              profileType: formData.profileType,
            }),
          });
        }
        await fetchUsers();
        setFormData({ email: "", firstName: "", lastName: "", country: "", profileType: "FREELANCER" });
        setEditingUser(null);
      } catch (error) {
        console.error("Erreur sauvegarde utilisateur:", error);
      }
    },
    [editingUser, formData, fetchUsers],
  );

  const handleEdit = useCallback((user: UserWithKyc) => {
    setFormData({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      country: user.country || "",
      profileType: user.activeProfile,
    });
    setEditingUser(user);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur?")) return;
      try {
        const response = await fetch("/api/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!response.ok) throw new Error("Erreur suppression");
        await fetchUsers();
      } catch (error) {
        console.error("Erreur suppression utilisateur:", error);
      }
    },
    [fetchUsers],
  );

  const stats = useMemo(() => {
    return {
      total: users.length,
      validKyc: users.filter((u) => u.kycStatus === "VALIDÉ").length,
      pendingKyc: users.filter((u) => u.kycStatus === "EN_ATTENTE").length,
      rejectedKyc: users.filter((u) => u.kycStatus === "REJETÉ").length,
      noKyc: users.filter((u) => u.kycStatus === "AUCUN").length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    return users
      .filter((u) => (filter === "ALL" ? true : u.kycStatus === filter))
      .filter((u) =>
        search.toLowerCase() === ""
          ? true
          : u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            u.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase()),
      );
  }, [users, filter, search]);

  return (
    <div className="space-y-6 text-[#1A1916]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">👥 Gestion des utilisateurs</h1>
          <p className="text-[13px] text-[#5A5750] mt-0.5">Tous les utilisateurs et leur statut KYC</p>
        </div>
        <button
          onClick={() => fetchUsers()}
          disabled={loading}
          className="rounded-[10px] border border-[#E2E0D9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5A5750] disabled:opacity-40"
        >
          ↻ Rafraîchir
        </button>
      </div>

      {/* Statistiques KYC */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-[#E2E0D9] bg-white p-3">
          <p className="text-[11px] uppercase font-bold text-[#5A5750] tracking-wider">Total</p>
          <p className="text-[22px] font-bold text-[#1A1916] mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-[#9FD4B4] bg-[#E6F5EE] p-3">
          <p className="text-[11px] uppercase font-bold text-[#1A7A4A] tracking-wider">Validés</p>
          <p className="text-[22px] font-bold text-[#1A7A4A] mt-1">✅ {stats.validKyc}</p>
        </div>
        <div className="rounded-lg border border-[#F9E79F] bg-[#FEF9E7] p-3">
          <p className="text-[11px] uppercase font-bold text-[#B7950B] tracking-wider">En attente</p>
          <p className="text-[22px] font-bold text-[#B7950B] mt-1">⏳ {stats.pendingKyc}</p>
        </div>
        <div className="rounded-lg border border-[#F5B7B1] bg-[#FDEDEC] p-3">
          <p className="text-[11px] uppercase font-bold text-[#C0392B] tracking-wider">Rejetés</p>
          <p className="text-[22px] font-bold text-[#C0392B] mt-1">❌ {stats.rejectedKyc}</p>
        </div>
        <div className="rounded-lg border border-[#E2E0D9] bg-[#FAFAF8] p-3">
          <p className="text-[11px] uppercase font-bold text-[#5A5750] tracking-wider">Sans KYC</p>
          <p className="text-[22px] font-bold text-[#5A5750] mt-1">— {stats.noKyc}</p>
        </div>
      </div>

      {/* Formulaire ajout/édition */}
      {editingUser || !editingUser ? (
        <div className="rounded-xl border border-[#E2E0D9] bg-white p-5">
          <h3 className="text-[16px] font-semibold mb-4 text-[#1A1916]">
            {editingUser ? "✏️ Modifier l'utilisateur" : "➕ Ajouter un utilisateur"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-semibold uppercase text-[#5A5750] mb-1.5">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full rounded-[10px] border border-[#E2E0D9] px-3 py-2.5 text-[13px] bg-white text-[#1A1916] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
                  required
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold uppercase text-[#5A5750] mb-1.5">Prénom</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full rounded-[10px] border border-[#E2E0D9] px-3 py-2.5 text-[13px] bg-white text-[#1A1916] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold uppercase text-[#5A5750] mb-1.5">Nom</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full rounded-[10px] border border-[#E2E0D9] px-3 py-2.5 text-[13px] bg-white text-[#1A1916] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold uppercase text-[#5A5750] mb-1.5">Pays</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="w-full rounded-[10px] border border-[#E2E0D9] px-3 py-2.5 text-[13px] bg-white text-[#1A1916] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-[12px] font-semibold uppercase text-[#5A5750] mb-1.5">Type de profil</label>
                  <select
                    name="profileType"
                    value={formData.profileType}
                    onChange={handleInputChange}
                    className="w-full rounded-[10px] border border-[#E2E0D9] px-3 py-2.5 text-[13px] bg-white text-[#1A1916] focus:outline-none focus:border-[#2D5BE3] focus:ring-1 focus:ring-[#2D5BE3]"
                  >
                    <option value="FREELANCER">Freelance</option>
                    <option value="CLIENT">Client</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="rounded-[10px] bg-[#2D5BE3] px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                {editingUser ? "Mettre à jour" : "Ajouter"}
              </button>
              {editingUser && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setFormData({ email: "", firstName: "", lastName: "", country: "", profileType: "FREELANCER" });
                  }}
                  className="rounded-[10px] border border-[#E2E0D9] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1A1916]"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>
      ) : null}

      {/* Filtres + Recherche */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher par nom, prénom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-[10px] border border-[#E2E0D9] px-4 py-2.5 text-[13px] bg-white text-[#1A1916] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Tous", value: "ALL", icon: "📋" },
          { label: "Validés", value: "VALIDÉ", icon: "✅", color: "bg-[#E6F5EE]" },
          { label: "En attente", value: "EN_ATTENTE", icon: "⏳", color: "bg-[#FEF9E7]" },
          { label: "Rejetés", value: "REJETÉ", icon: "❌", color: "bg-[#FDEDEC]" },
          { label: "Sans KYC", value: "AUCUN", icon: "—", color: "bg-[#FAFAF8]" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as KycStatus | "ALL")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${
              filter === f.value
                ? "bg-[#2D5BE3] text-white"
                : `${f.color || "bg-[#FAFAF8]"} border border-[#E2E0D9] text-[#5A5750]`
            }`}
          >
            {f.icon}
            {f.label}
            <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              filter === f.value ? "bg-white/20 text-white" : "bg-[#E2E0D9] text-[#5A5750]"
            }`}>
              {f.value === "ALL"
                ? stats.total
                : f.value === "VALIDÉ"
                  ? stats.validKyc
                  : f.value === "EN_ATTENTE"
                    ? stats.pendingKyc
                    : f.value === "REJETÉ"
                      ? stats.rejectedKyc
                      : stats.noKyc}
            </span>
          </button>
        ))}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="rounded-xl border border-[#E2E0D9] bg-white p-12 text-center">
          <p className="text-[13px] text-[#5A5750]">Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E2E0D9] bg-white p-12 text-center">
          <p className="text-[14px] text-[#5A5750]">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E0D9] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E0D9] bg-[#FAFAF8]">
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">
                    Pays
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">
                    Profils
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">
                    Statut KYC
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#5A5750] text-[11px] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F0]">
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1A1916]">
                        {user.firstName} {user.lastName || ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#5A5750]">{user.email}</td>
                    <td className="px-4 py-3 text-[#5A5750]">{user.country || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {user.freelancerProfile && (
                          <span className="inline-flex items-center rounded-full bg-[#EEF2FD] px-2.5 py-1 text-[11px] font-medium text-[#2D5BE3]">
                            👨‍💼 Freelance
                          </span>
                        )}
                        {user.clientProfile && (
                          <span className="inline-flex items-center rounded-full bg-[#F3E5F5] px-2.5 py-1 text-[11px] font-medium text-[#7B1FA2]">
                            🏢 Client
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${KYC_STATUS_COLORS[user.kycStatus]}`}
                      >
                        {KYC_STATUS_ICONS[user.kycStatus]} {user.kycStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.kycType && (
                          <Link
                            href={
                              user.kycType === "freelancer"
                                ? `/admin/kyc/freelances`
                                : `/admin/kyc/entreprises`
                            }
                            className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-1.5 text-[11px] font-medium text-[#5A5750]"
                          >
                            📋 KYC
                          </Link>
                        )}
                        <button
                          onClick={() => handleEdit(user)}
                          className="rounded-lg border border-[#E2E0D9] bg-white px-3 py-1.5 text-[11px] font-medium text-[#5A5750] hover:bg-[#FAFAF8] transition-colors"
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="rounded-lg border border-[#E2E0D9] bg-[#FDEDEC] px-3 py-1.5 text-[11px] font-medium text-[#C0392B]"
                        >
                          🗑️ Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
