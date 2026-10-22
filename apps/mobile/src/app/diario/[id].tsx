import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadLog } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, Heading, Loading, Muted, Row, Screen, colors } from '@/ui';

// Um registro do diário (só do dono; a RLS também garante). Excluir pede um segundo toque para confirmar.
export default function Registro() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSession()?.user.id ?? '';
  const { data, error, loading } = useLoad(() => loadLog(userId, id), `${userId}:${id}`);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function remove() {
    if (!confirming) return setConfirming(true);
    const { error: err } = await supabase.from('training_logs').delete().eq('id', id).eq('user_id', userId);
    if (err) return setFailed('Não foi possível excluir o registro.');
    router.replace('/diario');
  }

  return (
    <Screen>
      <Button title="← Voltar" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/diario'))} />
      {loading && !data ? <Loading /> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!loading && data === null ? <Alert tone="danger">Registro não encontrado.</Alert> : null}
      {data ? (
        <>
          <Heading title={`Treino de ${new Date(data.trained_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`} subtitle={data.academyName ?? 'Treino pessoal'} />
          <Card>
            <Muted>Técnicas</Muted>
            {data.techniques.length === 0 ? <Muted>Nenhuma técnica associada.</Muted> : <Row>{data.techniques.map((t) => <Badge key={t.id} tone="accent">{t.name}</Badge>)}</Row>}
            <Muted>Anotações</Muted>
            <Text style={{ color: colors.text, lineHeight: 22 }}>{data.notes?.trim() ? data.notes : 'Sem anotações.'}</Text>
          </Card>
          {failed ? <Alert tone="danger">{failed}</Alert> : null}
          <Button title={confirming ? 'Toque de novo para excluir' : 'Excluir este registro'} variant="danger" onPress={remove} />
        </>
      ) : null}
    </Screen>
  );
}
