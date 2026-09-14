import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baseline Padel Tournament",
  description: "Private padel tournament manager"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
