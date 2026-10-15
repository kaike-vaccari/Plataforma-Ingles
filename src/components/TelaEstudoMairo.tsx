'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Estudo, SessaoEstudo } from '@/types/estudo';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Volume2,
  ArrowLeft,
  Sparkles,
  Info,
} from 'lucide-react';

interface Props {
  estudoInicial: Estudo;
}

export default function TelaEstudoMairo({ estudoInicial }: Props) {
  const [estudo, setEstudo] = useState<Estudo>(estudoInicial);
  const [diaAtivo, setDiaAtivo] = useState(1);
  const [velocidadeAudio, setVelocidadeAudio] = useState<number>(1);
  const audioPrincipalRef = useRef<HTMLAudioElement | null>(null);

  const sessaoAtual: SessaoEstudo | undefined =
    estudo.sessoes.find((s) => s.numeroDia === diaAtivo) || estudo.sessoes[0];

  useEffect(() => {
    if (audioPrincipalRef.current) {
      audioPrincipalRef.current.playbackRate = velocidadeAudio;
    }
  }, [velocidadeAudio, diaAtivo]);

  const toggleConcluido = async () => {
    if (!sessaoAtual) return;
    const novoStatus = !sessaoAtual.concluido;

    // Atualização otimista
    setEstudo((prev) => ({
      ...prev,
      sessoes: prev.sessoes.map((s) =>
        s.numeroDia === diaAtivo ? { ...s, concluido: novoStatus } : s
      ),
    }));

    try {
      await fetch(`/api/estudos/${estudo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroDia: diaAtivo,
          concluido: novoStatus,
        }),
      });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const mudarVelocidade = (novaVel: number) => {
    setVelocidadeAudio(novaVel);
    if (audioPrincipalRef.current) {
      audioPrincipalRef.current.playbackRate = novaVel;
    }
  };

  const formatarTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-8 px-4">
      {/* Barra de retorno e título */}
      <div className="max-w-[800px] mx-auto mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0a5f84] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar aos Materiais
        </Link>
        <span className="text-xs font-semibold text-slate-400">
          Duração total: {formatarTempo(estudo.duracaoTotal)}
        </span>
      </div>

      {/* Container Principal de Estudo (Estilo Mairo Vergara) */}
      <main className="max-w-[800px] mx-auto bg-[#ffffff] rounded-lg shadow-sm border border-slate-200/80 p-6 md:p-10 text-slate-800">
        {/* Cabeçalho do Estudo */}
        <div className="border-b border-slate-200 pb-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0a5f84] bg-sky-50 px-2.5 py-1 rounded">
                Método Textos com Áudio
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                {estudo.titulo}
              </h1>
            </div>

            <button
              onClick={toggleConcluido}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition flex-shrink-0 ${
                sessaoAtual?.concluido
                  ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {sessaoAtual?.concluido ? 'Dia Concluído ✓' : 'Marcar como Concluído'}
            </button>
          </div>

          {/* Abas de Navegação das Sessões de 1 Minuto (Dia 1, Dia 2...) */}
          {estudo.sessoes.length > 1 && (
            <div className="mt-6">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-2">
                Sessões de 1 Minuto:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {estudo.sessoes.map((s) => (
                  <button
                    key={s.numeroDia}
                    onClick={() => setDiaAtivo(s.numeroDia)}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-1.5 ${
                      s.numeroDia === diaAtivo
                        ? 'bg-[#0a5f84] text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Dia {s.numeroDia}
                    <span className="text-[11px] opacity-80 font-normal">
                      ({formatarTempo(s.inicio)} - {formatarTempo(s.fim)})
                    </span>
                    {s.concluido && (
                      <span className="text-emerald-400 font-bold ml-0.5">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {sessaoAtual ? (
          <div className="space-y-10">
            {/* SEÇÃO 1: ÁUDIO DO TEXTO */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[#0a5f84] font-bold text-lg uppercase tracking-wide flex items-center gap-2">
                  <Volume2 className="w-5 h-5" />
                  ÁUDIO DO TEXTO (DIA {sessaoAtual.numeroDia})
                </h2>

                {/* Controle de Velocidade */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-semibold">
                  <span className="text-slate-500 px-1 text-[11px]">Velocidade:</span>
                  {[0.75, 1, 1.25].map((vel) => (
                    <button
                      key={vel}
                      onClick={() => mudarVelocidade(vel)}
                      className={`px-2 py-0.5 rounded transition ${
                        velocidadeAudio === vel
                          ? 'bg-[#0a5f84] text-white font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {vel}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <audio
                  key={sessaoAtual.audioCompletoUrl}
                  ref={audioPrincipalRef}
                  controls
                  className="w-full"
                >
                  <source src={sessaoAtual.audioCompletoUrl} type="audio/mpeg" />
                  Seu navegador não suporta áudio HTML5.
                </audio>
                <div className="flex justify-between items-center text-xs text-slate-500 mt-2 px-1">
                  <span>Início: {formatarTempo(sessaoAtual.inicio)}</span>
                  <span className="font-medium text-[#0a5f84]">
                    Áudio contínuo de até 1 minuto
                  </span>
                  <span>Fim: {formatarTempo(sessaoAtual.fim)}</span>
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: TEXTO EM COLUNAS */}
            <section>
              <h2 className="text-[#0a5f84] font-bold text-lg uppercase tracking-wide pb-2 mb-4 border-b border-slate-200">
                TEXTO EM COLUNAS
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-justify leading-relaxed text-slate-800 text-base bg-slate-50/50 p-5 rounded-lg border border-slate-200/60">
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase text-[#0a5f84] tracking-wider block">
                    Inglês
                  </span>
                  <p className="text-slate-900 font-medium">
                    {sessaoAtual.textoInglesColuna}
                  </p>
                </div>
                <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                  <span className="text-xs font-bold uppercase text-slate-500 tracking-wider block">
                    Português
                  </span>
                  <p className="text-slate-700">
                    {sessaoAtual.textoPortuguesColuna}
                  </p>
                </div>
              </div>
            </section>

            {/* SEÇÃO 3: TEXTO LINHA A LINHA */}
            <section>
              <div className="flex items-center justify-between pb-2 mb-6 border-b border-slate-200">
                <h2 className="text-[#0a5f84] font-bold text-lg uppercase tracking-wide">
                  TEXTO LINHA A LINHA
                </h2>
                <span className="text-xs text-slate-400 font-medium">
                  {sessaoAtual.blocosLinhaALinha.length} frases curtas (1 a 5s)
                </span>
              </div>

              <div className="space-y-6">
                {sessaoAtual.blocosLinhaALinha.map((bloco, idx) => (
                  <div
                    key={bloco.id}
                    className="p-5 rounded-xl border border-slate-200/80 bg-white hover:border-[#0a5f84]/40 hover:shadow-sm transition space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-bold text-slate-500">
                        Frase #{idx + 1}
                      </span>
                      <span>
                        {formatarTempo(bloco.inicio)} - {formatarTempo(bloco.fim)}
                      </span>
                    </div>

                    {/* Frase em inglês em negrito com destaque */}
                    <div
                      className="text-lg font-bold text-slate-900 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: bloco.inglesHtml }}
                    />

                    {/* Frase em português logo abaixo com destaque */}
                    <div
                      className="text-base text-slate-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: bloco.portuguesHtml }}
                    />

                    {/* Nota pedagógica explicativa */}
                    {bloco.nota && (
                      <div className="bg-sky-50/70 border-l-4 border-[#0a5f84] p-3 rounded-r-lg text-sm text-slate-700 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-[#0a5f84] flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-[#0a5f84]">Nota:</strong>{' '}
                          <span className="italic">{bloco.nota}</span>
                        </div>
                      </div>
                    )}

                    {/* Áudio individual da frase recortado pelo FFmpeg */}
                    <div className="pt-2">
                      <audio controls className="w-full h-9">
                        <source src={bloco.audioFraseUrl} type="audio/mpeg" />
                        Seu navegador não suporta áudio.
                      </audio>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SEÇÃO 4: FOCO DO TEXTO */}
            <section className="bg-sky-50/50 border border-sky-100 rounded-xl p-6">
              <h2 className="text-[#0a5f84] font-bold text-lg uppercase tracking-wide flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-[#0a5f84]" />
                FOCO DO TEXTO
              </h2>
              <ul className="space-y-2.5">
                {sessaoAtual.focoDoTexto.map((ponto, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0a5f84] mt-2 flex-shrink-0" />
                    <span className="leading-relaxed font-medium">{ponto}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Rodapé de Navegação entre Sessões */}
            <div className="border-t border-slate-200 pt-6 flex items-center justify-between">
              <button
                disabled={diaAtivo <= 1}
                onClick={() => setDiaAtivo((d) => Math.max(1, d - 1))}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition ${
                  diaAtivo <= 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-[#0a5f84] hover:bg-sky-50'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Dia Anterior
              </button>

              <span className="text-xs font-semibold text-slate-500">
                Dia {diaAtivo} de {estudo.sessoes.length}
              </span>

              <button
                disabled={diaAtivo >= estudo.sessoes.length}
                onClick={() => setDiaAtivo((d) => Math.min(estudo.sessoes.length, d + 1))}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition ${
                  diaAtivo >= estudo.sessoes.length
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'bg-[#0a5f84] text-white hover:bg-[#084b68] shadow-sm'
                }`}
              >
                Próximo Dia
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center py-8 text-slate-500">Nenhuma sessão encontrada para este estudo.</p>
        )}
      </main>
    </div>
  );
}
