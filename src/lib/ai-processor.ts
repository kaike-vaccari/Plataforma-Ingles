import fs from 'fs';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SegmentoWhisper, SessaoEstudo, BlocoLinhaALinha } from '@/types/estudo';

interface SegmentoBruto {
  id: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Transcreve o áudio obtendo timestamps precisos por segmento usando Whisper (Groq ou OpenAI)
 * com fallback inteligente para transcrição manual ou estimativa de sentenças.
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
      })) as unknown as { segments?: SegmentoBruto[]; text?: string };

      if (transcription.segments && transcription.segments.length > 0) {
        return transcription.segments.map((seg, idx) => ({
          id: idx + 1,
          start: Math.round(seg.start * 100) / 100,
          end: Math.round(seg.end * 100) / 100,
          text: seg.text.trim(),
        }));
      }
    } catch (err) {
      console.error('Falha na chamada ao Groq Whisper:', err);
    }
  } else if (openAiApiKey) {
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
          return data.segments.map((seg, idx) => ({
            id: idx + 1,
            start: Math.round(seg.start * 100) / 100,
            end: Math.round(seg.end * 100) / 100,
            text: seg.text.trim(),
          }));
        }
      }
    } catch (err) {
      console.error('Falha na chamada ao OpenAI Whisper:', err);
    }
  }

  // Fallback: Se o usuário forneceu transcrição manual ou para testes locais sem chave de API
  console.log('Utilizando gerador/alinhador de sentenças baseado no texto fornecido ou padrão...');
  return gerarSegmentosFallback(transcricaoManual, duracaoTotal);
}

/**
 * Heurística de fallback para quebrar texto em sentenças e calcular timestamps proporcionais
 */
function gerarSegmentosFallback(texto?: string, duracaoTotal = 60): SegmentoWhisper[] {
  const textoPadrao =
    texto && texto.trim().length > 10
      ? texto
      : 'Hello everyone and welcome to this English lesson. Today we are going to learn how to study English effectively with audio and texts. It is one of the most powerful methods to improve your listening and vocabulary naturally. Every day, practice for a few minutes and you will see remarkable progress in no time. Consistency is the real secret to fluency.';

  // Divide por pontuações de final de frase
  const frases = textoPadrao
    .split(/(?<=[.?!])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const duracao = duracaoTotal > 0 ? duracaoTotal : Math.max(30, frases.length * 4);
  const duracaoPorFrase = duracao / Math.max(1, frases.length);

  return frases.map((frase, idx) => {
    const start = Math.round(idx * duracaoPorFrase * 10) / 10;
    const end = Math.min(
      Math.round((idx + 1) * duracaoPorFrase * 10) / 10,
      duracao
    );
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
 * Uma sessão acumula segmentos enquanto (segmento.end - sessao.inicio) <= 60.
 * Ao ultrapassar 60s, fecha a sessão anterior no fim da frase anterior e inicia nova sessão.
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

    // Se já temos segmentos acumulados e este segmento fará o bloco exceder 60s:
    const duracaoAcumuladaComEste = seg.end - sessaoInicio;

    if (duracaoAcumuladaComEste > 60 && segmentosNaSessao.length > 0) {
      // Fecha a sessão atual
      const ultimoSeg = segmentosNaSessao[segmentosNaSessao.length - 1];
      sessoes.push({
        numeroDia: diaAtual,
        inicio: sessaoInicio,
        fim: ultimoSeg.end,
        segmentos: [...segmentosNaSessao],
      });

      // Inicia a próxima sessão a partir deste segmento
      diaAtual++;
      sessaoInicio = seg.start;
      segmentosNaSessao = [seg];
    } else {
      segmentosNaSessao.push(seg);
    }
  }

  // Adiciona a última sessão remanescente
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
      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
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
3. Para CADA bloco de frase (respeitando o mesmo "id", "inicio" e "fim"), gere:
   - "inglesHtml": Frase original em inglês aplicando a tag <span class="highlight">TERMO</span> nos termos-chave, verbos essenciais, phrasal verbs ou expressões importantes.
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

/**
 * Fallback heurístico para construir a sessão caso a API externa não responda
 */
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
