import type { Metadata } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://etfplaybook.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Event Fund Playbook — Texas Events Trust Fund Analysis",
    template: "%s · Event Fund Playbook",
  },
  description:
    "Analyze prospective events against Texas Events Trust Fund eligibility, project state and local tax contributions, track every statutory deadline, and generate your application packet — built for destination marketing organizations.",
  keywords: [
    "Texas Events Trust Fund",
    "ETF application",
    "event trust fund eligibility",
    "DMO tools",
    "sports tourism",
    "destination marketing",
    "economic impact analysis",
    "Texas event funding",
  ],
  openGraph: {
    title: "Event Fund Playbook — Texas Events Trust Fund Analysis",
    description:
      "Eligibility checks, economic impact projections, deadline tracking, and application packets for the Texas Events Trust Fund.",
    url: APP_URL,
    siteName: "Event Fund Playbook",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Event Fund Playbook — Texas Events Trust Fund Analysis",
    description:
      "Eligibility checks, economic impact projections, deadline tracking, and application packets for the Texas Events Trust Fund.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
