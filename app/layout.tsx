import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SmartBanca", template: "%s | SmartBanca" },
  description: "Gestão inteligente de banca esportiva, do depósito ao cashout.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"))
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
