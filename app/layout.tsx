import type { Metadata, Viewport } from 'next';
import GoogleAnalytics from '@/components/google-analytics';
import './globals.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };
export const metadata: Metadata = { title: '치이카와 만지작 연구소 ♡', description: '너무 많이 만지지 마세요! 작고 귀여운 친구들과 함께하는 엉뚱한 터치 실험실.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="ko"><body>{children}<GoogleAnalytics /></body></html>; }
