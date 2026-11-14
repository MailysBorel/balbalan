import './globals.css';
import { SW } from '../components/ui';
export const metadata = {
  title: 'Balbalan', description: 'Scores en direct : foot, basket, tennis', manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Balbalan', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};
export const viewport = { themeColor: '#0B0D2B', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function RootLayout({ children }) {
  return (
    <html lang="fr"><head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500;700&family=Unbounded:wght@700;900&display=swap" />
    </head><body>{children}<SW /></body></html>
  );
}
