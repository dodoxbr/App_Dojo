import { displayNameSchema } from '@dojo/contracts/auth';
import { membershipRoleLabels, membershipStatusLabels } from '@dojo/contracts/membership';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadMemberships } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, Heading, Loading, Muted, Row, Screen, SectionTitle, TextField } from '@/ui';

// Endereço do painel web (opcional): usado para abrir o que só existe lá (ficha de cadastro, financeiro, feed).
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, '');

export default function Perfil() {
  const userId = useSession()?.user.id ?? '';
  const { data, loading, reload } = useLoad(() => loadMemberships(userId), userId);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('display_name').eq('id', userId).single().then(({ data: p }) => p && setName(p.display_name as string));
  }, [userId]);

  async function save() {
    setError(null);
    setMessage(null);
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) return setError('Informe um nome com 2 a 120 caracteres.');
    setBusy(true);
    const { error: err } = await supabase.from('profiles').update({ display_name: parsed.data }).eq('id', userId);
    setBusy(false);
    if (err) setError('Não foi possível salvar o nome.');
    else setMessage('Nome salvo.');
  }

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Heading title="Meu perfil" subtitle="Seus dados e suas academias." />
      <Card>
        <TextField label="Nome" value={name} onChangeText={setName} autoCapitalize="words" maxLength={120} />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        <Button title="Salvar" onPress={save} loading={busy} />
      </Card>

      <Card>
        <SectionTitle>Minhas academias</SectionTitle>
        {!data ? <Loading /> : data.memberships.length === 0 ? (
          <Muted>Você ainda não faz parte de nenhuma academia. Peça o link ao gestor da sua academia.</Muted>
        ) : (
          data.memberships.map((m) => (
            <Row key={m.academy_id}>
              <Muted>{data.academies.find((a) => a.id === m.academy_id)?.name ?? 'Academia'}</Muted>
              <Badge>{membershipRoleLabels[m.role] ?? m.role}</Badge>
              <Badge tone={m.status === 'approved' ? 'success' : 'info'}>{membershipStatusLabels[m.status] ?? m.status}</Badge>
            </Row>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>No painel web</SectionTitle>
        <Muted>A ficha de cadastro, o financeiro, o feed de fotos, os desafios e as medalhas ainda estão só no painel web.</Muted>
        {WEB_URL ? <Button title="Abrir o painel" variant="secondary" onPress={() => Linking.openURL(`${WEB_URL}/perfil`)} /> : null}
      </Card>

      <Button title="Sair" variant="secondary" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
