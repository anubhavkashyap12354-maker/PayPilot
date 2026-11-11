import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "PayPilot — AI-Powered Payment Operations Copilot",
  description:
    "PayPilot is a premium AI-powered business payment operations copilot integrating PayPal checkout analytics, order tracking, and financial intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
