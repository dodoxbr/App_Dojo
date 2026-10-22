import { formatSessionRange } from '@dojo/contracts/classes';
import { membershipStatusLabels } from '@dojo/contracts/membership';
import { trainedDays, weekDays } from '@dojo/contracts/week';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadHome } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Alert, BeltBar, Button, Card, EmptyState, Hero, ItemRow, Loading, Muted, ProgressBar, Screen, SectionTitle, WeekStrip, colors, font, space } from '@/ui';

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
  const days = weekDays(new Date(data.nowIso), tz);
  const trained = trainedDays(data.recentStarts, tz);
  const weekCount = days.filter((d) => trained.has(d.date)).length;
  const measurable = criteria.filter((c) => (c.target ?? 0) > 0);
  const overall = measurable.length ? Math.round((measurable.reduce((sum, c) => sum + Math.min((c.current ?? 0) / (c.target as number), 1), 0) / measurable.length) * 100) : null;

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Hero>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: font.xs, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{data.primary?.name ?? 'Oss'}</Text>
            <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: font.xxl, fontWeight: '800', letterSpacing: -1 }}>Oss, {data.firstName}!</Text>
            {data.primary ? <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>{data.rank ? `${data.rank.belt_code} · grau ${data.rank.degree}` : 'Sem graduação registrada'}</Text> : null}
          </View>
          {overall !== null ? (
            <View accessible accessibilityLabel={`Progresso geral nos critérios: ${overall} por cento`} style={{ alignItems: 'center', justifyContent: 'center', width: 78, height: 78, borderRadius: 39, borderWidth: 7, borderColor: '#14B8A6', backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ color: '#FFFFFF', fontSize: font.lg, fontWeight: '800' }}>{overall}%</Text>
            </View>
          ) : null}
        </View>
        {data.primary && data.rank ? <BeltBar belt={data.rank.belt_code} degree={data.rank.degree} height={34} /> : null}
        <Button title="Registrar treino" variant="accent" onPress={() => router.push('/diario/novo')} />
        {data.primary ? <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: font.xs }}>Só contam treinos confirmados pelo professor. A graduação só muda com a aprovação do mestre.</Text> : null}
      </Hero>

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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <SectionTitle>Esta semana</SectionTitle>
              <Text style={{ color: colors.textMuted }}><Text style={{ fontWeight: '800', fontSize: font.lg, color: colors.primary }}>{weekCount}</Text> {weekCount === 1 ? 'treino confirmado' : 'treinos confirmados'}</Text>
            </View>
            <WeekStrip days={days} trained={trained} />
          </Card>

          <Card style={{ borderLeftWidth: 4, borderLeftColor: '#14B8A6' }}>
            <SectionTitle>Próximo treino</SectionTitle>
            {data.next ? (
              <>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.lg }}>{data.next.title}</Text>
                <Muted>{formatSessionRange(data.next.starts_at, data.next.ends_at, tz)}</Muted>
              </>
            ) : (
              <Muted>Nenhuma aula agendada por enquanto.</Muted>
            )}
            <Button title="Ver agenda e check-in" variant="secondary" onPress={() => router.push('/aulas')} />
          </Card>

          <Card>
            <SectionTitle>Meu progresso</SectionTitle>
            {criteria.length === 0 ? (
              <Muted>A sua academia ainda não definiu critérios de graduação medidos em números para o seu nível. Quando definir, o seu avanço aparece aqui.</Muted>
            ) : (
              criteria.map((c) => (
                <View key={c.id} style={{ gap: space[2] }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {c.label}: {c.current ?? 0}{c.kind === 'curriculum' ? '%' : ''} de {c.target ?? 0}{c.kind === 'curriculum' ? '%' : ''}
                  </Text>
                  <ProgressBar value={c.current ?? 0} max={c.target ?? 1} label={c.label} />
                </View>
              ))
            )}
          </Card>
        </>
      )}

      <SectionTitle>Diário recente</SectionTitle>
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
