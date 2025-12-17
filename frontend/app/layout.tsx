import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";  // Sans font
import { GeistMono } from "geist/font/mono";  // Mono font (separate module)
import "./globals.css";

export const metadata: Metadata = {
  title: "Smartgecode – Fast Geocoding for Businesses",
  description: "Transform addresses into lat/lng coordinates. Free trial, premium batch processing for $29/mo. Save time on location data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-white text-gray-900`}>
        {children}
      </body>
    </html>
  );
}