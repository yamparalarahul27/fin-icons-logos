import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fin-icons-logos",
  description: "The always-up-to-date registry of crypto token logos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
