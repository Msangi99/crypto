import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cryptoloanboost.com"),
  title: {
    default: "Crypto Loan Boost",
    template: "%s · Crypto Loan Boost",
  },
  description:
    "CryptoLoanBoost runs on BNB Smart Chain — leveraged pools, CLB loans, referrals, and on-chain transparency.",
  applicationName: "Crypto Loan Boost",
  openGraph: {
    title: "Crypto Loan Boost",
    description:
      "Leveraged DeFi on BNB Smart Chain. Pools, loans, and liquidation logic you can verify on-chain.",
    url: "https://cryptoloanboost.com",
    siteName: "Crypto Loan Boost",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Loan Boost",
    description: "Leveraged DeFi on BNB Smart Chain — CryptoLoanBoost.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0D0D0D] text-[#F5F5F5] font-sans">
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
