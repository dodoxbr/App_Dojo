# Decisões e premissas

## Decisões confirmadas na conversa
- Produto escalável para **várias academias**, testado primeiro em uma.
- Cada academia tem logo, cores e identidade visual; filiação do aluno é solicitada e aprovada.
- Diário do aluno é o ponto de partida do produto; catálogo de técnicas e trilhas fazem parte do MVP.
- Professor/instrutor planeja aulas, valida presença e acompanha evolução; mestre define regras e aprova graduação.
- Crescimento por features: pagamentos, competições, social, fotos e IA depois.
- Desenvolvimento no VS Code com Claude Code, documentação em Markdown.

## Premissas de engenharia (a validar)
- Stack: Expo/React Native + Next.js + Supabase/Postgres + TypeScript.
- Cada usuário pode integrar mais de uma academia; uma academia pode integrar uma equipe e ter unidades futuras.
- Graduação é um evento imutável com possível retificação auditada; não há promoção automática.
- Trilha curricular e critérios de grau são independentes e configuráveis.
- A academia contrata; alunos não pagam pela plataforma no MVP.

## Não confirmado
- Quantidade de treinos por grau/faixa; regras específicas kids e federações.
- Nomenclatura comercial e disponibilidade de marca/domínio.
- Permissão de uso dos vídeos e da planilha; lista canônica de técnicas.
- Necessidade de geolocalização no check-in; retenção de fotos; modelo de cobrança.
