export interface BlocoLinhaALinha {
  id: number;
  inicio: number;
  fim: number;
  inglesHtml: string;
  portuguesHtml: string;
  nota: string | null;
  audioFraseUrl: string;
}

export interface SessaoEstudo {
  numeroDia: number;
  concluido: boolean;
  inicio: number;
  fim: number;
  audioCompletoUrl: string;
  textoInglesColuna: string;
  textoPortuguesColuna: string;
  blocosLinhaALinha: BlocoLinhaALinha[];
  focoDoTexto: string[];
}

export interface Estudo {
  id: string;
  titulo: string;
  criadoEm: string;
  duracaoTotal: number;
  sessoes: SessaoEstudo[];
}

export interface SegmentoWhisper {
  id: number;
  start: number;
  end: number;
  text: string;
}
