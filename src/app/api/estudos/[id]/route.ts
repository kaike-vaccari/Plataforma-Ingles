import { NextRequest, NextResponse } from 'next/server';
import { obterEstudoPorId, atualizarStatusSessao, excluirEstudo } from '@/lib/estudos-store';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const estudo = await obterEstudoPorId(params.id);
    if (!estudo) {
      return NextResponse.json({ error: 'Estudo não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ estudo });
  } catch (error) {
    console.error('Erro ao obter estudo:', error);
    return NextResponse.json({ error: 'Erro ao buscar estudo.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { numeroDia, concluido } = body;

    if (typeof numeroDia !== 'number' || typeof concluido !== 'boolean') {
      return NextResponse.json(
        { error: 'Parâmetros numeroDia (número) e concluido (booleano) são obrigatórios.' },
        { status: 400 }
      );
    }

    const estudoAtualizado = await atualizarStatusSessao(params.id, numeroDia, concluido);
    if (!estudoAtualizado) {
      return NextResponse.json({ error: 'Estudo não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, estudo: estudoAtualizado });
  } catch (error) {
    console.error('Erro ao atualizar status do estudo:', error);
    return NextResponse.json({ error: 'Erro ao atualizar estudo.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sucesso = await excluirEstudo(params.id);
    if (!sucesso) {
      return NextResponse.json({ error: 'Não foi possível excluir o estudo.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir estudo:', error);
    return NextResponse.json({ error: 'Erro ao excluir estudo.' }, { status: 500 });
  }
}
