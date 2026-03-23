import type { Metadata } from "next";
import { SessionProvider } from "@/components/layout/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Dev Platform — Understand Your Codebase",
  description:
    "AI-powered developer productivity platform. Code review, bug explanation, documentation generation, and repository Q&A powered by AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0e17] antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
