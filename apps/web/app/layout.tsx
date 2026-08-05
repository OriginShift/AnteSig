import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moss-Mini Demo",
  description: "Web and API baseline for the Moss-Mini Demo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
