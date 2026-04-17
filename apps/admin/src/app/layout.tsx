import type { Metadata } from 'next';
import './globals.css';
import { PostHogProvider } from '../components/PostHogProvider';

export const metadata: Metadata = {
  title: 'Health Coach Admin',
  description: 'Admin portal for Health Coach platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
