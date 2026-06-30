import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";

// Pour l'instant, seule la locale française est supportée
const locales = ["fr"];
export const defaultLocale = "fr";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(locales, requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
