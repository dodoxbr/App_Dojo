import { formatSessionRange } from '@dojo/contracts/classes';
import { membershipStatusLabels } from '@dojo/contracts/membership';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadHome } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Alert, Badge, Button, Card, EmptyState, ItemRow, Loading, Muted, ProgressBar, Screen, SectionTitle, colors, font, space } from '@/ui';

// Início do aluno. Só dados reais; só treino VALIDADO conta e a graduação oficial depende do mestre.
export default function Home() {
  const userId = useSession()?.user.id ?? '';
  const { data, error, loading, reload } = useLoad(() => loadHome(userId), userId);

  if (!data) {
    return (
      <Screen onRefresh={reload} refreshing={loading}>
        {error ? <Alert tone="danger">{error}</Alert> : <Loading />}
      </Screen>
    );
  }
  const tz = data.primary?.timezone ?? 'America/Sao_Paulo';
  const criteria = (data.evaluation?.has_rule ? (data.evaluation.criteria ?? []) : []).filter((c) => c.kind !== 'manual');
  const fmtDay = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit' }).format(new Date(iso));

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Card style={{ gap: space[1] }}>
        <Muted>{data.primary?.name ?? 'Dojo Platform'}</Muted>
        <Text accessibilityRole="header" style={{ fontSize: font.xl, fontWeight: '700', color: colors.text }}>Olá, {data.firstName}</Text>
        {data.primary ? <Badge tone={data.rank ? 'accent' : 'neutral'}>{data.rank ? `${data.rank.belt_code} · grau ${data.rank.degree}` : 'Sem graduação registrada'}</Badge> : null}
      </Card>

      {data.waiting.map((m) => (
        <Alert key={m.academy_id}>
          {m.name}: {membershipStatusLabels[m.status] ?? m.status}.
          {m.status === 'pending' ? ' Os recursos da academia liberam depois que o gestor aprovar o seu pedido.' : ''}
        </Alert>
      ))}

      {!data.primary ? (
        <EmptyState title="Você ainda não faz parte de uma academia">
          Peça ao gestor da sua academia o link de entrada (abra no painel). Assim que ele aprovar o seu pedido, o seu progresso aparece aqui.
        </EmptyState>
      ) : (
        <>
          <Card>
            <SectionTitle>Meu progresso</SectionTitle>
            {criteria.length === 0 ? (
              <Muted>A sua academia ainda não definiu critérios de graduação medidos em números para o seu nível. Quando definir, o seu avanço aparece aqui.</Muted>
            ) : (
              criteria.map((c) => (
                <Card key={c.id} style={{ padding: space[3], shadowOpacity: 0, elevation: 0, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {c.label}: {c.current ?? 0}{c.kind === 'curriculum' ? '%' : ''} de {c.target ?? 0}{c.kind === 'curriculum' ? '%' : ''}
                  </Text>
                  <ProgressBar value={c.current ?? 0} max={c.target ?? 1} label={c.label} />
                </Card>
              ))
            )}
            <Muted>Só contam treinos confirmados pelo professor. A graduação só muda com a aprovação do mestre.</Muted>
          </Card>

          <Card>
            <SectionTitle>Esta semana</SectionTitle>
            <Text style={{ fontSize: font.xxl, fontWeight: '700', color: colors.primary }}>{data.weekCount}</Text>
            <Muted>{data.weekCount === 1 ? 'treino confirmado' : 'treinos confirmados'} (segunda a domingo)</Muted>
          </Card>

          <Card>
            <SectionTitle>Próximo treino</SectionTitle>
            {data.next ? (
              <>
                <Text style={{ fontWeight: '700', color: colors.text }}>{data.next.title}</Text>
                <Muted>{formatSessionRange(data.next.starts_at, data.next.ends_at, tz)}</Muted>
              </>
            ) : (
              <Muted>Nenhuma aula agendada por enquanto.</Muted>
            )}
            <Button title="Ver agenda e check-in" variant="secondary" onPress={() => router.push('/aulas')} />
          </Card>
        </>
      )}

      <SectionTitle>Diário recente</SectionTitle>
      <Button title="Registrar treino" onPress={() => router.push('/diario/novo')} />
      {data.logs.length === 0 ? (
        <EmptyState title="Seu diário ainda está vazio">Registre o que treinou hoje. O diário é privado: só você vê.</EmptyState>
      ) : (
        data.logs.map((l) => (
          <ItemRow key={l.id} title={fmtDay(l.trained_at)} meta={(l.notes ?? '').slice(0, 60) || 'Treino registrado'} onPress={() => router.push({ pathname: '/diario/[id]', params: { id: l.id } })} />
        ))
      )}
    </Screen>
  );
}
