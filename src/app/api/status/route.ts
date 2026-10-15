import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = {
    groq: { ok: false, mensagem: 'Não configurado' },
    gemini: { ok: false, mensagem: 'Não configurado', modelo: process.env.GEMINI_MODEL || 'gemini-2.5-flash' },
    openai: { ok: false, mensagem: 'Não configurado' },
  };

  // Teste Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const models = await groq.models.list();
      const hasWhisper = models.data.some((m) => m.id.includes('whisper'));
      status.groq = {
        ok: true,
        mensagem: hasWhisper ? 'Conectado (whisper-large-v3 disponível)' : 'Conectado',
      };
    } catch (err: unknown) {
      status.groq = { ok: false, mensagem: (err as Error).message || 'Erro ao conectar com Groq' };
    }
  }

  // Teste Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent('ping');
      const text = res.response.text();
      status.gemini = {
        ok: true,
        mensagem: `Conectado com sucesso (${modelName})`,
        modelo: modelName,
      };
    } catch (err: unknown) {
      status.gemini = {
        ok: false,
        mensagem: (err as Error).message || 'Erro ao conectar com Gemini',
        modelo: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      };
    }
  }

  // Teste OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      if (res.ok) {
        status.openai = { ok: true, mensagem: 'Conectado com sucesso' };
      } else {
        status.openai = { ok: false, mensagem: `Erro HTTP ${res.status}` };
      }
    } catch (err: unknown) {
      status.openai = { ok: false, mensagem: (err as Error).message || 'Erro de rede OpenAI' };
    }
  }

  return NextResponse.json(status);
}
