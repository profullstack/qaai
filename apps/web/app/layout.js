import './globals.css';

export const metadata = {
  title: 'QAAI - AI-Driven QA Platform',
  description: 'Automated E2E testing with AI-powered test generation',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}