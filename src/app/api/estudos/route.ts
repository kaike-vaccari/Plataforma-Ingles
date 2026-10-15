import { NextResponse } from 'next/server';
import { listarTodosEstudos } from '@/lib/estudos-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const estudos = await listarTodosEstudos();
    return NextResponse.json({ estudos });
  } catch (error) {
    console.error('Erro ao buscar estudos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar lista de estudos.' },
      { status: 500 }
    );
  }
}
