import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, controlHeight, font, radius, space } from './theme';

// Componentes do Design System no app (brief de UI/UX). Só React Native puro: nenhuma dependência de interface.

export function Screen({ children, scroll = true, refreshing, onRefresh }: { children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.column]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: space[1] }}>
      <Text accessibilityRole="header" style={styles.h1}>{title}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.h2}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryContrast, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.borderStrong },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.6 : pressed ? 0.85 : 1 }]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : null}
      <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  secure,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string; secure?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: space[1] }}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secure && !visible}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, input.multiline ? styles.multiline : null, error ? styles.inputError : null, secure ? { paddingRight: 84 } : null]}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar a senha' : 'Mostrar a senha'}
            onPress={() => setVisible((v) => !v)}
            style={styles.reveal}
          >
            <Text style={styles.revealText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'danger' | 'success' | 'info'; children: ReactNode }) {
  const palette = {
    danger: { bg: colors.dangerSurface, border: colors.danger, fg: '#5F1A21' },
    success: { bg: colors.successSurface, border: colors.success, fg: '#123F27' },
    info: { bg: colors.infoSurface, border: colors.info, fg: '#12305A' },
  }[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={[styles.alert, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={{ color: palette.fg, fontSize: font.sm, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'info' }) {
  const palette = {
    neutral: { bg: colors.bg, fg: colors.text, border: colors.border },
    accent: { bg: colors.accentSurface, fg: '#0A5C54', border: colors.accentSurface },
    success: { bg: colors.successSurface, fg: '#145C35', border: colors.successSurface },
    danger: { bg: colors.dangerSurface, fg: '#8E2430', border: colors.dangerSurface },
    info: { bg: colors.infoSurface, fg: '#174A82', border: colors.infoSurface },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={{ color: palette.fg, fontSize: font.xs, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: safeMax, now: clamped }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${Math.round((clamped / safeMax) * 100)}%` }]} />
    </View>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {children ? <Text style={styles.muted}>{children}</Text> : null}
      {action}
    </View>
  );
}

export function Loading({ label = 'Carregando' }: { label?: string }) {
  return (
    <View style={{ padding: space[5], alignItems: 'center' }}>
      <ActivityIndicator accessibilityLabel={label} color={colors.primary} />
    </View>
  );
}

// Linha tocável de lista (técnica, registro do diário, aula…).
export function ItemRow({ title, meta, onPress, children }: { title: string; meta?: string; onPress?: () => void; children?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed ? { borderColor: colors.primary } : null]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3], flexWrap: 'wrap' }}>
        <Text style={styles.itemTitle}>{title}</Text>
        {meta ? <Text style={styles.muted}>{meta}</Text> : null}
      </View>
      {children}
    </Pressable>
  );
}

export function Row({ children, wrap = true }: { children: ReactNode; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: space[2], alignItems: 'center' }}>{children}</View>;
}

export { colors, font, radius, space };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space[4], paddingBottom: space[6] },
  column: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space[5] },
  h1: { fontSize: font.xl, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.sm, color: colors.textMuted, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[3],
    shadowColor: '#102840',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  button: {
    minHeight: controlHeight,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  buttonText: { fontSize: font.md, fontWeight: '600' },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  input: {
    minHeight: controlHeight,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: space[3],
    fontSize: font.md,
    color: colors.text,
  },
  multiline: { minHeight: 120, paddingTop: space[3], textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSurface },
  reveal: { position: 'absolute', right: 4, top: 0, bottom: 0, minWidth: 72, alignItems: 'center', justifyContent: 'center' },
  revealText: { color: colors.primary, fontWeight: '600', fontSize: font.xs },
  error: { color: colors.danger, fontSize: font.xs, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: font.xs },
  alert: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radius.control, padding: space[3] },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 2, alignSelf: 'flex-start' },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },
  empty: { gap: space[2], padding: space[5], borderRadius: radius.card, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.bg },
  emptyTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  item: { gap: space[2], padding: space[3], paddingHorizontal: space[4], borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  itemTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
});
