import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col min-w-0 pl-0 transition-all duration-300 md:pl-60">
              <Header />
              <main className="flex-1 overflow-x-hidden bg-muted/30 p-4 md:p-6">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
