import { classificationStatusLabels } from '@dojo/contracts/technique';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { useLoad } from '@/lib/hooks';
import { loadTechnique } from '@/lib/queries';
import { Alert, Badge, Button, Card, Heading, Loading, Muted, Row, Screen, colors } from '@/ui';

export default function Tecnica() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading } = useLoad(() => loadTechnique(id), id);
  return (
    <Screen>
      <Button title="← Voltar" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/tecnicas'))} />
      {loading && data === undefined ? <Loading /> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!loading && data === null ? <Alert tone="danger">Técnica não encontrada.</Alert> : null}
      {data ? (
        <>
          <Heading title={data.name} subtitle={`${data.category}${data.level ? ` · ${data.level}` : ''}`} />
          <Row>
            {data.technique_type ? <Badge>{data.technique_type}</Badge> : null}
            {data.technique_position ? <Badge>{data.technique_position}</Badge> : null}
            {data.academy_id ? <Badge tone="accent">da academia</Badge> : null}
            {!data.reviewed ? <Badge tone="danger">aguardando revisão</Badge> : null}
          </Row>
          <Card>
            {data.description?.trim() ? <Text style={{ color: colors.text, lineHeight: 22 }}>{data.description}</Text> : <Muted>Esta técnica ainda não tem descrição.</Muted>}
          </Card>
          {data.classification_status === 'proposed' ? <Alert>Classificação {classificationStatusLabels.proposed}.</Alert> : null}
        </>
      ) : null}
    </Screen>
  );
}
