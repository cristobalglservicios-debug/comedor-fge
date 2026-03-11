import type { Metadata, Viewport } from 'next';
import './globals.css';

// ESTO ES LO QUE ARREGLA EL CELULAR (Y PINTA LA BARRA EN ANDROID)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Evita que el iPhone haga zoom al picar el cuadro de texto
  userScalable: false,
  themeColor: '#1A2744', 
};

export const metadata: Metadata = {
  title: 'Comedor FGE',
  description: 'Sistema de Gestión del Comedor Fiscalía',
  manifest: '/manifest.json', // ESTA ES LA CONEXIÓN PARA ANDROID
  icons: {
    icon: '/logo-fge.png',
    apple: '/logo-fge.png',
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