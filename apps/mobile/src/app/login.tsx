import { signInSchema, signUpSchema } from '@dojo/contracts/auth';
import { CURRENT_TERMS_VERSION } from '@dojo/contracts/terms';
import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);
    if (mode === 'signin') {
      const parsed = signInSchema.safeParse({ email, password });
      if (!parsed.success) return setError('Informe um e-mail válido e senha com 8 ou mais caracteres.');
      setBusy(true);
      const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
      setBusy(false);
      if (err) setError('E-mail ou senha inválidos, ou e-mail ainda não confirmado.');
      return;
    }
    const parsed = signUpSchema.safeParse({ email, password, displayName, birthDate, acceptTerms });
    if (!parsed.success) return setError('Informe nome (2 a 120 caracteres), data de nascimento (AAAA-MM-DD), e-mail válido, senha com 8 ou mais caracteres e aceite os termos.');
    setBusy(true);
    const { error: err } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { display_name: parsed.data.displayName, birth_date: parsed.data.birthDate, terms_version: CURRENT_TERMS_VERSION } },
    });
    setBusy(false);
    if (err) setError('Não foi possível concluir o cadastro. Tente novamente.');
    else setMessage('Cadastro recebido. Confira seu e-mail para confirmar a conta.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mode === 'signin' ? 'Entrar' : 'Criar conta'}</Text>
      {mode === 'signup' && (
        <TextInput style={styles.input} placeholder="Nome" value={displayName} onChangeText={setDisplayName} autoComplete="name" />
      )}
      {mode === 'signup' && (
        <TextInput style={styles.input} placeholder="Data de nascimento (AAAA-MM-DD)" value={birthDate} onChangeText={setBirthDate} keyboardType="numbers-and-punctuation" />
      )}
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
      />
      {mode === 'signup' && (
        <View style={styles.terms}>
          <Switch value={acceptTerms} onValueChange={setAcceptTerms} accessibilityLabel="Aceitar os termos" />
          <Text style={styles.termsText}>Li e aceito os termos de uso e a política de privacidade (rascunho em revisão; texto completo no painel web, página /termos).</Text>
        </View>
      )}
      {busy ? <ActivityIndicator accessibilityLabel="Enviando" /> : <Button title={mode === 'signin' ? 'Entrar' : 'Cadastrar'} onPress={submit} />}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {message && <Text accessibilityRole="alert">{message}</Text>}
      <Button
        title={mode === 'signin' ? 'Criar uma conta' : 'Já tenho conta'}
        onPress={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setError(null);
          setMessage(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 6, padding: 10, minHeight: 44 },
  error: { color: '#B00020' },
  terms: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  termsText: { flex: 1 },
});
