import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bridge",
    short_name: "Bridge",
    description: "Real-time Bridge & Bid Whist, played in the browser.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#060a08",
    theme_color: "#060a08",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
