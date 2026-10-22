import { saveTrainingLogSchema, trainedDateToTimestamp } from '@dojo/contracts/diary';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { newKey, todayLocal, useLoad } from '@/lib/hooks';
import { loadMemberships, searchTechniques, type TechniqueRow } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, Heading, Muted, Row, Screen, SectionTitle, TextField, colors, space } from '@/ui';

// Registrar um treino no diário privado. A chave de idempotência impede registro duplicado se o envio for repetido.
export default function NovoRegistro() {
  const userId = useSession()?.user.id ?? '';
  const { data: member } = useLoad(() => loadMemberships(userId), userId);
  const [date, setDate] = useState(todayLocal());
  const [academyId, setAcademyId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<TechniqueRow[]>([]);
  const [chosen, setChosen] = useState<{ id: string; name: string }[]>([]);
  const [clientKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    let alive = true;
    const timer = setTimeout(() => searchTechniques(query, 8).then((r) => alive && setFound(r)).catch(() => alive && setFound([])), 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const academies = (member?.academies ?? []).filter((a) => member?.memberships.some((m) => m.academy_id === a.id && m.status === 'approved'));

  async function save() {
    setError(null);
    const parsed = saveTrainingLogSchema.safeParse({ academyId, trainedDate: date, notes, techniqueIds: chosen.map((t) => t.id), clientKey });
    if (!parsed.success) return setError('Revise a data (AAAA-MM-DD, não pode ser futura), as anotações e as técnicas escolhidas.');
    setBusy(true);
    const { data, error: err } = await supabase.rpc('save_training_log', {
      p_academy_id: parsed.data.academyId ?? null,
      p_trained_at: trainedDateToTimestamp(parsed.data.trainedDate),
      p_notes: parsed.data.notes,
      p_technique_ids: parsed.data.techniqueIds,
      p_client_key: parsed.data.clientKey,
      p_log_id: null,
    });
    setBusy(false);
    if (err || !data) return setError('Não foi possível salvar o registro. Tente de novo.');
    router.replace({ pathname: '/diario/[id]', params: { id: String(data) } });
  }

  return (
    <Screen>
      <Heading title="Registrar treino" subtitle="O diário é privado: só você vê. Não conta como presença na academia." />
      <Card>
        <TextField label="Data do treino" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" hint="Formato AAAA-MM-DD." keyboardType="numbers-and-punctuation" autoCorrect={false} />
        {academies.length > 0 ? (
          <>
            <SectionTitle>Onde foi</SectionTitle>
            <Row>
              <Chip label="Treino pessoal" active={academyId === ''} onPress={() => setAcademyId('')} />
              {academies.map((a) => <Chip key={a.id} label={a.name} active={academyId === a.id} onPress={() => setAcademyId(a.id)} />)}
            </Row>
          </>
        ) : null}
        <TextField label="Anotações" value={notes} onChangeText={setNotes} multiline placeholder="O que você treinou, o que errou, o que quer lembrar" maxLength={10000} />
      </Card>

      <Card>
        <SectionTitle>Técnicas praticadas</SectionTitle>
        {chosen.length > 0 ? (
          <Row>
            {chosen.map((t) => <Chip key={t.id} label={`${t.name} ✕`} active onPress={() => setChosen(chosen.filter((c) => c.id !== t.id))} />)}
          </Row>
        ) : (
          <Muted>Nenhuma técnica escolhida (opcional).</Muted>
        )}
        <TextField label="Buscar técnica" value={query} onChangeText={setQuery} placeholder="nome ou sinônimo" autoCapitalize="none" autoCorrect={false} />
        {(query.trim() ? found : []).filter((t) => !chosen.some((c) => c.id === t.id)).map((t) => (
          <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Adicionar ${t.name}`} onPress={() => { setChosen([...chosen, { id: t.id, name: t.name }]); setQuery(''); }} style={{ paddingVertical: space[2] }}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>+ {t.name} <Text style={{ color: colors.textMuted, fontWeight: '400' }}>· {t.category}</Text></Text>
          </Pressable>
        ))}
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button title="Salvar no diário" onPress={save} loading={busy} />
      <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}>
      <Badge tone={active ? 'accent' : 'neutral'}>{label}</Badge>
    </Pressable>
  );
}
