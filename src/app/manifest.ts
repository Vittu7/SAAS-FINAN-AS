import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeCash - Finanças pessoais",
    short_name: "HomeCash",
    description: "Organize suas finanças pessoais e familiares.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#f5f7fa",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
