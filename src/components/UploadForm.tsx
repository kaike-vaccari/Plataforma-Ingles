'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const ETAPAS_PROCESSAMENTO = [
  'Enviando arquivo para o servidor local...',
  'FFmpeg: Extraindo áudio e normalizando para MP3...',
  'Whisper: Identificando falas e alinhando timestamps (1 a 5s)...',
  'Dividindo em sessões diárias de até 60 segundos...',
  'Gemini AI: Traduzindo, grifando termos equivalentes e gerando notas...',
  'FFmpeg: Executando recorte físico dos áudios por sessão e frases...',
  'Pronto! Salvando dados do estudo...',
];

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [transcricaoManual, setTranscricaoManual] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [etapaIndice, setEtapaIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (file: File) => {
    setArquivo(file);
    if (!titulo) {
      const nomeLimpo = file.name.replace(/\.[^/.]+$/, '');
      setTitulo(nomeLimpo);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivo) {
      setErro('Por favor, selecione um arquivo de vídeo (.mp4) ou áudio (.mp3, .wav, .m4a).');
      return;
    }

    setCarregando(true);
    setErro(null);
    setEtapaIndice(0);

    // Efeito visual de progressão de etapas enquanto o back-end processa
    const interval = setInterval(() => {
      setEtapaIndice((prev) => {
        if (prev < ETAPAS_PROCESSAMENTO.length - 2) {
          return prev + 1;
        }
        return prev;
      });
    }, 4500);

    try {
      const formData = new FormData();
      formData.append('file', arquivo);
      if (titulo.trim()) formData.append('titulo', titulo.trim());
      if (transcricaoManual.trim()) formData.append('transcricaoManual', transcricaoManual.trim());

      const res = await fetch('/api/estudos/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detalhes || errData.error || 'Erro no processamento do arquivo.');
      }

      setEtapaIndice(ETAPAS_PROCESSAMENTO.length - 1);
      const data = await res.json();

      setTimeout(() => {
        router.push(`/estudo/${data.estudo.id}`);
      }, 800);
    } catch (err: unknown) {
      clearInterval(interval);
      setCarregando(false);
      setErro((err as Error).message || 'Ocorreu um erro ao processar o estudo.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
          Criar Novo Estudo
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Faça upload de um vídeo ou áudio. O sistema criará as sessões de no máximo 60 segundos com o duplo recorte de áudio e estudo pedagógico.
        </p>
      </div>

      {erro && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro ao processar estudo</p>
            <p className="mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-12 h-12 text-[#0a5f84] animate-spin mb-6" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Processando seu material de estudo...
          </h3>
          <p className="text-sm text-[#0a5f84] font-semibold bg-sky-50 px-4 py-2 rounded-full border border-sky-100 mb-6">
            {ETAPAS_PROCESSAMENTO[etapaIndice]}
          </p>

          <div className="w-full max-w-md bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#0a5f84] h-2.5 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${((etapaIndice + 1) / ETAPAS_PROCESSAMENTO.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-slate-400 mt-3">
            O FFmpeg e a IA estão preparando o material sob medida. Não feche a página.
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Zona de Arrastar e Soltar */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              isDragOver
                ? 'border-[#0a5f84] bg-sky-50/50'
                : arquivo
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 hover:border-[#0a5f84] hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/x-m4a,audio/m4a"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            {arquivo ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="font-semibold text-slate-800">{arquivo.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(arquivo.size / (1024 * 1024)).toFixed(2)} MB • Clique para trocar de arquivo
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-sky-50 text-[#0a5f84] flex items-center justify-center mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="font-semibold text-slate-700">
                  Arraste o vídeo ou áudio aqui, ou <span className="text-[#0a5f84] underline">procure no seu Linux</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Formatos aceitos: MP4, MP3, WAV, M4A, WEBM
                </p>
              </div>
            )}
          </div>

          {/* Título do Estudo */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Título do Estudo
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Aula 01 - Peter Johnson & Daily Routine"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a5f84] focus:border-transparent text-sm"
              required
            />
          </div>

          {/* Transcrição Manual (Opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Texto / Transcrição Original <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <span className="text-xs text-slate-400">Ajuda no alinhamento fino</span>
            </div>
            <textarea
              rows={4}
              value={transcricaoManual}
              onChange={(e) => setTranscricaoManual(e.target.value)}
              placeholder="Se você já possui o texto em inglês deste áudio/vídeo, cole aqui para garantir fidelidade 100%..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a5f84] focus:border-transparent text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!arquivo}
            className={`w-full py-3.5 px-6 rounded-lg font-bold text-white shadow-sm transition flex items-center justify-center gap-2 ${
              arquivo
                ? 'bg-[#0a5f84] hover:bg-[#084b68] active:scale-[0.99]'
                : 'bg-slate-300 cursor-not-allowed'
            }`}
          >
            <UploadCloud className="w-5 h-5" />
            Processar e Gerar Estudo
          </button>
        </form>
      )}
    </div>
  );
}
