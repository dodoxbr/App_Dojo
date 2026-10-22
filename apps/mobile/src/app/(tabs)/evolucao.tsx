import { buildRankHistory, criterionKindLabels, progressText, promotionEventLabels, type PromotionEvent } from '@dojo/contracts/graduation';
import { Text } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadEvolution } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Alert, Badge, Card, EmptyState, Heading, Loading, Muted, ProgressBar, Row, Screen, SectionTitle, colors, space } from '@/ui';

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

// Evolução do aluno: progresso nos critérios da academia e histórico oficial. É recomendação, nunca promoção.
export default function Evolucao() {
  const userId = useSession()?.user.id ?? '';
  const { data, error, loading, reload } = useLoad(() => loadEvolution(userId), userId);

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Heading
        title="Minha evolução"
        subtitle="Sua graduação oficial é registrada pelo gestor da academia; você não a altera. Só contam presenças confirmadas pelo professor."
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!data && !error ? <Loading /> : null}
      {data && data.length === 0 ? <EmptyState title="Você ainda não faz parte de nenhuma academia">Peça ao gestor da sua academia o link de entrada.</EmptyState> : null}
      {data?.map(({ academy, evaluation, events }) => {
        const { history, current } = buildRankHistory(events as PromotionEvent[]);
        return (
          <Card key={academy.id}>
            <SectionTitle>{academy.name}</SectionTitle>
            {!evaluation ? (
              <Alert tone="danger">Não foi possível calcular o seu progresso.</Alert>
            ) : !evaluation.has_rank ? (
              <EmptyState title="Nenhuma graduação registrada">O gestor precisa registrar de onde você parte para o progresso poder ser calculado.</EmptyState>
            ) : (
              <>
                <Text style={{ color: colors.text }}>
                  Graduação atual: <Text style={{ fontWeight: '700' }}>{evaluation.rank?.belt_code} · grau {evaluation.rank?.degree}</Text>
                </Text>
                {!evaluation.has_rule ? (
                  <Muted>A academia ainda não cadastrou uma regra para este ponto, então não há avaliação de progresso.</Muted>
                ) : (
                  <>
                    <Alert tone={evaluation.eligible ? 'success' : 'info'}>
                      {evaluation.eligible ? 'Todos os critérios atendidos.' : 'Ainda há critérios a atender.'} Isto é uma recomendação: a promoção depende de decisão do gestor.
                    </Alert>
                    {(evaluation.criteria ?? []).map((c) => (
                      <Card key={c.id} style={{ padding: space[3], shadowOpacity: 0, elevation: 0 }}>
                        <Row>
                          <Text style={{ fontWeight: '700', color: colors.text, flexShrink: 1 }}>{c.label}</Text>
                          <Badge tone={c.met ? 'success' : 'neutral'}>{c.met ? 'atendido' : 'a atender'}</Badge>
                        </Row>
                        <Muted>{criterionKindLabels[c.kind]} — {progressText(c)}</Muted>
                        {c.kind !== 'manual' && c.target ? <ProgressBar value={c.current ?? 0} max={c.target} label={c.label} /> : null}
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}
            <SectionTitle>Histórico de graduações</SectionTitle>
            {history.length === 0 ? (
              <Muted>Nenhuma graduação registrada.</Muted>
            ) : (
              history.map((e) => (
                <Card key={e.id} style={{ padding: space[3], shadowOpacity: 0, elevation: 0, opacity: e.superseded ? 0.65 : 1 }}>
                  <Muted>{fmt(e.effective_date)}</Muted>
                  <Text style={{ color: colors.text }}>
                    {promotionEventLabels[e.event_type] ?? e.event_type}: <Text style={{ fontWeight: '700' }}>{e.belt_code} · grau {e.degree}</Text>
                    {e.previous_belt_code ? ` (antes: ${e.previous_belt_code} · grau ${e.previous_degree})` : ''}
                  </Text>
                  {e.superseded || e.id === current?.id ? <Badge tone={e.superseded ? 'neutral' : 'accent'}>{e.superseded ? 'substituído por uma retificação' : 'graduação atual'}</Badge> : null}
                  {e.reason ? <Muted>{e.reason}</Muted> : null}
                </Card>
              ))
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
