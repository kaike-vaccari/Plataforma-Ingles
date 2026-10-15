import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { extrairAudio, obterDuracao, processarRecortesFisicos } from '@/lib/ffmpeg';
import { transcreverAudio, agruparSegmentosEmSessoes, enriquecerSessaoComGemini } from '@/lib/ai-processor';
import { salvarEstudo } from '@/lib/estudos-store';
import { Estudo, SessaoEstudo } from '@/types/estudo';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tituloInput = formData.get('titulo') as string | null;
    const transcricaoManual = (formData.get('transcricaoManual') as string | null) || undefined;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo de áudio ou vídeo foi enviado.' },
        { status: 400 }
      );
    }

    const estudoId = `estudo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const originalFileName = file.name || 'audio-video.mp4';
    const titulo = tituloInput?.trim() || originalFileName.replace(/\.[^/.]+$/, '');

    // Diretório temporário para processamento de entrada
    const tmpDir = path.join(process.cwd(), 'tmp', estudoId);
    await fs.mkdir(tmpDir, { recursive: true });

    const inputExt = path.extname(originalFileName) || '.mp4';
    const tempInputFilePath = path.join(tmpDir, `input${inputExt}`);
    const tempPrincipalMp3Path = path.join(tmpDir, 'audio_principal.mp3');

    // Grava o arquivo recebido no disco
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempInputFilePath, Buffer.from(arrayBuffer));

    console.log(`[Upload] Extraindo/normalizando áudio com FFmpeg para ${estudoId}...`);
    // 1. Converte/extrai para MP3 limpo
    await extrairAudio(tempInputFilePath, tempPrincipalMp3Path);

    // 2. Obtém a duração total com precisão de milissegundos
    const duracaoTotal = await obterDuracao(tempPrincipalMp3Path);
    console.log(`[Upload] Duração detectada: ${duracaoTotal.toFixed(2)}s`);

    // 3. Transcreve com Whisper para obter timestamps de 1 a 5 segundos
    console.log(`[Upload] Alinhando timestamps com Whisper...`);
    const segmentos = await transcreverAudio(
      tempPrincipalMp3Path,
      duracaoTotal,
      transcricaoManual
    );

    // 4. Agrupa os segmentos em sessões diárias de no máximo 60 segundos
    console.log(`[Upload] Agrupando em sessões de até 60 segundos...`);
    const gruposSessoes = agruparSegmentosEmSessoes(segmentos);

    // 5. Enriquece cada sessão com Google Gemini (tradução, destaques e notas)
    console.log(`[Upload] Enriquecendo com Gemini (${gruposSessoes.length} sessões)...`);
    const sessoes: SessaoEstudo[] = [];
    for (const grupo of gruposSessoes) {
      const sessaoEnriquecida = await enriquecerSessaoComGemini(grupo, estudoId);
      sessoes.push(sessaoEnriquecida);
    }

    // 6. Recorte Físico Duplo com FFmpeg:
    //    - audio-sessao.mp3 (até 60s)
    //    - frase-[id].mp3 (1 a 5s)
    console.log(`[Upload] Executando recortes físicos no FFmpeg...`);
    await processarRecortesFisicos(tempPrincipalMp3Path, estudoId, sessoes);

    // 7. Salva o objeto do Estudo completo no data/estudos/[id]/estudo.json
    const estudoCompleto: Estudo = {
      id: estudoId,
      titulo,
      criadoEm: new Date().toISOString().split('T')[0],
      duracaoTotal: Math.round(duracaoTotal * 10) / 10,
      sessoes,
    };

    await salvarEstudo(estudoCompleto);
    console.log(`[Upload] Estudo ${estudoId} processado e salvo com sucesso!`);

    // Limpeza dos arquivos temporários
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Aviso ao limpar temporários:', cleanupErr);
    }

    return NextResponse.json({
      success: true,
      estudo: estudoCompleto,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Erro no processamento do upload:', err);
    return NextResponse.json(
      {
        error: 'Falha durante o processamento do vídeo/áudio.',
        detalhes: err.message || String(err),
      },
      { status: 500 }
    );
  }
}
