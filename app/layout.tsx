import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeTasks",
  description: "A simple shared app to manage household chores."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
