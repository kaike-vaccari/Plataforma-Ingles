'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, UploadCloud, Library } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-lg bg-[#0a5f84] text-white flex items-center justify-center font-bold shadow-sm group-hover:bg-[#084b68] transition">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-800 tracking-tight block leading-tight">
              English Studio
            </span>
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
