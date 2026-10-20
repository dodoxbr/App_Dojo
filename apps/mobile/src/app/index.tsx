import { StyleSheet, Text, View } from 'react-native';

// US-001: placeholder screen only. Features arrive in later stories.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dojo Platform</Text>
      <Text>Base técnica da US-001 — sem funcionalidades ainda.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
});
