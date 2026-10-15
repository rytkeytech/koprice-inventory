import type { MetadataRoute } from "next";

// PWA manifest: lets staff "Add to Home Screen" on the shop phones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koprice Enterprise",
    short_name: "Koprice",
    description: "Koprice Enterprise inventory and sales",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f6f2",
    theme_color: "#166534",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
