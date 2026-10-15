import fs from 'fs/promises';
import path from 'path';
import { Estudo } from '@/types/estudo';

const DATA_DIR = path.join(process.cwd(), 'data', 'estudos');

export async function salvarEstudo(estudo: Estudo): Promise<void> {
  const pastaEstudo = path.join(DATA_DIR, estudo.id);
  await fs.mkdir(pastaEstudo, { recursive: true });
  const arquivoPath = path.join(pastaEstudo, 'estudo.json');
  await fs.writeFile(arquivoPath, JSON.stringify(estudo, null, 2), 'utf-8');
}

export async function obterEstudoPorId(id: string): Promise<Estudo | null> {
  try {
    const arquivoPath = path.join(DATA_DIR, id, 'estudo.json');
    const conteudo = await fs.readFile(arquivoPath, 'utf-8');
    return JSON.parse(conteudo) as Estudo;
  } catch {
    return null;
  }
}

export async function listarTodosEstudos(): Promise<Estudo[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const pastas = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const estudos: Estudo[] = [];

    for (const item of pastas) {
      if (item.isDirectory()) {
        const estudo = await obterEstudoPorId(item.name);
        if (estudo) {
          estudos.push(estudo);
        }
      }
    }

    // Ordena do mais recente para o mais antigo
    return estudos.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  } catch (err) {
    console.error('Erro ao listar estudos:', err);
    return [];
  }
}

export async function atualizarStatusSessao(
  id: string,
  numeroDia: number,
  concluido: boolean
): Promise<Estudo | null> {
  const estudo = await obterEstudoPorId(id);
  if (!estudo) return null;

  const sessao = estudo.sessoes.find((s) => s.numeroDia === numeroDia);
  if (sessao) {
    sessao.concluido = concluido;
    await salvarEstudo(estudo);
  }

  return estudo;
}

export async function excluirEstudo(id: string): Promise<boolean> {
  try {
    const pastaData = path.join(DATA_DIR, id);
    const pastaPublic = path.join(process.cwd(), 'public', 'estudos', id);

    await fs.rm(pastaData, { recursive: true, force: true });
    await fs.rm(pastaPublic, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error('Erro ao excluir estudo:', err);
    return false;
  }
}
