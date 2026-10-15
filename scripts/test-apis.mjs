import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Carrega .env.local manualmente para o script de teste
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...values] = trimmed.split('=');
    if (key) {
      process.env[key.trim()] = values.join('=').trim();
    }
  }
}

console.log('==============================================');
console.log('🔍 TESTE DE CONEXÃO COM AS APIs DO SISTEMA');
console.log('==============================================\n');

async function testarGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log('⚪ GROQ: Nenhuma chave informada.');
    return;
  }

  process.stdout.write('⏳ Testando conexão com Groq API (Whisper)... ');
  try {
    const groq = new Groq({ apiKey });
    const models = await groq.models.list();
    const hasWhisper = models.data.some((m) => m.id.includes('whisper'));
    console.log('✅ CONECTADO COM SUCESSO!');
    console.log(`   Modelo whisper-large-v3 disponível: ${hasWhisper ? 'Sim' : 'Não'}`);
  } catch (err) {
    console.log('❌ FALHOU:');
    console.log(`   ${err.message}`);
  }
}

async function testarGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('⚪ GEMINI: Nenhuma chave informada.');
    return;
  }

  process.stdout.write('⏳ Testando conexão com Google Gemini API... ');
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Responda com "OK" se estiver funcionando.');
    const texto = result.response.text().trim();
    console.log('✅ CONECTADO COM SUCESSO!');
    console.log(`   Modelo: ${modelName}`);
    console.log(`   Resposta do Gemini: "${texto}"`);
  } catch (err) {
    console.log('❌ FALHOU:');
    console.log(`   ${err.message}`);
  }
}

async function testarOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('⚪ OPENAI: Nenhuma chave informada.');
    return;
  }

  process.stdout.write('⏳ Testando conexão com OpenAI API... ');
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      console.log('✅ CONECTADO COM SUCESSO!');
    } else {
      const data = await res.json().catch(() => ({}));
      console.log('❌ FALHOU:');
      console.log(`   Status: ${res.status} - ${data.error?.message || 'Erro desconhecido'}`);
    }
  } catch (err) {
    console.log('❌ FALHOU:');
    console.log(`   ${err.message}`);
  }
}

async function run() {
  await testarGroq();
  console.log('');
  await testarGemini();
  console.log('');
  await testarOpenAI();
  console.log('\n==============================================');
}

run();
