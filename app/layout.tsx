import type { Metadata, Viewport } from "next";
import { Outfit, Geist, Geist_Mono } from "next/font/google";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import "@mantine/core/styles.layer.css";
import "@mantine/dates/styles.layer.css";
import "@mantine/charts/styles.layer.css";
import "@mantine/notifications/styles.layer.css";
import "@mantine/spotlight/styles.layer.css";
import "@mantine/nprogress/styles.layer.css";
import "mantine-datatable/styles.layer.css";
import "./globals.css";
import { connection } from "next/server";
import { Providers } from "./providers";
import { apiUrlScript, publicApiUrl } from "@/lib/api-url";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MGPL Dashboard", template: "%s · MGPL Dashboard" },
  description: "The work of Maa Gayatri Path Lab in one place: patients, bookings, samples, reports, billing and accounts.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141415" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // rendered per request, so MGPL_PUBLIC_API_URL is read from the running server, not frozen at build time
  await connection();
  const apiUrl = publicApiUrl();
  return (
    <html lang="en-IN" {...mantineHtmlProps} className={`${outfit.variable} ${geist.variable} ${geistMono.variable}`}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        {apiUrl && <script dangerouslySetInnerHTML={{ __html: apiUrlScript(apiUrl) }} />}
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
