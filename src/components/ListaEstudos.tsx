'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Estudo } from '@/types/estudo';
import { PlayCircle, Trash2, Calendar, Clock, Layers, CheckCircle2, Plus } from 'lucide-react';

export default function ListaEstudos() {
  const [estudos, setEstudos] = useState<Estudo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const carregarEstudos = async () => {
    try {
      const res = await fetch('/api/estudos');
      const data = await res.json();
      setEstudos(data.estudos || []);
    } catch (err) {
      console.error('Erro ao buscar estudos:', err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarEstudos();
  }, []);

  const handleExcluir = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Deseja realmente excluir este estudo e todos os áudios gerados?')) return;

    setExcluindoId(id);
    try {
      const res = await fetch(`/api/estudos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEstudos((prev) => prev.filter((est) => est.id !== id));
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setExcluindoId(null);
    }
  };

  const formatarDuracao = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60);
    return `${min}m ${sec < 10 ? '0' : ''}${sec}s`;
  };

  if (carregando) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (estudos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-full bg-sky-50 text-[#0a5f84] flex items-center justify-center mx-auto mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhum estudo criado ainda</h3>
        <p className="text-sm text-slate-500 mb-6">
          Faça upload do seu primeiro áudio ou vídeo para gerar automaticamente as sessões diárias de 1 minuto no método Textos com Áudio.
        </p>
        <Link
          href="/novo"
          className="inline-flex items-center gap-2 bg-[#0a5f84] hover:bg-[#084b68] text-white px-5 py-3 rounded-lg font-bold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Criar Primeiro Estudo
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-slate-800">
          Meus Materiais ({estudos.length})
        </h2>
        <Link
          href="/novo"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0a5f84] hover:bg-[#084b68] px-3 py-2 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo Material
        </Link>
      </div>

      <div className="grid gap-4">
        {estudos.map((estudo) => {
          const totalDias = estudo.sessoes.length;
          const concluidos = estudo.sessoes.filter((s) => s.concluido).length;
          const porcentagem = totalDias > 0 ? Math.round((concluidos / totalDias) * 100) : 0;

          return (
            <div
              key={estudo.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-[#0a5f84]/50 hover:shadow-md transition group relative"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#0a5f84] transition">
                      {estudo.titulo}
                    </h3>
                    {porcentagem === 100 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Concluído
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatarDuracao(estudo.duracaoTotal)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {totalDias} {totalDias === 1 ? 'Sessão / Dia' : 'Sessões (Dias)'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {estudo.criadoEm}
                    </span>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="w-full max-w-xs pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>Progresso: {concluidos} de {totalDias} dias</span>
                      <span className="font-semibold text-slate-700">{porcentagem}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${porcentagem}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={(e) => handleExcluir(estudo.id, e)}
                    disabled={excluindoId === estudo.id}
                    title="Excluir estudo"
                    className="p-2.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/estudo/${estudo.id}`}
                    className="inline-flex items-center gap-1.5 bg-[#0a5f84] hover:bg-[#084b68] text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-sm transition"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Estudar
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
