import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { TopNav } from '@/components/layout/TopNav';

export const metadata: Metadata = {
  title: {
    default: 'Aksioma Stationery',
    template: '%s · Aksioma Stationery',
  },
  description: 'Ofis malzemeleri ve kırtasiye — sana özel fiyatlarla.',
  applicationName: 'Aksioma Stationery',
  openGraph: {
    type: 'website',
    siteName: 'Aksioma Stationery',
    title: 'Aksioma Stationery',
    description: 'Ofis malzemeleri ve kırtasiye — sana özel fiyatlarla.',
    locale: 'tr_TR',
  },
  twitter: {
    card: 'summary',
    title: 'Aksioma Stationery',
    description: 'Ofis malzemeleri ve kırtasiye — sana özel fiyatlarla.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              var s = JSON.parse(localStorage.getItem('aks-theme') || '{}');
              if (s && s.state && s.state.theme === 'dark') {
                document.documentElement.classList.add('dark');
              }
            } catch (e) {}`,
          }}
        />
      </head>
      <body>
        <Providers>
          <TopNav />
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
