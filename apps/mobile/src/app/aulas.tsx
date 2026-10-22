import { attendanceStatusLabels, isCheckInOpen } from '@dojo/contracts/attendance';
import { formatSessionRange } from '@dojo/contracts/classes';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadAgenda } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, EmptyState, Heading, Loading, Muted, Row, Screen, colors, space } from '@/ui';

// Agenda dos próximos 30 dias e pedido de check-in. O check-in só vira presença quando o professor confirma.
export default function Aulas() {
  const userId = useSession()?.user.id ?? '';
  const { data, error, loading, reload } = useLoad(() => loadAgenda(userId), userId);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function checkIn(sessionId: string) {
    setFailed(null);
    setBusy(sessionId);
    const { error: err } = await supabase.rpc('request_check_in', { p_session_id: sessionId, p_token: null });
    setBusy(null);
    if (err) return setFailed('Não foi possível pedir o check-in. A aula pode não estar mais aberta para isso.');
    setSent(new Set(sent).add(sessionId));
    reload();
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Button title="← Voltar" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Heading title="Agenda de aulas" subtitle="Só a presença confirmada pelo professor conta. Registrar o treino no diário não conta como presença." />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {failed ? <Alert tone="danger">{failed}</Alert> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.academies.length === 0 ? <EmptyState title="Você ainda não faz parte de nenhuma academia">Peça ao gestor da sua academia o link de entrada.</EmptyState> : null}
      {data && data.academies.length > 0 && data.sessions.length === 0 ? <EmptyState title="Nenhuma aula agendada nos próximos 30 dias">Quando o professor agendar, as aulas aparecem aqui.</EmptyState> : null}
      {data?.sessions.map((s) => {
        const academy = data.academies.find((a) => a.id === s.academy_id);
        const status = data.status.get(s.id);
        const open = isCheckInOpen(s.starts_at, s.ends_at, s.status, data.nowMs);
        return (
          <Card key={s.id}>
            <View style={{ gap: space[1] }}>
              <Text style={{ fontWeight: '700', color: colors.text, fontSize: 16 }}>{data.titles.get(s.class_id) ?? 'Aula'}</Text>
              <Muted>{formatSessionRange(s.starts_at, s.ends_at, academy?.timezone ?? 'America/Sao_Paulo')}{data.academies.length > 1 && academy ? ` · ${academy.name}` : ''}</Muted>
            </View>
            <Row>
              {s.status === 'cancelled' ? <Badge tone="danger">cancelada</Badge> : null}
              {status ? <Badge tone={status === 'validated' ? 'success' : status === 'revoked' ? 'danger' : 'info'}>{attendanceStatusLabels[status] ?? status}</Badge> : null}
              {sent.has(s.id) && !status ? <Badge tone="info">pedido enviado</Badge> : null}
            </Row>
            {!status && !sent.has(s.id) && open ? <Button title="Fazer check-in" loading={busy === s.id} onPress={() => checkIn(s.id)} /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
