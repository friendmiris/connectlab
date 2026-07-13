import './globals.css';

export const metadata = {
  title: 'CLIPPING — 기사를 오려, 나만의 매거진을 만들다',
  description: '뷰티·패션·IT·인문학·경제·시사 기사를 골라 AI 카드뉴스 5컷을 자동으로 만들어보세요.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&family=Noto+Sans+KR:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
