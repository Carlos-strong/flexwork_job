/**
 * Redirection permanente — l'espace Offres a été aplati vers /dashboard/freelancer/offres
 * (schéma d'URL : /dashboard/{espace}/{ressource}, ressources de premier niveau).
 * Conservé pour ne pas casser les anciens liens / favoris.
 */
import { redirect } from "next/navigation";

export default function LegacyFreelancerOffresRedirect() {
  redirect("/dashboard/freelancer/offres");
}
