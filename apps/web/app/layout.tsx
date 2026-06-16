import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fin-icons-logos — admin",
  description: "Review & curation queue for crypto token logos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
