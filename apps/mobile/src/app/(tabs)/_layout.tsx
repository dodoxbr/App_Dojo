import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors, font } from '@/ui/theme';

// Navegação do aluno (brief de UI/UX): Início, Diário, Técnicas, Evolução, Perfil.
// Os ícones são símbolos de texto por enquanto (sem biblioteca de ícones; adicionar uma exige ADR).
const glyph = (symbol: string) =>
  function TabGlyph({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: font.lg, lineHeight: 24 }}>{symbol}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 60 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: glyph('⌂') }} />
      <Tabs.Screen name="diario" options={{ title: 'Diário', tabBarIcon: glyph('✎') }} />
      <Tabs.Screen name="tecnicas" options={{ title: 'Técnicas', tabBarIcon: glyph('▦') }} />
      <Tabs.Screen name="evolucao" options={{ title: 'Evolução', tabBarIcon: glyph('▲') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: glyph('☺') }} />
    </Tabs>
  );
}
