import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1A2744', 
};

export const metadata: Metadata = {
  // ESTA ES LA LÍNEA MÁGICA PARA QUE WHATSAPP ENCUENTRE EL LOGO
  metadataBase: new URL('https://comedor-fiscalia.vercel.app'),
  title: 'Comedor Fiscalía',
  description: 'Sistema de Gestión del Comedor',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
  openGraph: {
    title: 'Comedor Fiscalía',
    description: 'Sistema de Gestión del Comedor',
    url: 'https://comedor-fiscalia.vercel.app',
    siteName: 'Comedor Fiscalía',
    images: [
      {
        url: '/icon-512x512.png', // Ahora sabrá que está en https://comedor-fiscalia.vercel.app/icon-512x512.png
        width: 512,
        height: 512,
        alt: 'Comedor Fiscalía Logo',
      },
    ],
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}