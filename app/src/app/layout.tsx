import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const SITE_URL = "https://hello-roomly.com";
const TITLE = "Roomly — Software de gestión hotelera para hoteles pequeños en México";
const DESCRIPTION =
  "Gestiona reservas, tarifas, pagos y reportes de tu hotel desde un solo panel. Portal de reservas online, cobros con tarjeta y soporte en español. Configúralo en menos de 48 horas.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Roomly",
  },
  description: DESCRIPTION,
  keywords: [
    "software para hoteles",
    "gestor de reservas hotel",
    "sistema de reservas hotelero",
    "PMS hotelero México",
    "gestión hotelera",
    "reservas online hotel",
    "cobros con tarjeta hotel",
  ],
  authors: [{ name: "Roomly" }],
  creator: "Roomly",
  applicationName: "Roomly",
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: SITE_URL,
    siteName: "Roomly",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Roomly — Software de gestión hotelera",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Roomly",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: DESCRIPTION,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "MXN",
    lowPrice: "399",
    highPrice: "999",
    offerCount: "2",
  },
  provider: {
    "@type": "Organization",
    name: "Roomly",
    url: SITE_URL,
  },
  areaServed: {
    "@type": "Country",
    name: "México",
  },
  inLanguage: "es-MX",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
