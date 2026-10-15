import Navbar from '@/components/Navbar';
import ListaEstudos from '@/components/ListaEstudos';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Estudos de Inglês
          </h1>
          <p className="text-slate-600 mt-1.5 text-sm md:text-base">
            Textos com Áudio divididos em sessões de no máximo 60 segundos com o método Mairo Vergara.
          </p>
        </div>

        <ListaEstudos />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        English Studio • Plataforma de Estudos com Áudio Físico & IA
      </footer>
    </div>
  );
}
