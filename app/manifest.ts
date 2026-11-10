import type { MetadataRoute } from "next";

// Lets staff install the dashboard on a phone or desktop (front desk, phlebotomists on the move).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MGPL Dashboard",
    short_name: "MGPL",
    description: "Maa Gayatri Path Lab staff dashboard: patients, bookings, samples, reports, billing and accounts.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#fafafa",
    lang: "en-IN",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
