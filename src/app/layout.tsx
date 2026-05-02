import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Ledger",
  description: "Track poker game sessions and settle up",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
