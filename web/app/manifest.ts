import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kairos",
    short_name: "Kairos",
    description: "Your tasks and calendar, at the right moment.",
    start_url: "/",
    display: "standalone",
    background_color: "#14121f",
    theme_color: "#14121f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
