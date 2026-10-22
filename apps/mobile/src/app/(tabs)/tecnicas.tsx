import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { searchTechniques, type TechniqueRow } from '@/lib/queries';
import { Alert, Badge, EmptyState, Heading, ItemRow, Loading, Muted, Row, Screen, TextField } from '@/ui';

// Catálogo de técnicas: busca tolerante a acento, maiúsculas e sinônimos (a mesma busca do painel).
export default function Tecnicas() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<TechniqueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchTechniques(query)
        .then((r) => alive && (setRows(r), setError(null)))
        .catch((e: Error) => alive && setError(e.message));
    }, query ? 350 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Screen>
      <Heading title="Técnicas" subtitle="Busque por nome ou sinônimo, sem diferenciar acentos nem maiúsculas." />
      <TextField label="Buscar" value={query} onChangeText={setQuery} placeholder="nome ou sinônimo" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!rows && !error ? <Loading /> : null}
      {rows && rows.length === 0 ? <EmptyState title="Nenhuma técnica encontrada">Tente outro nome.</EmptyState> : null}
      {rows?.map((t) => (
        <ItemRow
          key={t.id}
          title={t.name}
          meta={`${t.category}${t.level ? ` · ${t.level}` : ''}`}
          onPress={() => router.push({ pathname: '/tecnica/[id]', params: { id: t.id } })}
        >
          {t.technique_type || t.technique_position || t.matched_alias ? (
            <Muted>{[t.technique_type, t.technique_position, t.matched_alias ? `sinônimo: ${t.matched_alias}` : null].filter(Boolean).join(' · ')}</Muted>
          ) : null}
        </ItemRow>
      ))}
      {rows && rows.length >= 30 ? <Row><Badge>Mostrando as 30 primeiras: refine a busca</Badge></Row> : null}
    </Screen>
  );
}
