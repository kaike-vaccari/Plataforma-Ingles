import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { SessaoEstudo } from '@/types/estudo';

const execFileAsync = promisify(execFile);

/**
 * Obtém a duração total em segundos de um arquivo de mídia usando ffprobe
 */
export async function obterDuracao(inputPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ]);
    const duration = parseFloat(stdout.trim());
    return isNaN(duration) ? 0 : duration;
  } catch (error) {
    console.error('Erro ao obter duração com ffprobe:', error);
    return 0;
  }
}

/**
 * Extrai o áudio de um vídeo ou converte qualquer formato de áudio para MP3 padrão
 */
export async function extrairAudio(inputPath: string, outputPath: string): Promise<string> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-vn', // Sem vídeo
    '-acodec', 'libmp3lame',
    '-q:a', '2', // Alta qualidade VBR (~190kbps)
    '-ar', '44100', // Taxa de amostragem padrão
    outputPath
  ]);

  return outputPath;
}

/**
 * Recorta um trecho específico de áudio com precisão de milissegundos e
 * margem sutil (padding) para não cortar a respiração inicial nem a última consoante/sílaba.
 */
export async function recortarAudio(
  inputPath: string,
  outputPath: string,
  inicio: number,
  fim: number,
  adicionarPadding = true
): Promise<string> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  // Margem de segurança de 120ms antes e 200ms depois para sons naturais
  const padInicio = adicionarPadding ? 0.12 : 0;
  const padFim = adicionarPadding ? 0.20 : 0;

  const startSec = Math.max(0, inicio - padInicio);
  const durationSec = Math.max(0.3, (fim + padFim) - startSec);

  await execFileAsync('ffmpeg', [
    '-y',
    '-ss', startSec.toFixed(3),
    '-t', durationSec.toFixed(3),
    '-i', inputPath,
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    '-ar', '44100',
    outputPath
  ]);

  return outputPath;
}

/**
 * Executa o duplo corte físico do FFmpeg para todas as sessões e frases:
 * 1. audio-sessao.mp3 para cada minuto de estudo (sem padding exagerado)
 * 2. frase-[id].mp3 para cada frase curta sincronizada com Whisper
 */
export async function processarRecortesFisicos(
  audioPrincipalMp3: string,
  estudoId: string,
  sessoes: SessaoEstudo[]
): Promise<void> {
  const publicBaseDir = path.join(process.cwd(), 'public', 'estudos', estudoId);

  for (const sessao of sessoes) {
    const sessaoDir = path.join(publicBaseDir, `sessao-${sessao.numeroDia}`);
    await fs.mkdir(sessaoDir, { recursive: true });

    // 1. Recorte do Áudio Contínuo da Sessão (até 60s)
    const audioSessaoPath = path.join(sessaoDir, 'audio-sessao.mp3');
    await recortarAudio(
      audioPrincipalMp3,
      audioSessaoPath,
      sessao.inicio,
      sessao.fim,
      false // Sem padding extra na sessão completa
    );

    // 2. Recortes Físicos Individuais de cada frase da sessão (com padding suave)
    for (const bloco of sessao.blocosLinhaALinha) {
      const audioFrasePath = path.join(sessaoDir, `frase-${bloco.id}.mp3`);
      await recortarAudio(
        audioPrincipalMp3,
        audioFrasePath,
        bloco.inicio,
        bloco.fim,
        true // Com padding para não cortar a fala
      );
    }
  }
}
