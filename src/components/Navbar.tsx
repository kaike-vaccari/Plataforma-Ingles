'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, UploadCloud, Library, CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusApi {
  groq: { ok: boolean; mensagem: string };
  gemini: { ok: boolean; mensagem: string; modelo?: string };
  openai: { ok: boolean; mensagem: string };
}

export default function Navbar() {
  const pathname = usePathname();
  const [status, setStatus] = useState<StatusApi | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  }, []);

  const apisOk = status?.groq.ok && status?.gemini.ok;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-lg bg-[#0a5f84] text-white flex items-center justify-center font-bold shadow-sm group-hover:bg-[#084b68] transition">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-800 tracking-tight block leading-tight">
                English Studio
              </span>
              {status && (
                <div
                  title={`Groq Whisper: ${status.groq.mensagem}\nGemini: ${status.gemini.mensagem}\nOpenAI: ${status.openai.mensagem}`}
                  className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition cursor-help ${
                    apisOk
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {apisOk ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      APIs Conectadas
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      Verificar APIs
                    </>
                  )}
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Método Textos com Áudio
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className={`px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 transition ${
              pathname === '/'
                ? 'text-[#0a5f84] bg-sky-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Library className="w-4 h-4" />
            Meus Estudos
          </Link>
          <Link
            href="/novo"
            className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5 transition ${
              pathname === '/novo'
                ? 'bg-[#0a5f84] text-white shadow-sm'
                : 'bg-[#0a5f84]/10 text-[#0a5f84] hover:bg-[#0a5f84] hover:text-white'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Novo Estudo
          </Link>
        </nav>
      </div>
    </header>
  );
}
