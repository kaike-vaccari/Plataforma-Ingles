import Navbar from '@/components/Navbar';
import UploadForm from '@/components/UploadForm';

export default function NovoEstudoPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:py-10">
        <UploadForm />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        English Studio • Plataforma de Estudos com Áudio Físico & IA
      </footer>
    </div>
  );
}
