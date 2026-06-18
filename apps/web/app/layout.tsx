import type { Metadata } from "next";
import "./globals.css";
import { DevAnnotation } from "./dev-annotation";

export const metadata: Metadata = {
  title: "fin-icons-logos",
  description: "The always-up-to-date registry of crypto token logos.",
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
