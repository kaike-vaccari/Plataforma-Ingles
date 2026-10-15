# English Studio - Plataforma de Estudos com Áudio (Método Mairo Vergara)

Aplicação web local em **Next.js (App Router) + TypeScript** para estudo de inglês através do método **"Textos com Áudio"**.

O sistema processa vídeos e áudios, divide automaticamente em **sessões diárias de no máximo 60 segundos** (sem cortar nenhuma frase ao meio), realiza o **duplo recorte físico com FFmpeg** e enriquece pedagogicamente o conteúdo usando o **Google Gemini** e **Whisper**.

---

## 🚀 Como Iniciar o Projeto

### 1. Pré-requisitos do Sistema (Linux)
Certifique-se de ter o `ffmpeg` instalado no seu Linux:
```bash
sudo apt update && sudo apt install -y ffmpeg
ffmpeg -version
```

### 2. Configurar Chaves de API
Copie o arquivo de exemplo e insira suas credenciais no `.env.local`:
```bash
cp .env.example .env.local
```

Edite `.env.local`:
```env
# Google Gemini API (para tradução, grifos em #d6e8fa e notas gramaticais)
# Obtenha gratuitamente em: https://aistudio.google.com/
GEMINI_API_KEY=sua_chave_gemini_aqui
GEMINI_MODEL=gemini-1.5-flash

# Groq Cloud API (Whisper-large-v3 com timestamps e retorno instantâneo)
# Obtenha gratuitamente em: https://console.groq.com/keys
GROQ_API_KEY=sua_chave_groq_aqui

# (Opcional) OpenAI se preferir usar Whisper da OpenAI
OPENAI_API_KEY=
```
> *Nota: Caso execute sem as chaves no primeiro momento, o sistema utiliza o alinhador e gerador didático de fallback para permitir testes imediatos de interface.*

### 3. Rodar o Servidor Local
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🛠️ Arquitetura e Funcionalidades

1. **Manipulação de Mídia (`src/lib/ffmpeg.ts`):**
   - Extrai o áudio `.mp3` de qualquer vídeo `.mp4` ou converte qualquer formato de áudio.
   - Executa o **duplo recorte físico**:
     - `audio-sessao.mp3`: Áudio contínuo da sessão diária (até 60s).
     - `frase-[id].mp3`: Recorte de cada frase curta (1 a 5s).

2. **Processamento de IA (`src/lib/ai-processor.ts`):**
   - **Whisper (Groq / OpenAI):** Obtém timestamps exatos de 1 a 5 segundos por segmento.
   - **Agrupador Inteligente ($\le 60$s):** Agrupa frases consecutivas sem cortar nenhuma frase ao meio.
   - **Google Gemini:** Gera texto corrido das colunas, mapeia grifos correspondentes (`<span class="highlight">`), produz notas explicativas e o *Foco do Texto*.

3. **Interface Visual (Fiel ao Estilo Mairo Vergara):**
   - Fundo em `#f5f5f5` com container central `#ffffff` (max 800px).
   - Títulos em maiúsculas na cor `#0a5f84`.
   - Grifos em `#d6e8fa` com texto em contraste.
   - **ÁUDIO DO TEXTO** com controle de velocidade (0.75x, 1x, 1.25x).
   - **TEXTO EM COLUNAS** (50% / 50% inglês e português).
   - **TEXTO LINHA A LINHA** com frases em negrito, notas e áudio individual para cada frase.
   - **FOCO DO TEXTO** com resumo pedagógico.
   - Navegação por abas (`Dia 1`, `Dia 2`...) e botão para marcar o dia como concluído.
