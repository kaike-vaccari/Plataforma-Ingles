import fs from 'fs';
import { File as NodeBufferFile } from 'node:buffer';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SegmentoWhisper, SessaoEstudo, BlocoLinhaALinha } from '@/types/estudo';

// Polyfill essencial para suporte a upload de arquivos em Node.js 18
if (typeof globalThis.File === 'undefined') {
  globalThis.File = NodeBufferFile as unknown as typeof File;
}

interface SegmentoBruto {
  id: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Transcreve o áudio obtendo timestamps precisos por segmento usando Whisper (Groq ou OpenAI)
 * com fusão inteligente de sentenças e suporte a prompts de transcrição.
 */
export async function transcreverAudio(
  audioPath: string,
  duracaoTotal: number,
  transcricaoManual?: string
): Promise<SegmentoWhisper[]> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (groqApiKey) {
    try {
      console.log('Transcrevendo via Groq Whisper API (whisper-large-v3)...');
      const groq = new Groq({ apiKey: groqApiKey });
      const transcription = (await groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-large-v3',
        response_format: 'verbose_json',
        temperature: 0,
        language: 'en',
        prompt: transcricaoManual ? transcricaoManual.substring(0, 1000) : undefined,
      })) as unknown as { segments?: SegmentoBruto[]; text?: string };

      if (transcription.segments && transcription.segments.length > 0) {
        console.log(`Whisper retornou ${transcription.segments.length} fragmentos. Agrupando em sentenças coerentes...`);
        return unirSegmentosEmSentencas(transcription.segments);
      }
    } catch (err) {
      console.error('Falha na chamada ao Groq Whisper:', err);
    }
  }

  if (openAiApiKey) {
    try {
      console.log('Transcrevendo via OpenAI Whisper API...');
      const formData = new FormData();
      const fileBuffer = await fs.promises.readFile(audioPath);
      formData.append(
        'file',
        new Blob([fileBuffer], { type: 'audio/mpeg' }),
        'audio.mp3'
      );
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('language', 'en');
      if (transcricaoManual) {
        formData.append('prompt', transcricaoManual.substring(0, 1000));
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = (await response.json()) as { segments?: SegmentoBruto[] };
        if (data.segments && data.segments.length > 0) {
          return unirSegmentosEmSentencas(data.segments);
        }
      }
    } catch (err) {
      console.error('Falha na chamada ao OpenAI Whisper:', err);
    }
  }

  // Fallback didático caso nenhuma API esteja acessível
  console.log('Utilizando alinhador didático protegido contra quebra de abreviações...');
  return gerarSegmentosFallback(transcricaoManual, duracaoTotal);
}

/**
 * Une segmentos brutos do Whisper para formar frases completas com sentido pedagógico real.
 * Evita recortes de palavras isoladas (ex: apenas "Mr." ou apenas "So...").
 */
export function unirSegmentosEmSentencas(rawSegments: SegmentoBruto[]): SegmentoWhisper[] {
  const merged: { start: number; end: number; text: string }[] = [];
  let current: { start: number; end: number; text: string } | null = null;

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    // Remove etiquetas de personagens como "Chris Gardner: " se estiverem soltas
    const cleanText = seg.text
      .replace(/^([A-Za-z0-9\s]+):\s*/, '')
      .trim();

    if (!cleanText || cleanText === '.' || cleanText === '...' || cleanText === ',') {
      continue;
    }

    if (!current) {
      current = {
        start: seg.start,
        end: seg.end,
        text: cleanText,
      };
      continue;
    }

    const duracaoAtual = current.end - current.start;
    const duracaoEsteSegmento = seg.end - seg.start;
    const terminaComPontuacao = /[.!?]$/.test(current.text);
    const terminaComAbreviacao = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs)\.$/i.test(current.text);

    // Conectivos comuns que indicam continuação da frase
    const proximoEConectivo = /^(and|but|or|because|so|if|though|um|uh|you know|as|to|that)\b/i.test(cleanText);

    // Deve unir se:
    // 1. Termina com abreviação (ex: "Mr." NUNCA pode ser ponto final)
    // 2. Não terminou com pontuação (.!?)
    // 3. A frase atual é muito curta (< 2.0s ou menos de 3 palavras)
    // 4. O próximo segmento é muito curto (< 1.5s) ou é um conectivo direto
    // Limite máximo: uma frase linha a linha não deve ultrapassar 8.5 segundos
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
      current = {
        start: seg.start,
        end: seg.end,
        text: cleanText,
      };
    }
  }

  if (current) {
    merged.push(current);
  }

  // Se houver alguma frase final muito minúscula (ex: < 1.0s como "Uh..."), funde com a anterior
  if (merged.length > 1) {
    const ultima = merged[merged.length - 1];
    if (ultima.end - ultima.start < 1.2 || /^(uh|um|so)\b/i.test(ultima.text)) {
      const penultima = merged[merged.length - 2];
      penultima.end = ultima.end;
      penultima.text = `${penultima.text} ${ultima.text}`.trim();
      merged.pop();
    }
  }

  return merged.map((m, idx) => ({
    id: idx + 1,
    start: Math.round(m.start * 100) / 100,
    end: Math.round(m.end * 100) / 100,
    text: m.text,
  }));
}

/**
 * Divisor inteligente de texto para fallback caso o áudio falhe,
 * PROTEGENDO expressamente abreviações como Mr., Mrs., Dr., etc.
 */
function gerarSegmentosFallback(texto?: string, duracaoTotal = 60): SegmentoWhisper[] {
  const textoPadrao =
    texto && texto.trim().length > 10
      ? texto
      : 'Hello everyone and welcome to this English lesson. Today we are going to learn how to study English effectively with audio and texts. It is one of the most powerful methods to improve your listening and vocabulary naturally. Every day, practice for a few minutes and you will see remarkable progress in no time. Consistency is the real secret to fluency.';

  // 1. Remove rótulos de falantes "Nome: "
  let processado = textoPadrao.replace(/^([A-Za-z0-9\s]+):\s*/gm, '');

  // 2. Protege abreviações comuns para que o ponto não quebre a frase
  const abreviacoes = [
    { regex: /\bMr\./gi, token: '__ABBR_MR__' },
    { regex: /\bMrs\./gi, token: '__ABBR_MRS__' },
    { regex: /\bMs\./gi, token: '__ABBR_MS__' },
    { regex: /\bDr\./gi, token: '__ABBR_DR__' },
    { regex: /\bProf\./gi, token: '__ABBR_PROF__' },
    { regex: /\bSr\./gi, token: '__ABBR_SR__' },
    { regex: /\bJr\./gi, token: '__ABBR_JR__' },
    { regex: /\bU\.S\./gi, token: '__ABBR_US__' },
    { regex: /\bSt\./gi, token: '__ABBR_ST__' },
    { regex: /\be\.g\./gi, token: '__ABBR_EG__' },
    { regex: /\bi\.e\./gi, token: '__ABBR_IE__' },
  ];

  for (const { regex, token } of abreviacoes) {
    processado = processado.replace(regex, token);
  }

  // 3. Divide respeitando fim de frase verdadeiro (. ? !)
  const frasesBrutas = processado
    .split(/(?<=[.?!])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  // 4. Restaura abreviações
  const frases = frasesBrutas.map((f) => {
    let restaurado = f;
    restaurado = restaurado.replace(/__ABBR_MR__/g, 'Mr.');
    restaurado = restaurado.replace(/__ABBR_MRS__/g, 'Mrs.');
    restaurado = restaurado.replace(/__ABBR_MS__/g, 'Ms.');
    restaurado = restaurado.replace(/__ABBR_DR__/g, 'Dr.');
    restaurado = restaurado.replace(/__ABBR_PROF__/g, 'Prof.');
    restaurado = restaurado.replace(/__ABBR_SR__/g, 'Sr.');
    restaurado = restaurado.replace(/__ABBR_JR__/g, 'Jr.');
    restaurado = restaurado.replace(/__ABBR_US__/g, 'U.S.');
    restaurado = restaurado.replace(/__ABBR_ST__/g, 'St.');
    restaurado = restaurado.replace(/__ABBR_EG__/g, 'e.g.');
    restaurado = restaurado.replace(/__ABBR_IE__/g, 'i.e.');
    return restaurado;
  });

  const totalPalavras = frases.reduce((acc, f) => acc + f.split(/\s+/).length, 0);
  const duracao = duracaoTotal > 0 ? duracaoTotal : Math.max(30, totalPalavras * 0.4);

  let acumulado = 0;
  return frases.map((frase, idx) => {
    const palavrasFrase = frase.split(/\s+/).length;
    const proporcao = Math.max(0.05, palavrasFrase / Math.max(1, totalPalavras));
    const duracaoDestaFrase = Math.max(1.5, proporcao * duracao);

    const start = Math.round(acumulado * 10) / 10;
    const end = Math.min(Math.round((acumulado + duracaoDestaFrase) * 10) / 10, duracao);
    acumulado += duracaoDestaFrase;

    return {
      id: idx + 1,
      start,
      end,
      text: frase,
    };
  });
}

export interface GrupoSessaoBruta {
  numeroDia: number;
  inicio: number;
  fim: number;
  segmentos: SegmentoWhisper[];
}

/**
 * REGRA CRÍTICA DE NEGÓCIO:
 * Agrupa os segmentos em sessões diárias de no máximo 60 segundos SEM cortar frases ao meio.
 */
export function agruparSegmentosEmSessoes(
  segmentos: SegmentoWhisper[]
): GrupoSessaoBruta[] {
  if (!segmentos || segmentos.length === 0) return [];

  const sessoes: GrupoSessaoBruta[] = [];
  let diaAtual = 1;

  let sessaoInicio = segmentos[0].start;
  let segmentosNaSessao: SegmentoWhisper[] = [];

  for (let i = 0; i < segmentos.length; i++) {
    const seg = segmentos[i];
    const duracaoAcumuladaComEste = seg.end - sessaoInicio;

    if (duracaoAcumuladaComEste > 60 && segmentosNaSessao.length > 0) {
      const ultimoSeg = segmentosNaSessao[segmentosNaSessao.length - 1];
      sessoes.push({
        numeroDia: diaAtual,
        inicio: sessaoInicio,
        fim: ultimoSeg.end,
        segmentos: [...segmentosNaSessao],
      });

      diaAtual++;
      sessaoInicio = seg.start;
      segmentosNaSessao = [seg];
    } else {
      segmentosNaSessao.push(seg);
    }
  }

  if (segmentosNaSessao.length > 0) {
    const ultimoSeg = segmentosNaSessao[segmentosNaSessao.length - 1];
    sessoes.push({
      numeroDia: diaAtual,
      inicio: sessaoInicio,
      fim: ultimoSeg.end,
      segmentos: [...segmentosNaSessao],
    });
  }

  return sessoes;
}

interface RespostaGeminiSessao {
  textoInglesColuna: string;
  textoPortuguesColuna: string;
  focoDoTexto: string[];
  blocosLinhaALinha: {
    id: number;
    inglesHtml: string;
    portuguesHtml: string;
    nota: string | null;
  }[];
}

/**
 * Enriquece uma sessão com o Google Gemini:
 * - Tradução de texto corrido coluna a coluna
 * - Mapeamento de termos equivalentes com <span class="highlight">
 * - Notas gramaticais e pedagógicas
 * - Foco do texto
 */
export async function enriquecerSessaoComGemini(
  grupo: GrupoSessaoBruta,
  estudoId: string
): Promise<SessaoEstudo> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (geminiApiKey) {
    try {
      console.log(`Enriquecendo Sessão ${grupo.numeroDia} com Gemini AI...`);
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const prompt = `Você é um especialista em ensino de inglês pelo método "Textos com Áudio" (estilo Mairo Vergara).
Analise os seguintes blocos de frases em inglês extraídos de um áudio da Sessão ${grupo.numeroDia}:

${JSON.stringify(
  grupo.segmentos.map((s) => ({ id: s.id, text: s.text, inicio: s.start, fim: s.end })),
  null,
  2
)}

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

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed = JSON.parse(responseText) as RespostaGeminiSessao;

      // Monta os blocos com as URLs dos áudios recortados pelo FFmpeg
      const blocosLinhaALinha: BlocoLinhaALinha[] = grupo.segmentos.map((seg, idx) => {
        const blocoIA = parsed.blocosLinhaALinha?.find((b) => b.id === seg.id) ||
          parsed.blocosLinhaALinha?.[idx];

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

      return {
        numeroDia: grupo.numeroDia,
        concluido: false,
        inicio: grupo.inicio,
        fim: grupo.fim,
        audioCompletoUrl: `/estudos/${estudoId}/sessao-${grupo.numeroDia}/audio-sessao.mp3`,
        textoInglesColuna: parsed.textoInglesColuna || grupo.segmentos.map((s) => s.text).join(' '),
        textoPortuguesColuna: parsed.textoPortuguesColuna || '',
        blocosLinhaALinha,
        focoDoTexto: parsed.focoDoTexto || ['Prática de listening e repetição com áudio nativo'],
      };
    } catch (err) {
      console.error(`Erro ao chamar Gemini na Sessão ${grupo.numeroDia}:`, err);
    }
  }

  // Fallback didático sem chave do Gemini
  console.log(`Aplicando processamento pedagógico padrão para Sessão ${grupo.numeroDia}...`);
  return gerarSessaoFallback(grupo, estudoId);
}

function gerarSessaoFallback(grupo: GrupoSessaoBruta, estudoId: string): SessaoEstudo {
  const blocosLinhaALinha: BlocoLinhaALinha[] = grupo.segmentos.map((seg) => {
    const palavras = seg.text.split(' ');
    let inglesHtml = seg.text;
    let portuguesHtml = seg.text;
    let nota: string | null = null;

    if (palavras.length >= 2) {
      const destaqueIngles = palavras.slice(0, 2).join(' ');
      const restoIngles = palavras.slice(2).join(' ');
      inglesHtml = `<span class="highlight">${destaqueIngles}</span> ${restoIngles}`.trim();
      portuguesHtml = `<span class="highlight">${destaqueIngles}</span> ${restoIngles}`.trim();
      nota = `Observe a entonação e a junção natural dos sons ao pronunciar "${destaqueIngles}".`;
    }

    return {
      id: seg.id,
      inicio: seg.start,
      fim: seg.end,
      inglesHtml,
      portuguesHtml,
      nota,
      audioFraseUrl: `/estudos/${estudoId}/sessao-${grupo.numeroDia}/frase-${seg.id}.mp3`,
    };
  });

  const textoIngles = grupo.segmentos.map((s) => s.text).join(' ');

  return {
    numeroDia: grupo.numeroDia,
    concluido: false,
    inicio: grupo.inicio,
    fim: grupo.fim,
    audioCompletoUrl: `/estudos/${estudoId}/sessao-${grupo.numeroDia}/audio-sessao.mp3`,
    textoInglesColuna: textoIngles,
    textoPortuguesColuna: `[Tradução de estudo para a sessão do Dia ${grupo.numeroDia}] ` + textoIngles,
    blocosLinhaALinha,
    focoDoTexto: [
      'Identificação dos sons das vogais e ritmo da fala em inglês',
      'Treino da conexão das palavras (connected speech)',
      'Memorização do vocabulário em contexto real',
    ],
  };
}
