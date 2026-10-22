import { newPasswordSchema, signInSchema, signUpSchema } from '@dojo/contracts/auth';
import { CURRENT_TERMS_VERSION } from '@dojo/contracts/terms';
import { useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Card, Muted, Screen, TextField, colors, font, space } from '@/ui';

// Endereço do painel web (opcional): a recuperação de senha acontece lá (o link do e-mail abre no navegador).
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, '');

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    const same = newPasswordSchema.safeParse({ password, confirmPassword: confirm });
    if (!same.success) return setError(same.error.issues[0]?.message ?? 'Revise a senha.');
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
    <Screen>
      <View style={{ gap: space[2], paddingTop: space[5] }}>
        <Text accessibilityRole="header" style={{ fontSize: font.xxl, fontWeight: '700', color: colors.primary, letterSpacing: -0.5 }}>Dojo Platform</Text>
        <Muted>Seu treino, sua evolução, sua academia.</Muted>
      </View>

      <Card>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space[1], padding: space[1], backgroundColor: colors.bg, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
          {(['signin', 'signup'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => { setMode(m); setError(null); setMessage(null); }}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: mode === m ? colors.surface : 'transparent' }}
            >
              <Text style={{ fontWeight: '600', color: mode === m ? colors.primary : colors.textMuted }}>{m === 'signin' ? 'Entrar' : 'Criar conta'}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'signup' ? (
          <>
            <TextField label="Nome" value={displayName} onChangeText={setDisplayName} autoComplete="name" autoCapitalize="words" maxLength={120} />
            <TextField label="Data de nascimento" value={birthDate} onChangeText={setBirthDate} placeholder="AAAA-MM-DD" hint="Usada só para saber se você é maior de idade. Menores de 18 anos não criam conta: o responsável cria a conta e cadastra o menor no painel." keyboardType="numbers-and-punctuation" />
          </>
        ) : null}
        <TextField label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="voce@exemplo.com" />
        <TextField label="Senha" value={password} onChangeText={setPassword} secure autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} hint={mode === 'signup' ? 'Mínimo de 8 caracteres.' : undefined} />
        {mode === 'signup' ? <TextField label="Confirmar a senha" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" /> : null}
        {mode === 'signup' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Switch accessibilityLabel="Aceito os termos de uso e a política de privacidade" value={acceptTerms} onValueChange={setAcceptTerms} />
            <Text style={{ flex: 1, color: colors.text, fontSize: font.sm }}>Li e aceito os termos de uso e a política de privacidade (rascunho em revisão)</Text>
          </View>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        <Button title={mode === 'signin' ? 'Entrar' : 'Criar conta'} onPress={submit} loading={busy} />
        {mode === 'signin' && WEB_URL ? (
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`${WEB_URL}/recuperar-senha`)} style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: font.sm }}>Esqueci minha senha</Text>
          </Pressable>
        ) : null}
      </Card>
    </Screen>
  );
}
