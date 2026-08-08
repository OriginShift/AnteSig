import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnteSig | Preflight Workbench",
  description:
    "Inspect structured Monad preflight evidence before wallet review.",
  applicationName: "AnteSig",
  icons: {
    icon: "/brand/antesig-logo.png",
    apple: "/brand/antesig-logo.png",
  },
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
