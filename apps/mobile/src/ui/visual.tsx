import { beltPaint } from '@dojo/contracts/belts';
import type { WeekDay } from '@dojo/contracts/week';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from './theme';

// Elementos de destaque do app (marca Oss): cartão escuro com trama, faixa desenhada e semana com marcas.

// Cartão de destaque marinho, com listras diagonais discretas e um brilho turquesa no canto. O texto dentro é claro.
export function Hero({ children }: { children: ReactNode }) {
  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={styles.glow} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} pointerEvents="none" style={[styles.stripeLine, { left: 30 + i * 70 }]} />
      ))}
      <View style={{ gap: space[4] }}>{children}</View>
    </View>
  );
}

// Faixa desenhada com a cor do nome cadastrado (só visual; sem cor conhecida fica turquesa), ponta preta e um risco por grau.
export function BeltBar({ belt, degree = 0, height = 30 }: { belt: string | null | undefined; degree?: number; height?: number }) {
  const paint = beltPaint(belt);
  const base = paint?.base ?? colors.accent;
  const stripes = Math.max(0, Math.min(degree, 6));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, borderRadius: height / 3, backgroundColor: base, flexDirection: 'row', justifyContent: 'flex-end', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)' }}
    >
      {paint?.stripe ? <View style={{ position: 'absolute', left: 0, right: 0, top: '40%', bottom: '40%', backgroundColor: paint.stripe }} /> : null}
      <View style={{ minWidth: '28%', marginRight: '12%', paddingHorizontal: 10, backgroundColor: base === '#15181D' ? '#B3261E' : '#15181D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {Array.from({ length: stripes }, (_, i) => <View key={i} style={{ width: 4, height: '70%', backgroundColor: '#FFFFFF', borderRadius: 1 }} />)}
      </View>
    </View>
  );
}

// Os 7 dias da semana; marcado = treino confirmado pelo professor naquele dia. Hoje em destaque.
export function WeekStrip({ days, trained }: { days: WeekDay[]; trained: Set<string> }) {
  return (
    <View accessibilityLabel="Treinos confirmados nesta semana" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d) => {
        const done = trained.has(d.date);
        return (
          <View key={d.date} accessible accessibilityLabel={`${d.label}: ${done ? 'treino confirmado' : d.isFuture ? 'ainda não chegou' : 'sem treino confirmado'}`} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
            <Text style={{ fontSize: font.xs, fontWeight: '600', color: d.isToday ? colors.primary : colors.textMuted }}>{d.label}</Text>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done ? colors.accent : colors.bg,
                borderWidth: d.isToday ? 2 : 1,
                borderColor: done ? colors.accent : d.isToday ? colors.primary : colors.border,
                opacity: d.isFuture && !done ? 0.55 : 1,
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: font.sm, color: done ? '#FFFFFF' : d.isToday ? colors.primary : colors.textMuted }}>{done ? '✓' : d.date.slice(8)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primaryStrong,
    borderRadius: 24,
    padding: space[5],
    overflow: 'hidden',
    shadowColor: '#0F2F40',
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  glow: { position: 'absolute', right: -70, top: -90, width: 260, height: 260, borderRadius: radius.pill, backgroundColor: 'rgba(76,201,184,0.30)' },
  stripeLine: { position: 'absolute', top: -40, width: 2, height: 400, backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ rotate: '25deg' }] },
});
