import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Flexwork - Plateforme Freelance",
    template: "%s | Flexwork",
  },
  description:
    "La plateforme qui connecte freelances et clients. Publiez des missions, trouvez des talents, paiement sécurisé.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "256x256" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  // Métadonnées supplémentaires pour la performance
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Preconnect aux origines externes pour accélérer les requêtes */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />
      </head>
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {children}
          </Providers>
          <Toaster
            richColors
            position="top-right"
            // Réduire la durée d'affichage pour améliorer la fluidité perçue
            duration={3000}
            // Limiter le nombre de toasts visibles
            visibleToasts={3}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
