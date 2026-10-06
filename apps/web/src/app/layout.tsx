import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
const geist = localFont({
  src: '../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
  variable: '--font-geist',
  display: 'swap',
});
import './globals.css';
import { Toaster } from '@crm/ui';
import { AuthProvider } from '@/features/auth/auth-provider';
export const metadata: Metadata = {
  title: { default: 'CRM', template: '%s · CRM' },
  description: 'Seu espaço de trabalho comercial, conectado à sua equipe.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geist.variable} ${geist.className} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
