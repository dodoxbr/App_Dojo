import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadDiary } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Alert, Badge, Button, EmptyState, Heading, ItemRow, Loading, Row, Screen, colors } from '@/ui';

// Diário PRIVADO do aluno. Registrar um treino aqui não conta como presença na academia.
export default function Diario() {
  const userId = useSession()?.user.id ?? '';
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLoad(() => loadDiary(userId, page), `${userId}:${page}`);

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Heading title="Meu diário" subtitle="Somente você vê estes registros. Registrar um treino não conta como presença na academia." />
      <Button title="Registrar treino" onPress={() => router.push('/diario/novo')} />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.logs.length === 0 ? (
        <EmptyState title="Você ainda não registrou nenhum treino">O diário é só seu: anote o que treinou e as técnicas que praticou.</EmptyState>
      ) : null}
      {data?.logs.map((l) => {
        const names = (data.techniques.get(l.id) ?? []).map((t) => t.name);
        const notes = l.notes ?? '';
        return (
          <ItemRow
            key={l.id}
            title={new Date(l.trained_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
            meta={l.academy_id ? 'Academia' : 'Treino pessoal'}
            onPress={() => router.push({ pathname: '/diario/[id]', params: { id: l.id } })}
          >
            {names.length ? <Row>{names.slice(0, 4).map((n) => <Badge key={n} tone="accent">{n}</Badge>)}</Row> : null}
            {notes ? <Text style={{ color: colors.textMuted }}>{notes.slice(0, 140)}{notes.length > 140 ? '…' : ''}</Text> : null}
          </ItemRow>
        );
      })}
      {page > 1 || data?.hasNext ? (
        <Row>
          {page > 1 ? <Button title="← Mais recentes" variant="secondary" onPress={() => setPage(page - 1)} /> : null}
          {data?.hasNext ? <Button title="Mais antigos →" variant="secondary" onPress={() => setPage(page + 1)} /> : null}
        </Row>
      ) : null}
    </Screen>
  );
}
