import type { Metadata, Viewport } from 'next';
import './globals.css';

// ESTO ES LO QUE ARREGLA EL CELULAR
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Evita que el iPhone haga zoom al picar el cuadro de texto
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Comedor FGE',
  description: 'Sistema de Gestión del Comedor Fiscalía',
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