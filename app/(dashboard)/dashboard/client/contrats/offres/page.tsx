/**
 * Redirection permanente — l'espace Offres a été aplati vers /dashboard/client/offres
 * (schéma d'URL : /dashboard/{espace}/{ressource}, ressources de premier niveau).
 * Conservé pour ne pas casser les anciens liens / favoris.
 */
import { redirect } from "next/navigation";

export default function LegacyClientOffresRedirect() {
  redirect("/dashboard/client/offres");
}
