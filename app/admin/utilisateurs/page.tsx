"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface UserWithProfiles {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  activeProfile: string;
  freelancerProfile: { id: string; title: string | null; isValidated: boolean } | null;
  clientProfile: { id: string; companyName: string | null } | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithProfiles[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    country: "",
    profileType: "FREELANCER" as string,
  });
  const [editingUser, setEditingUser] = useState<UserWithProfiles | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await fetch("/api/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            country: formData.country,
            profileType: formData.profileType,
          }),
        });
      }
      fetchUsers();
      setFormData({ email: "", firstName: "", lastName: "", country: "", profileType: "FREELANCER" });
      setEditingUser(null);
    } catch (error) {
      console.error("Failed to save user:", error);
    }
  };

  const handleEdit = (user: UserWithProfiles) => {
    setFormData({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      country: user.country || "",
      profileType: user.activeProfile,
    });
    setEditingUser(user);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to delete user:", errorData);
        toast.error(errorData.details || errorData.error || "Erreur lors de la suppression");
        return;
      }

      toast.success("Utilisateur supprimé avec succès");
      fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast.error("Erreur réseau lors de la suppression");
    }
  };

  const getProfileBadges = (user: UserWithProfiles) => {
    const badges: string[] = [];
    if (user.freelancerProfile) badges.push("Freelance");
    if (user.clientProfile) badges.push("Client");
    if (user.activeProfile === "ADMIN") badges.push("Admin");
    return badges;
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-6">Gestion des utilisateurs</h2>
      <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded-lg">
        <h3 className="text-xl mb-4">{editingUser ? "Modifier" : "Ajouter"} un Utilisateur</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Prénom</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nom</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Pays</label>
            <input
              type="text"
              name="country"
              value={formData.country}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          {!editingUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Type de profil</label>
              <select
                name="profileType"
                value={formData.profileType}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="FREELANCER">Freelance</option>
                <option value="CLIENT">Client</option>
              </select>
            </div>
          )}
        </div>
        <button
          type="submit"
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
            className="mt-4 ml-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Annuler
          </button>
        )}
      </form>

      <div className="rounded-xl border border-[#E2E0D9] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F5F0]/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nom</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Pays</th>
              <th className="text-left px-4 py-3 font-medium">Profils</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                <td className="px-4 py-3 font-medium">
                  {user.firstName} {user.lastName || "N/A"}
                </td>
                <td className="px-4 py-3 text-[#5A5750]">{user.email}</td>
                <td className="px-4 py-3">{user.country || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {getProfileBadges(user).map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-[#EEF2FD] px-2 py-0.5 text-xs font-medium text-[#2D5BE3]"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(user)}
                    className="px-2 py-1 bg-yellow-500 text-white rounded-md mr-2"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded-md"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
