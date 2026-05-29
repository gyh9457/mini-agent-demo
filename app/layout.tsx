import './globals.css';

export const metadata = {
  title: 'PR 摘要 Agent',
  description: 'AI 驱动的 GitHub PR 摘要工具',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
