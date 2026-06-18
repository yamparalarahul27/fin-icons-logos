import type { Metadata } from "next";
import "./globals.css";
import { DevAnnotation } from "./dev-annotation";

export const metadata: Metadata = {
  title: "Logobase — The complete crypto logo library",
  description:
    "The complete crypto logo library. Search tokens, protocols, networks and wallets, then copy any logo with one click. Free to use.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV !== "production" && <DevAnnotation />}
      </body>
    </html>
  );
}
