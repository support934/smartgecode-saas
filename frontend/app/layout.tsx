import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientHeader from './ClientHeader';  // Global client header

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Smartgeocode',
  description: 'Geocode app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientHeader />
        {children}
      </body>
    </html>
  );
}