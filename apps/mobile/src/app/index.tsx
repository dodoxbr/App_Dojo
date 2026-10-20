import { displayNameSchema } from '@dojo/contracts/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';

// Own profile (US-002). RLS limits reads/updates to the signed-in user.
export default function Profile() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('display_name')
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Não foi possível carregar o perfil.');
        else setName(data.display_name);
        setLoading(false);
      });
  }, []);

  async function save() {
    setError(null);
    setMessage(null);
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) return setError('O nome deve ter de 2 a 120 caracteres.');
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const id = userData.user?.id;
    const { error: err } = id
      ? await supabase.from('profiles').update({ display_name: parsed.data }).eq('id', id)
      : { error: new Error('sem sessão') };
    setSaving(false);
    if (err) setError('Não foi possível salvar o nome.');
    else setMessage('Nome atualizado.');
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meu perfil</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome" />
      {saving ? <ActivityIndicator accessibilityLabel="Salvando" /> : <Button title="Salvar" onPress={save} />}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {message && <Text accessibilityRole="alert">{message}</Text>}
      <Button title="Sair" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 10, minHeight: 44 },
  error: { color: '#B00020' },
});
