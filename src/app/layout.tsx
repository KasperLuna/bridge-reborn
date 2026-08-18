import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { MotionConfig } from "motion/react";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Bridge",
  description: "Real-time Bridge & Bid Whist, played in the browser.",
  applicationName: "Bridge",
  appleWebApp: {
    capable: true,
    title: "Bridge",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#060a08",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`}>
      <body>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
