# Decisões e premissas

## Decisões confirmadas na conversa
- Produto escalável para **várias academias**, testado primeiro em uma.
- Cada academia tem logo, cores e identidade visual; filiação do aluno é solicitada e aprovada.
- Diário do aluno é o ponto de partida do produto; catálogo de técnicas e trilhas fazem parte do MVP.
- Professor/instrutor planeja aulas, valida presença e acompanha evolução; mestre define regras e aprova graduação.
- Crescimento por features: pagamentos, competições, social, fotos e IA depois.
- Desenvolvimento no VS Code com Claude Code, documentação em Markdown.

## Papéis e acesso (decisão do dono do produto, US-003)
- **Super admin da plataforma** (o dono do produto): libera quais usuários podem criar academias. Na fase de testes, tem acesso total à gestão **e ao diário de treino** (decisão do dono do produto em 2026-10-20, implementada na US-006 com uma chave `platform_settings.admin_diary_access`, ligada por ora). Antes de qualquer dado real ou piloto a chave deve ser desligada (`CLAUDE.md`, regra 6).
- **Gestor da academia**: quem cria a academia. É administrador e também atua como professor, com acesso geral à própria academia. Cadastra colaboradores (instrutores) e alunos (US-004).
- **Instrutor**: não tem acesso total. O gestor liga/desliga as permissões do instrutor da sua academia.
- **Aluno**: acessa o próprio diário e a própria evolução.

## Decisões adicionais do dono do produto (2026-10-20)
- **O mestre da academia pode se graduar** (sem bloqueio de autopromoção); toda concessão e retificação continua auditada e imutável.
- **Pode-se medir as técnicas mais consultadas**, de forma agregada e sem identificar a pessoa (US-012).
- **Desafios entre alunos (estilo Gymrats)** de treino e de golpes: aprovado como direção de produto; entram no backlog depois do painel e do fluxo de menores (`docs/features/F2-desafios.md`).
- **Faixas e idades:** o link https://www.meukimono.com.br/faixas-do-jiu-jitsu-guia-completo-atualizado-e-otimizado-2026 é referência de consulta (`docs/14`); as regras continuam sendo definidas por cada academia.

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
