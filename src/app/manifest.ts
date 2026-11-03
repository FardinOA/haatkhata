import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BechaKena — stock, sales & invoices",
    short_name: "BechaKena",
    description: "Stock, sales and invoicing for online and social sellers.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F4F0",
    theme_color: "#F3F4F0",
    lang: "en",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New order", short_name: "New order", url: "/pos" },
      { name: "Orders", url: "/orders" },
    ],
  };
}
