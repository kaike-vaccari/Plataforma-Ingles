import fs from 'fs';
import path from 'path';
import { File as NodeBufferFile } from 'node:buffer';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

if (typeof globalThis.File === 'undefined') {
  globalThis.File = NodeBufferFile;
}

// Carrega .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...values] = trimmed.split('=');
    if (key) process.env[key.trim()] = values.join('=').trim();
  }
}

const estudoId = process.argv[2] || 'estudo_1792089625232_mz82m7';
console.log(`Reprocessando estudo ${estudoId} com Whisper e Gemini...`);

const audioCompletoPath = path.join(process.cwd(), 'public', 'estudos', estudoId, 'audio-completo.mp3');
if (!fs.existsSync(audioCompletoPath)) {
  console.error(`Áudio completo não encontrado em ${audioCompletoPath}`);
  process.exit(1);
}

// 1. Duração
const { stdout } = await execFileAsync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1',
  audioCompletoPath,
]);
const duracaoTotal = parseFloat(stdout.trim());
console.log(`Duração do áudio: ${duracaoTotal.toFixed(2)}s`);

// 2. Whisper com Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
console.log('Enviando para o Groq Whisper com timestamps precisos...');
const transcription = await groq.audio.transcriptions.create({
  file: fs.createReadStream(audioCompletoPath),
  model: 'whisper-large-v3',
  response_format: 'verbose_json',
  temperature: 0,
  language: 'en',
});

// 3. Fusão inteligente
const rawSegments = transcription.segments || [];
console.log(`Whisper retornou ${rawSegments.length} segmentos brutos.`);

const merged = [];
let current = null;

for (let i = 0; i < rawSegments.length; i++) {
  const seg = rawSegments[i];
  const cleanText = seg.text.replace(/^([A-Za-z0-9\s]+):\s*/, '').trim();
  if (!cleanText || cleanText === '.' || cleanText === '...' || cleanText === ',') continue;

  if (!current) {
    current = { start: seg.start, end: seg.end, text: cleanText };
    continue;
  }

  const duracaoAtual = current.end - current.start;
  const duracaoEsteSegmento = seg.end - seg.start;
  const terminaComPontuacao = /[.!?]$/.test(current.text);
  const terminaComAbreviacao = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs)\.$/i.test(current.text);
  const proximoEConectivo = /^(and|but|or|because|so|if|though|um|uh|you know|as|to|that)\b/i.test(cleanText);

  const podeUnir = (duracaoAtual + duracaoEsteSegmento) <= 8.5;
  const deveUnir =
    terminaComAbreviacao ||
    !terminaComPontuacao ||
    duracaoAtual < 2.0 ||
    duracaoEsteSegmento < 1.4 ||
    proximoEConectivo;

  if (podeUnir && deveUnir) {
    current.end = seg.end;
    current.text = `${current.text} ${cleanText}`.trim();
  } else {
    merged.push(current);
    current = { start: seg.start, end: seg.end, text: cleanText };
  }
}
if (current) merged.push(current);

if (merged.length > 1) {
  const ultima = merged[merged.length - 1];
  if (ultima.end - ultima.start < 1.2 || /^(uh|um|so)\b/i.test(ultima.text)) {
    const penultima = merged[merged.length - 2];
    penultima.end = ultima.end;
    penultima.text = `${penultima.text} ${ultima.text}`.trim();
    merged.pop();
  }
}

const segmentos = merged.map((m, idx) => ({
  id: idx + 1,
  start: Math.round(m.start * 100) / 100,
  end: Math.round(m.end * 100) / 100,
  text: m.text,
}));

console.log(`Unificado em ${segmentos.length} sentenças coerentes.`);

// 4. Agrupa em sessões de 60s
const sessoesBrutas = [];
let diaAtual = 1;
let sessaoInicio = segmentos[0].start;
let sessaoSegmentos = [];

for (const seg of segmentos) {
  if (seg.end - sessaoInicio > 60 && sessaoSegmentos.length > 0) {
    const ultimo = sessaoSegmentos[sessaoSegmentos.length - 1];
    sessoesBrutas.push({
      numeroDia: diaAtual,
      inicio: sessaoInicio,
      fim: ultimo.end,
      segmentos: [...sessaoSegmentos],
    });
    diaAtual++;
    sessaoInicio = seg.start;
    sessaoSegmentos = [seg];
  } else {
    sessaoSegmentos.push(seg);
  }
}
if (sessaoSegmentos.length > 0) {
  const ultimo = sessaoSegmentos[sessaoSegmentos.length - 1];
  sessoesBrutas.push({
    numeroDia: diaAtual,
    inicio: sessaoInicio,
    fim: ultimo.end,
    segmentos: [...sessaoSegmentos],
  });
}

console.log(`Criadas ${sessoesBrutas.length} sessões de até 60s.`);

// Função resiliente com retry para Gemini
async function chamarGeminiResiliente(prompt) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelos = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-flash-latest'];

  for (let i = 0; i < 4; i++) {
    const modeloNome = modelos[i % modelos.length];
    try {
      const model = genAI.getGenerativeModel({
        model: modeloNome,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      return JSON.parse(text);
    } catch (err) {
      console.warn(`Tentativa ${i + 1} (${modeloNome}) falhou: ${err.message.substring(0, 80)}. Aguardando...`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
}

const sessoesFinais = [];

for (const grupo of sessoesBrutas) {
  console.log(`Enriquecendo Sessão ${grupo.numeroDia} com IA...`);
  const prompt = `Você é um especialista em ensino de inglês pelo método "Textos com Áudio" (estilo Mairo Vergara).
Analise os seguintes blocos de frases em inglês extraídos de um áudio da Sessão ${grupo.numeroDia}:

${JSON.stringify(grupo.segmentos.map((s) => ({ id: s.id, text: s.text, inicio: s.start, fim: s.end })), null, 2)}

Tarefas obrigatórias:
1. Gere o texto corrido completo em inglês ("textoInglesColuna") unindo as frases de forma natural.
2. Gere a tradução corrida completa em português brasileiro natural ("textoPortuguesColuna").
3. Para CADA bloco de frase (respeitando o mesmo "id"), gere:
   - "inglesHtml": Frase original em inglês aplicando a tag <span class="highlight">TERMO</span> nos termos-chave, verbos essenciais, phrasal verbs ou expressões importantes. NÃO separe títulos honoríficos como Mr., Mrs., Dr. do nome que os acompanha.
   - "portuguesHtml": Tradução correspondente em português aplicando a mesma tag <span class="highlight">TERMO EQUIVALENTE</span> exatamente no termo correspondente ao grifado em inglês.
   - "nota": Uma breve explicação gramatical ou de vocabulário esclarecendo o sentido da expressão grifada ou nuances de uso (ou null se for muito simples).
4. Em "focoDoTexto", forneça uma lista com 2 a 4 pontos resumindo estruturas, tempos verbais ou vocabulário que o aluno deve dominar nesta sessão de 1 minuto.

Devolva ESTRITAMENTE o formato JSON conforme esta interface:
{
  "textoInglesColuna": string,
  "textoPortuguesColuna": string,
  "focoDoTexto": string[],
  "blocosLinhaALinha": [
    {
      "id": number,
      "inglesHtml": string,
      "portuguesHtml": string,
      "nota": string | null
    }
  ]
}`;

  let parsed = await chamarGeminiResiliente(prompt);

  const blocosLinhaALinha = grupo.segmentos.map((seg, idx) => {
    const blocoIA = parsed?.blocosLinhaALinha?.find((b) => b.id === seg.id) || parsed?.blocosLinhaALinha?.[idx];
    return {
      id: seg.id,
      inicio: seg.start,
      fim: seg.end,
      inglesHtml: blocoIA?.inglesHtml || `<span class="highlight">${seg.text}</span>`,
      portuguesHtml: blocoIA?.portuguesHtml || seg.text,
      nota: blocoIA?.nota || null,
      audioFraseUrl: `/estudos/${estudoId}/sessao-${grupo.numeroDia}/frase-${seg.id}.mp3`,
    };
  });

  sessoesFinais.push({
    numeroDia: grupo.numeroDia,
    concluido: false,
    inicio: grupo.inicio,
    fim: grupo.fim,
    audioCompletoUrl: `/estudos/${estudoId}/sessao-${grupo.numeroDia}/audio-sessao.mp3`,
    textoInglesColuna: parsed?.textoInglesColuna || grupo.segmentos.map((s) => s.text).join(' '),
    textoPortuguesColuna: parsed?.textoPortuguesColuna || '',
    blocosLinhaALinha,
    focoDoTexto: parsed?.focoDoTexto || ['Prática de listening e repetição com áudio nativo'],
  });
}

// 6. Recorte físico no FFmpeg com padding
console.log('Executando recortes físicos no FFmpeg com padding de alta fidelidade...');
const publicBaseDir = path.join(process.cwd(), 'public', 'estudos', estudoId);

for (const sessao of sessoesFinais) {
  const sessaoDir = path.join(publicBaseDir, `sessao-${sessao.numeroDia}`);
  await fs.promises.mkdir(sessaoDir, { recursive: true });

  // Áudio da sessão
  const audioSessaoPath = path.join(sessaoDir, 'audio-sessao.mp3');
  const durSessao = Math.max(0.5, sessao.fim - sessao.inicio);
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss', sessao.inicio.toFixed(3),
    '-t', durSessao.toFixed(3),
    '-i', audioCompletoPath,
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    audioSessaoPath,
  ]);

  // Áudios das frases
  for (const bloco of sessao.blocosLinhaALinha) {
    const frasePath = path.join(sessaoDir, `frase-${bloco.id}.mp3`);
    const padInicio = 0.12;
    const padFim = 0.20;
    const startSec = Math.max(0, bloco.inicio - padInicio);
    const durationSec = Math.max(0.3, (bloco.fim + padFim) - startSec);

    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', startSec.toFixed(3),
      '-t', durationSec.toFixed(3),
      '-i', audioCompletoPath,
      '-acodec', 'libmp3lame',
      '-q:a', '2',
      frasePath,
    ]);
  }
}

// 7. Salva o novo estudo.json
const jsonPath = path.join(process.cwd(), 'data', 'estudos', estudoId, 'estudo.json');
const estudoAntigo = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const estudoNovo = {
  ...estudoAntigo,
  duracaoTotal: Math.round(duracaoTotal * 10) / 10,
  sessoes: sessoesFinais,
};

fs.writeFileSync(jsonPath, JSON.stringify(estudoNovo, null, 2), 'utf-8');
console.log('✅ REPROCESSAMENTO CONCLUÍDO COM SUCESSO!');
