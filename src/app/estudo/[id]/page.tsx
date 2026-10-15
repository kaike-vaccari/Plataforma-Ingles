import { notFound } from 'next/navigation';
import { obterEstudoPorId } from '@/lib/estudos-store';
import TelaEstudoMairo from '@/components/TelaEstudoMairo';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function EstudoPage({ params }: PageProps) {
  const estudo = await obterEstudoPorId(params.id);

  if (!estudo) {
    notFound();
  }

  return <TelaEstudoMairo estudoInicial={estudo} />;
}
