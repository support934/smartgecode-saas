import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientHeader from './ClientHeader'; // Global client header
import Script from 'next/script';
import Image from 'next/image';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Smartgeocode',
  description: 'Geocode app for precise lat/lng coordinates',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Favicon from favicon.io */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/android-chrome-512x512.png" /> {/* High-res for Apple */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />

        {/* Load Stripe.js globally */}
        <Script
          src="https://js.stripe.com/v3/"
          strategy="beforeInteractive"
        />
      </head>
      <body className={inter.className}>
        {/* Header with Logo */}
        <header className="bg-red-600 text-white p-5 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image
                src="/android-chrome-512x512.png" // Use your high-res PNG as logo
                alt="Smartgeocode Logo"
                width={60}
                height={60}
                priority
                className="rounded-full"
              />
              <h1 className="text-3xl font-bold">smartgeocode</h1>
            </div>

            {/* Global Client Header (your existing component for login/logout/etc.) */}
            <ClientHeader />
          </div>
        </header>

        {/* Main content */}
        {children}
      </body>
    </html>
  );
}