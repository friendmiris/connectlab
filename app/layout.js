import './globals.css';

export const metadata = {
  title: 'CLIPPING — 기사를 오려, 나만의 매거진을 만들다',
  description: '뷰티·패션·IT·인문학·경제·시사 기사를 골라 AI 카드뉴스를 자동으로 만들어보세요.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
