import type { Metadata } from "next";
import "./globals.css";
import "./forensic-ledger.css";

export const metadata: Metadata = {
  title: "AnteSig | Preflight Workbench",
  description:
    "Inspect intent, prepared capability, simulation evidence, and bounded decisions before signer review.",
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
