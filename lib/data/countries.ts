export interface Country {
  code: string;
  nom: string;
  devise: string;
  symbole?: string;
}

export const paysList: Country[] = [
  { code: "BJ", nom: "Bénin", devise: "XOF", symbole: "FCFA" },
  { code: "FR", nom: "France", devise: "EUR", symbole: "€" },
  { code: "US", nom: "États-Unis", devise: "USD", symbole: "$" },
  { code: "GB", nom: "Royaume-Uni", devise: "GBP", symbole: "£" },
  { code: "NG", nom: "Nigéria", devise: "NGN", symbole: "₦" },
  { code: "GH", nom: "Ghana", devise: "GHS", symbole: "GH₵" }
].sort((a, b) => a.nom.localeCompare(b.nom));

export function getCurrencyForCountry(countryName: string): string {
  const country = paysList.find(
    (c) => c.nom.toLowerCase() === countryName.toLowerCase() || c.code === countryName
  );
  return country ? country.devise : "EUR";
}
