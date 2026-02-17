import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "DealFlow - Acquisition Deal Sourcing",
  description: "Business acquisition deal sourcing and pipeline management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
