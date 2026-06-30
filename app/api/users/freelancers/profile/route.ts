import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/users/freelancers/profile
 * Récupère le profil freelance — priorité au nouveau modèle PrestataireMetier,
 * fallback vers l'ancien FreelancerProfile (déprécié).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 401 });
    }

    // 1. Essayer PrestataireMetier (nouveau modèle)
    const premierMetier = await prisma.prestataireMetier.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        metier: { select: { libelle: true } },
        zones: { take: 1 },
        disponibilites: { take: 7, orderBy: { jourSemaine: "asc" } },
        servicesProposes: { include: { service: { select: { libelle: true } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (premierMetier) {
      const zone = premierMetier.zones[0];
      const disponibilites = premierMetier.disponibilites
        .filter((d) => d.estDisponible)
        .map((d) => d.jourSemaine);
      const skills = premierMetier.servicesProposes.map((s) => s.service.libelle);

      const profile = {
        // Champs compatibles avec l'ancien format
        title: premierMetier.metier.libelle,
        bio: premierMetier.description || "",
        hourlyRate: premierMetier.taux ?? undefined,
        skills: skills.length > 0 ? skills : [],
        availability: disponibilites.length > 0 ? disponibilites.join(", ") : "",
        location: zone ? [zone.ville, zone.quartier].filter(Boolean).join(", ") : "",
        portfolio: "",
        experience: premierMetier.experience || undefined,
        // Nouveaux champs
        modeTarification: premierMetier.modeTarification,
        taux: premierMetier.taux,
        metierId: premierMetier.metierId,
        metierLibelle: premierMetier.metier.libelle,
        zoneVille: zone?.ville || "",
        zoneQuartier: zone?.quartier || "",
        zoneRayonKm: zone?.rayonKm || 10,
        // User infos
        firstName: premierMetier.user.firstName,
        lastName: premierMetier.user.lastName,
        email: premierMetier.user.email,
      };

      return NextResponse.json({ profile, source: "prestataire_metier" });
    }

    // 2. Fallback vers l'ancien FreelancerProfile
    const oldProfile = await prisma.freelancerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!oldProfile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        ...oldProfile,
        firstName: oldProfile.user.firstName,
        lastName: oldProfile.user.lastName,
        email: oldProfile.user.email,
        modeTarification: undefined,
        taux: oldProfile.hourlyRate,
        metierId: undefined,
        metierLibelle: oldProfile.title,
        zoneVille: "",
        zoneQuartier: "",
        zoneRayonKm: 10,
      },
      source: "freelancer_profile",
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PUT /api/users/freelancers/profile
 * Met à jour le profil freelance — écrit dans PrestataireMetier (moderne)
 * et dans FreelancerProfile (rétrocompatibilité).
 */
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 401 });
    }

    const body = await req.json();
    const { title, bio, hourlyRate, skills, availability, location, portfolio, experience,
            modeTarification, taux, metierId, zoneVille, zoneQuartier, zoneRayonKm } = body;

    // 1. Mettre à jour PrestataireMetier (moderne)
    const premierMetier = await prisma.prestataireMetier.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { metier: true },
    });

    if (premierMetier) {
      await prisma.prestataireMetier.update({
        where: { id: premierMetier.id },
        data: {
          description: bio || premierMetier.description,
          taux: taux != null ? Number(taux) : (hourlyRate != null ? Number(hourlyRate) : premierMetier.taux),
          modeTarification: modeTarification || premierMetier.modeTarification,
          experience: (experience as any) || premierMetier.experience,
        },
      });

      // Mettre à jour la zone si fournie
      if (zoneVille) {
        const existingZone = await prisma.zoneIntervention.findFirst({
          where: { prestataireMetierId: premierMetier.id },
        });
        if (existingZone) {
          await prisma.zoneIntervention.update({
            where: { id: existingZone.id },
            data: {
              ville: zoneVille || existingZone.ville,
              quartier: zoneQuartier ?? existingZone.quartier,
              rayonKm: zoneRayonKm ? Number(zoneRayonKm) : existingZone.rayonKm,
            },
          });
        }
      }
    }

    // 2. Rétrocompatibilité — mettre à jour FreelancerProfile
    const skillsArray = skills
      ? (typeof skills === "string" ? skills.split(",").map((s: string) => s.trim()).filter(Boolean) : skills)
      : [];

    await prisma.freelancerProfile.upsert({
      where: { userId },
      create: {
        userId,
        title: title || (premierMetier?.metier?.libelle ?? ""),
        bio: bio || "",
        hourlyRate: taux != null ? Number(taux) : (hourlyRate ? Number(hourlyRate) : null),
        skills: skillsArray,
        availability: availability || "",
        location: location || zoneVille || "",
        portfolio: portfolio || "",
        experience: experience || "",
      },
      update: {
        title: title || undefined,
        bio: bio || undefined,
        hourlyRate: taux != null ? Number(taux) : (hourlyRate ? Number(hourlyRate) : undefined),
        skills: skillsArray.length > 0 ? skillsArray : undefined,
        availability: availability || undefined,
        location: location || zoneVille || undefined,
        portfolio: portfolio || undefined,
        experience: experience || undefined,
      },
    });

    return NextResponse.json({ message: "Profil mis à jour avec succès" });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la mise à jour du profil" }, { status: 500 });
  }
}
