# App Academia de Jiu-Jitsu — Especificação e Plano

19/10/2026 · Fernando

## Visão do produto

Um app que junta o **diário de treino e a rede social do aluno** com a **gestão do mestre** (presença, graduação por treinos, planos e mensalidades). O diferencial é que o registro feito pelo aluno alimenta automaticamente a contagem de graduação que o mestre aprova.

**Problema.** Hoje a academia controla presença em lista de papel ou WhatsApp, a contagem de treinos para grau é feita de cabeça, e o aluno anota o que aprendeu (quando anota) em app genérico. Pagamento é cobrado no boca a boca.

**Públicos:**

- **Aluno** — registra treinos, técnicas aprendidas, fotos, competições e pódios; vê quanto falta para o próximo grau.
- **Professor/instrutor** — publica plano de aula, confirma presença da turma, comenta a evolução.
- **Mestre/admin** — define as regras de graduação, aprova graus e faixas, acompanha assiduidade e inadimplência.

**Nome de trabalho:** a definir ("Tatame" já existe na App Store, então evitar).

## Pesquisa de mercado

O mercado se divide em dois grupos que não conversam: **sistemas de gestão** (foco no dono, pouco engajamento do aluno) e **diários de treino** (foco no aluno, sem vínculo com a academia). Nenhum encontrado une os dois com rede social e graduação por contagem de treinos voltada ao Brasil.

| App | Tipo | O que faz bem | Lacuna |
| --- | --- | --- | --- |
| [Kanri](https://apps.apple.com/us/app/id1536593435) (BR) | Gestão BJJ | Perfis professor/instrutor/aluno, mensalidades, boletos, marketplace | Depende de ERP web; sem lado social |
| [Empenho](https://jornaldobras.com.br/noticia/139145/gestao-de-academias-de-artes-marciais-exige-mais-do-que-controlar-mensalidades) (BR) | Gestão artes marciais | Turmas, presença, graduação, financeiro, multi-modalidade | Foco administrativo |
| [Tatame](https://mwm.ai/apps/tatame/6759703151) | Gestão BJJ | Pagamentos, presença, histórico de faixas, dashboards | Só lado do dono |
| [House of Grapplers](https://houseofgrapplers.com/software/bjj) (EUA) | Gestão BJJ | Critério de grau por presença, tempo na faixa, competições e aprovação do professor | Em inglês, preço em dólar |
| [Wodify](https://www.wodify.com/jiu-jitsu) (EUA) | Gestão + app aluno | Promoção baseada em presença, vídeos de técnica, sequência semanal, chat | Caro, genérico de fitness |
| [RollTracker](https://apps.apple.com/jo/app/rolltracker/id6753306314) | Gestão leve | Faixas e graus, medalhas, grátis até 10 alunos, Firebase | Só iPhone |
| [BJJNote](https://mwm.ai/apps/bjjnote-bjj-training-journal/6746068256), [Post Black Belt](https://apps.apple.com/app/id1673061463), [BJJ Logger](https://mwm.ai/apps/bjj-logger/6763979837) | Diário do aluno | Log de técnicas, sparring, estatísticas, sugestão por IA | Não liga com a academia |

**Sinal de demanda:** há pedidos recentes no [Workana](https://www.workana.com/job/desenvolvimento-de-aplicativo-para-gestao-de-escola-de-jiu-jitsu-com-presenca-e-graduacao) para exatamente este tipo de app (presença, 4 graus por faixa, perfis admin/professor/aluno, kids e adulto), o que confirma a dor.

**Diferencial proposto:**

1. O treino registrado pelo aluno vira presença validada pelo professor e conta para o grau.
2. Feed social da academia: técnica do dia, fotos de treino, pódios, ranking interno.
3. Regras de graduação configuráveis pelo mestre (cada academia tem a sua).
4. Cobrança em Pix Automático, padrão brasileiro.

## Perfis e permissões

Três papéis por academia; uma mesma pessoa pode ter papéis diferentes em academias diferentes (ex.: aluno numa, professor em outra).

| Ação | Aluno | Professor | Mestre/admin |
| --- | --- | --- | --- |
| Editar o próprio perfil, faixa atual, foto | Sim | Sim | Sim |
| Registrar treino, técnicas, fotos | Sim | Sim | Sim |
| Postar competição e pódio | Sim | Sim | Sim |
| Ver plano de aula da turma | Sim | Sim | Sim |
| Criar plano de aula / currículo | Não | Sim | Sim |
| Validar presença da turma | Não | Sim | Sim |
| Ver assiduidade de todos | Não | Sua turma | Toda a academia |
| Definir regras de graduação | Não | Não | Sim |
| Aprovar grau e faixa | Não | Sugere | Aprova |
| Ver e cobrar mensalidades | Só a própria | Não | Sim |
| Moderar feed, remover post | Não | Sim | Sim |

Para kids, o login é do **responsável**, que gerencia um ou mais dependentes.

## Features por fase

O **core (Fase 1) é só presença → contagem → graduação + diário**; tudo o que é social e financeiro entra depois, quando a turma já estiver usando.

| Fase | Objetivo | Features |
| --- | --- | --- |
| **1 · MVP (core)** | Presença vira grau; piloto na sua academia | Cadastro, login e academia · Turmas e check-in por QR · Professor valida presença · Diário: técnicas e anotações · Progresso até o próximo grau · Regras e ato de graduar |
| **2 · Social** (depois do piloto de 2 a 3 meses) | Aluno abre o app todo dia | Fotos e vídeos do treino · Feed da academia · Plano de aula da semana · Competições e fotos de pódio · Ranking interno · Notificações push |
| **3 · Financeiro** | Mestre sabe quem está em dia | Planos e mensalidades · Pix Automático via Asaas · Boleto e cartão · Painel de inadimplência · Bloqueio de check-in opcional · Recibos no app |
| **4 · Expansão** | Virar produto para outras academias | Multi-academia (SaaS) · Loja da equipe · Campeonatos internos · IA sugere o que treinar · Outras modalidades · Foto da turma com marcação |

A Fase 1 sozinha já resolve a dor do mestre (quem treinou e quem está pronto para grau). As fases 2 e 3 podem trocar de ordem se o mestre priorizar cobrança em vez de engajamento.

## Regras de graduação por treinos

A regra fica numa **tabela configurável pelo mestre**, nunca no código: cada academia define quantos treinos validados valem um grau em cada faixa. O app só sinaliza "elegível"; quem gradua é sempre o mestre.

Exemplo de configuração (números fictícios, a confirmar com o seu mestre):

| Faixa | Treinos por grau | Graus | Tempo mínimo na faixa | Observação |
| --- | --- | --- | --- | --- |
| Branca | 30 | 4 | — | Exemplo |
| Azul | 50 | 4 | 24 meses | Exemplo |
| Roxa | 70 | 4 | 18 meses | Exemplo |
| Marrom | 90 | 4 | 12 meses | Exemplo |
| Kids (cinza, amarela, laranja, verde) | 20 | 4 | Por idade | Exemplo |

**Como o app calcula:**

1. Só conta treino com presença **validada** (check-in na academia ou confirmado pelo professor). Treino registrado sem validação aparece no diário, mas não no contador.
2. O contador zera a cada grau ou faixa concedidos.
3. Barra de progresso no perfil do aluno: "faltam 8 treinos para o 3º grau".
4. Lista de elegíveis para o mestre, com botão "graduar" que grava data, quem graduou e foto da cerimônia.
5. Critérios extras opcionais por faixa: tempo mínimo, idade mínima (CBJJ/IBJJF), aprovação manual.

## Stack recomendada

**Recomendação: React Native com Expo (TypeScript) no app + Supabase no backend + Next.js para o painel web do mestre, tudo num monorepo.** Uma só linguagem do banco à tela, que é onde o Claude Code rende mais.

| Camada | Escolha | Por quê |
| --- | --- | --- |
| App (Android e iOS) | React Native + Expo, TypeScript, Expo Router | Um código para os dois sistemas; EAS Build gera o app de iPhone sem precisar de Mac; atualização OTA sem passar pela loja |
| Painel do mestre | Next.js (web) | Gestão, relatórios e financeiro são melhores em tela grande; reaproveita tipos e regras do app |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) | Postgres + SQL, que você já domina; Row Level Security resolve permissão por academia/papel; plano gratuito cobre o piloto |
| Fotos | Supabase Storage + compressão no celular | Bucket por academia, miniatura gerada antes do upload |
| Notificações | Expo Notifications | Lembrete de treino, aviso de grau, cobrança |
| Pagamentos | [Asaas](https://docs.asaas.com/docs/pix-automatico) (Pix Automático, boleto, cartão) | Pix Automático autoriza uma vez e cobra todo mês sozinho; o próprio Asaas cita [academias](https://blog.asaas.com/pix-automatico/amp/) como caso de uso; webhook atualiza o status no Supabase |
| Testes | Jest + Maestro (E2E mobile) | Claude Code consegue rodar e corrigir |

**Alternativa:** Flutter (Dart) + Supabase. Desempenho e UI ótimos, mas é outra linguagem e o painel web fica mais fraco. Só vale se você já preferir Dart.

**Por que não Firebase:** dá certo (o RollTracker usa), mas NoSQL complica relatórios de assiduidade, ranking e regras de graduação, que são consultas relacionais.

## Modelo de dados inicial

Todas as tabelas de negócio carregam `academy_id`; as políticas RLS do Supabase filtram por ele e pelo papel do usuário. Isso já deixa o app pronto para virar multi-academia (SaaS) sem refazer nada.

| Tabela | Campos principais | Fase |
| --- | --- | --- |
| `profiles` | id (auth), nome, apelido, foto, data de nascimento, responsavel_id | MVP |
| `academies` | id, nome, logo, endereço, lat/long (check-in) | MVP |
| `memberships` | profile_id, academy_id, papel (aluno/professor/mestre), status | MVP |
| `belts` | academy_id, nome, cor, ordem, graus_max, kids (bool) | MVP |
| `promotion_rules` | academy_id, belt_id, treinos_por_grau, meses_minimos | MVP |
| `rank_history` | profile_id, belt_id, grau, data, concedido_por, foto | MVP |
| `classes` | academy_id, nome (Gi, No-Gi, Kids), dia, horário, professor_id | MVP |
| `sessions` | class_id, data, plano_id, qr_token | MVP |
| `attendances` | session_id, profile_id, origem (qr/professor/manual), validado, validado_por | MVP |
| `training_logs` | profile_id, session_id (opcional), anotações, tecnicas[], humor/intensidade | MVP |
| `lesson_plans` | academy_id, título, tecnicas[], video_url, semana | Fase 2 |
| `media` | owner_id, academy_id, tipo, path, ligado a log/post/competição | Fase 2 |
| `posts`, `comments`, `reactions` | feed social da academia | Fase 2 |
| `competitions` | profile_id, evento, data, categoria, colocação, foto do pódio | Fase 2 |
| `plans`, `subscriptions`, `payments` | valor, vencimento, status, asaas_id | Fase 3 |

A contagem para o próximo grau é uma **view SQL**: presenças validadas desde a última linha de `rank_history`, comparadas com `promotion_rules`.

## Como tocar com Claude Code

Comece pela **especificação em arquivos dentro do repo**, depois peça ao Claude Code uma fatia vertical por vez (banco → API → tela → teste), sempre no modo plano antes de codar.

**Estrutura do monorepo:**

```
app-jiujitsu/
  CLAUDE.md            # regras do projeto, stack, convenções
  docs/
    SPEC.md            # este documento
    features/          # um .md por feature (critérios de aceite)
  apps/
    mobile/            # Expo (aluno, professor)
    admin/             # Next.js (mestre)
  packages/
    shared/            # tipos, regras de graduação, validações (zod)
  supabase/
    migrations/        # SQL versionado
    functions/         # Edge Functions (webhook Asaas, notificações)
```

**O que pôr no CLAUDE.md:** stack fixa; "toda tabela tem academy_id e RLS"; "regra de graduação nunca em código, só em promotion_rules"; idioma da UI em português; rodar testes e lint antes de concluir; não instalar lib nova sem perguntar.

**Ordem sugerida das sessões:**

1. Setup: monorepo, Expo, Supabase local (`supabase start`), CI simples.
2. Migrations do MVP + políticas RLS + seed com uma academia e faixas de exemplo.
3. Auth (e-mail/Google/Apple) e onboarding: escolher academia, faixa e grau atuais.
4. Turmas, sessões e check-in por QR code; validação pelo professor.
5. Diário de treino com técnicas e anotações.
6. View de progresso + tela de elegíveis + ato de graduar.
7. Painel web do mestre: assiduidade, alunos sumidos há 14+ dias, regras.
8. Build EAS, teste interno com a sua turma.

Dica: para cada feature, peça "escreva primeiro docs/features/X.md com critérios de aceite", revise, e só então "implemente seguindo o arquivo".

## Riscos, LGPD e monetização

**Verificação por foto.** Reconhecimento facial é dado biométrico, ou seja, dado sensível na LGPD, e envolve crianças. Para validar presença, use primeiro **QR code na sessão + localização da academia + confirmação do professor**. A foto da turma serve como registro, com o professor marcando quem está nela. Reconhecimento facial só como opcional futuro, com consentimento explícito e nunca para menores.

**Outros cuidados:**

- Perfil de menor sempre ligado a um responsável; foto de criança fora do feed público por padrão.
- Termo de uso e política de privacidade desde o MVP; botão de excluir conta (exigência das lojas).
- Feed restrito aos membros da academia; denúncia e moderação pelo professor.
- Dinheiro passa pelo Asaas, nunca pelo seu servidor; o app só guarda status e id da cobrança.
- Risco de adoção: se o professor não validar presença, a graduação não anda. Por isso o check-in por QR deve ser de 2 toques.

**Monetização (se virar produto):**

- Grátis para o aluno; assinatura mensal por academia, por faixa de número de alunos.
- Taxa pequena sobre mensalidades cobradas pelo app (split do Asaas).
- Extras: loja de quimonos e camisetas da equipe, inscrição em seminários e campeonatos internos.

**Validação barata:** rode o MVP na sua academia por 2 a 3 meses e meça quantos alunos registram treino toda semana antes de investir na fase de pagamentos.
