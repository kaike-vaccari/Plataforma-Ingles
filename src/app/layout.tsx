import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'English Studio - Método Textos com Áudio',
  description: 'Plataforma de estudos de inglês por Textos com Áudio divididos em sessões de até 1 minuto com alinhamento Whisper e enriquecimento didático Gemini.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#f5f5f5] text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}
