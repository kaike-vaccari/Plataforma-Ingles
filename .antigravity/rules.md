# Contexto e Regras do Projeto: App de Estudos de Inglês (Método Textos com Áudio)

## 1. Visão Geral
Aplicação web local em **Next.js (App Router) + TypeScript** rodando em `localhost:3000`.
O objetivo é automatizar o estudo de inglês por "Textos com Áudio" (estilo Mairo Vergara). O usuário faz upload de um vídeo/áudio (e opcionalmente transcrição/tradução), e o sistema divide o material em **Sessões Diárias de no máximo 60 segundos**, recortando os áudios fisicamente com **FFmpeg** e gerando o estudo lado a lado e linha a linha com destaques equivalentes.

## 2. Stack Tecnológica
- **Framework:** Next.js (App Router) com TypeScript e TailwindCSS / CSS puro fiel ao modelo visual.
- **Processamento de Mídia (Back-end):** `fluent-ffmpeg` / `child_process` executando `ffmpeg` nativo do Linux.
- **Alinhamento de Áudio/Texto:** Whisper API (Groq SDK ou OpenAI SDK) com `response_format: "verbose_json"` e `timestamp_granularities: ["segment"]` para obter blocos curtos de 1 a 5 segundos.
- **Enriquecimento Pedagógico:** Google Gemini API (`@google/genai` ou `@google/generative-ai`) para gerar tradução, mapear destaques equivalentes (`<span class="highlight">`) e criar notas gramaticais/vocabulário.
- **Armazenamento Local:** Sistema de arquivos local.
  - Metadados salvos em `/data/estudos/[id]/estudo.json`.
  - Áudios recortados salvos em `/public/estudos/[id]/sessao-[n]/...` para fácil reprodução no navegador.

## 3. Regra de Negócio Crítica: Divisão em Sessões de 1 Minuto
- Se o áudio/vídeo tiver mais de 60 segundos, ele NUNCA deve ser cortado de forma cega no segundo 60:00.
- O back-end deve agrupar os segmentos retornados pelo Whisper em `sessoes`.
- Uma sessão acumula segmentos consecutivos enquanto `(segmento.end - sessao.inicio) <= 60`. Quando ultrapassar 60s, inicia-se uma nova sessão (Dia 1, Dia 2, Dia 3...).
- Para cada sessão, o FFmpeg deve gerar:
  1. `audio-sessao.mp3`: O recorte do áudio completo daquele minuto (`sessao.inicio` até `sessao.fim`).
  2. `frase-[index].mp3`: Os recortes individuais de cada bloco de 1 a 5 segundos pertencente àquela sessão.

## 4. Estrutura do JSON (`estudo.json`)
```json
{
  "id": "uuid-do-estudo",
  "titulo": "Título do Estudo",
  "criadoEm": "2026-10-15",
  "duracaoTotal": 185.4,
  "sessoes": [
    {
      "numeroDia": 1,
      "concluido": false,
      "inicio": 0.0,
      "fim": 58.4,
      "audioCompletoUrl": "/estudos/id/sessao-1/audio-sessao.mp3",
      "textoInglesColuna": "Texto corrido completo em inglês apenas deste 1 minuto...",
      "textoPortuguesColuna": "Tradução corrida completa apenas deste 1 minuto...",
      "blocosLinhaALinha": [
        {
          "id": 1,
          "inicio": 0.5,
          "fim": 2.3,
          "inglesHtml": "<span class=\"highlight\">I am</span> Peter Johnson.",
          "portuguesHtml": "<span class=\"highlight\">Eu sou</span> Peter Johnson.",
          "nota": "Explicação gramatical curta (ou null se não houver necessidade).",
          "audioFraseUrl": "/estudos/id/sessao-1/frase-1.mp3"
        }
      ],
      "focoDoTexto": [
        "Resumo das estruturas principais vistas neste minuto"
      ]
    }
  ]
}
```

## 5. Regras Visuais da Tela de Estudos (Fiel ao site Mairo Vergara)
* Fundo da página em `#f5f5f5`, container central branco (`#ffffff`, `max-width: 800px`, `padding: 40px`, sombras suaves, cantos arredondados discretos).
* Títulos de seção sempre em maiúsculas, negrito e na cor `#0a5f84`:
  * `ÁUDIO DO TEXTO` (seguido pelo `<audio controls>` da sessão atual).
  * `TEXTO EM COLUNAS` (tabela/grid 50% / 50% sem bordas visíveis, texto justificado, inglês na esquerda e português na direita).
  * `TEXTO LINHA A LINHA` (blocos contendo: Frase em inglês em **negrito**, frase em português logo abaixo, grifos equivalentes usando `<span class="highlight">` com `background-color: #d6e8fa`, caixa de **Nota:** quando existir, e `<audio controls>` do recorte logo abaixo).
  * `FOCO DO TEXTO` (resumo final da sessão).
* Topo da página de estudos deve ter abas para alternar entre as sessões de 1 minuto (`Dia 1`, `Dia 2`, `Dia 3`...) e um botão para marcar o dia atual como concluído.
