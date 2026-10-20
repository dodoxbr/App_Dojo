# Lacunas a validar com a academia piloto

- [ ] Nome do produto e identidade visual própria.
- [ ] Regras oficiais da academia para faixa/grau e exigências técnicas.
- [ ] Currículo da planilha revisado pelo mestre; permissões de reprodução.
- [x] Quem pode criar academias e quem se torna gestor inicial: o super admin libera usuários; quem cria vira gestor (decisão do dono do produto, `docs/00`).
- [ ] Instrutor pode aprovar filiação? O gestor cadastra colaboradores e alunos; falta definir se o instrutor também aprova (hoje fora do catálogo de permissões).
- [ ] Aluno sem filiação pode registrar treinos pessoais? Proposta: sim.
- [ ] Quais dados são necessários para menores e responsável?
- [ ] Privacidade de fotos e duração de armazenamento.
- [x] Check-in manual e por QR no MVP, com o mesmo núcleo (decisão do dono do produto, US-008).
- [ ] Regras de contagem: duas aulas no mesmo dia, treinos externos, treinos No-Gi, faltas e retificações.
- [ ] Regras de elegibilidade para grau após troca de academia.
- [ ] Termos, privacidade, propriedade intelectual dos vídeos e política de moderação.

## Técnicas (US-001)
- [ ] 30 vulnerabilidades reportadas por `npm audit` (8 moderate, 22 high), em dependências transitivas do Expo (`@expo/config-plugins` etc.). Reavaliar quando o Expo publicar correções; não rodar `npm audit fix --force`.
- [x] `packageManager` alinhado para npm@11.17.0 e Node >=24.
- [ ] Assets em `apps/mobile/assets` são placeholders do template Expo; substituir pela identidade visual (item de nome/identidade acima).
- [ ] Testes de RLS cobrem só as 6 tabelas da migration inicial; cada história nova deve ampliar `supabase/tests/database/`.
- [ ] `academies` legível por qualquer autenticado (diretório); revisar se ganhar colunas sensíveis.
- [ ] CI (`.github/workflows/ci.yml`) escrito mas ainda não executado (pasta sem remoto Git).

## US-002 (autenticação e perfil)
- [ ] Recuperação de senha, OAuth, MFA e exclusão de conta: fora do escopo da US-002.
- [ ] Idade/`birth_date` e cadastro de menores: bloqueado até a US-013; hoje qualquer pessoa pode criar conta.
- [ ] Login do mobile verificado só por typecheck, lint e bundle web; falta testar em dispositivo/emulador (SecureStore, `10.0.2.2` no Android).
- [ ] Telas do admin e do mobile não foram exercitadas em navegador; o fluxo foi validado por `scripts/smoke-auth.mjs` contra o Supabase local.
- [ ] E-mails de confirmação em produção exigem SMTP próprio e `site_url`/redirects definidos.
- [ ] Texto do nome padrão ("Novo usuário") e política de senha (mínimo 8) a validar com o produto.

## US-003 (academia, papéis e tema)
- [ ] Contraste do tema (4,5:1 entre as duas cores) e catálogo de permissões do instrutor são propostas; validar com a academia. Padrão inicial do instrutor: ver lista e validar presença.
- [ ] Super admin com acesso total à gestão só durante os testes. Antes do piloto: decidir o que ele pode ver, em especial o diário (US-006).
- [ ] Convite por e-mail para quem ainda não tem conta; hoje a pessoa precisa criar a conta antes de ser liberada.
- [ ] Upload de logo (Storage privado) não implementado; `logo_path` segue sem uso.
- [ ] A lista de criadores mostra só o início do ID, pois `profiles` é privado; avaliar exibir nome/e-mail por operação própria do super admin.
- [ ] Super admin é criado por `scripts/make-platform-admin.mjs` (banco local). Em homologação/produção, definir o procedimento seguro.
- [ ] Telas novas (plataforma, criar academia, gerenciar academia) verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador.

## US-004 (filiação)
- [ ] Regra para quem foi rejeitado/suspenso pedir de novo (hoje bloqueado; o gestor pode cadastrar a pessoa) e para quem teve o vínculo encerrado (hoje volta a pendente como aluno). Validar com a academia.
- [ ] Instrutor aprovar filiação: fora por ora; se necessário, entra como permissão do catálogo (`approve_members`).
- [ ] Convite para quem ainda não tem conta; o cadastro direto exige conta existente. O gestor consegue saber se um e-mail tem conta (enumeração limitada a gestores/super admin); avaliar quando houver convite por e-mail.
- [ ] Troca de papel pelo cadastro direto (aluno vira instrutor) sem tela própria de "alterar papel"; suspender/reativar vínculo não tem operação ainda.
- [ ] Telas de filiação só no painel web (o link abre no navegador); app mobile fica sem fluxo de entrada por ora.
- [ ] Telas novas (`/entrar/[slug]`, membros) verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador.
- [ ] Menores continuam sem tratamento (US-013): hoje qualquer conta pode pedir entrada.

## US-005 (catálogo)
- [x] Planilha importada (abas Básico, Intermediário, Avançado) após revisão declarada pelo dono do produto em 2026-10-20. Falta, se desejado, confirmação formal do mestre sobre categorias, descrição e posição de cada técnica.
- [ ] Abas ocultas não importadas: `Tempo de Faixa` (parece regra de graduação; nenhuma regra foi definida), `Avaliação`, `Planilha2`, `Planilha3` (listas soltas). Decidir se alguma entra no catálogo ou no currículo (US-009/US-010).
- [x] 18 erros de digitação corrigidos (migration `202610200009`; o nome original fica em `technique_sources.raw_name`).
- [ ] Itens duvidosos NÃO alterados, aguardando confirmação (`data/catalog/flagged_for_confirmation.csv`): `Escrima` (Esgrima?), `Axial` (Axila?), `Cambalhota e pegada das` (nome incompleto), `Oshi Gari` e termos locais não identificados. Também 3 pares de grafia parecida não fundidos.
- [ ] Tipo e posição das técnicas foram PROPOSTOS a partir de fontes públicas (Wikipedia, Kingz, BJJ More), sem validação do mestre: `classification_status = 'proposed'`; 127 com tipo, 121 com posição, 4 sem tipo. Validar com o mestre; revisar a técnica na tela marca a classificação como validada.
- [ ] Vocabulário de tipo e posição é texto livre com valores sugeridos pela própria base; definir lista fechada depois da validação.
- [ ] Numeração de origem com repetição (nº 45 duplicado em Quedas, nas abas Básico e Intermediário) e salto de 54 para 90 no Avançado: mantida como está em `technique_sources`.
- [ ] Nível de cada técnica = aba onde aparece primeiro; o vínculo técnica ↔ nível/faixa por trilha será tratado no currículo (US-009), usando `technique_sources`.
- [ ] Sem fichas técnicas (descrição, passos, vídeo): campo `description` vazio nas técnicas importadas.
- [ ] Busca sem índice (varredura); reavaliar com volume. Lista de categorias do filtro é calculada a partir das linhas visíveis.
- [ ] Permissão de uso/reprodução do conteúdo da planilha: decisão do dono do produto de manter no repositório (hoje público).
- [ ] Telas do catálogo verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador. Sem tela no app mobile.

## US-006 (diário)
- [ ] **GATE ANTES DO PILOTO / DADOS REAIS:** desligar o acesso de teste do super admin aos diários (`node scripts/set-admin-diary-access.mjs off`; hoje está LIGADO por decisão do dono do produto). Definir depois se o super admin terá algum acesso ao diário e com qual autorização do aluno.
- [ ] Leituras do super admin ao diário não são auditadas (RLS não registra SELECT); se o acesso for mantido, criar acesso por operação auditada.
- [ ] Compartilhamento do diário com o professor (permissão explícita e granular) ainda não existe: `visibility` aceita só `private`.
- [ ] Vínculo do registro com a aula/sessão (US-007) e rascunho pré-preenchido pelo plano da aula (F2).
- [ ] Diário só no painel web; sem tela no app mobile. Sem calendário, mídia, exportação nem exclusão de conta/dados (LGPD, `docs/06`).
- [ ] A data do treino é um dia (12:00 UTC); o fuso da academia será considerado quando houver sessões.
- [ ] Telas do diário verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador.

## US-007 (turmas e aulas)
- [ ] Fuso padrão `America/Sao_Paulo` (coluna `academies.timezone`); não há tela para mudar o fuso. Validar com a academia.
- [ ] Instrutor responsável agenda/cancela aulas da própria turma por padrão (não é uma permissão da matriz do gestor). Decidir se deve virar permissão configurável.
- [ ] Sem recorrência: cada aula é agendada uma a uma. Avaliar "gerar aulas semanais" depois de ver o uso.
- [ ] Alunos não veem o nome do instrutor (perfis são privados); decidir se o nome do professor responsável é público dentro da academia.
- [ ] Sem lotação máxima, lista de espera, tipo de aula (gi/no-gi) nem local; não definidos na especificação.
- [ ] Turma sem horário fixo: o dia/horário recorrente da turma não é modelado, só as aulas.
- [ ] Telas de turmas e agenda só no painel web, verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador.

## US-008 (presença)
- [ ] Janela de check-in (1 h antes até 1 h depois da aula) e validade do QR (15 min) são premissas; validar com a academia.
- [ ] Presença revogada é definitiva (o aluno não pede de novo e o professor não reverte). Definir se o gestor pode reabrir uma revogação feita por engano.
- [ ] Regras de contagem em aberto (duas aulas no mesmo dia, treino externo, No-Gi, faltas e retificações) ficam para a US-010.
- [ ] Não há matrícula do aluno em turma: qualquer membro aprovado pode fazer check-in em qualquer aula da academia. Avaliar vínculo aluno-turma.
- [ ] A lista de alunos para lançamento manual e os nomes dependem da permissão `view_roster` do instrutor (nível da academia, não da turma).
- [ ] O QR abre um link no navegador do celular (aluno precisa estar logado); sem leitura de câmera no app e sem app mobile para o aluno.
- [ ] Geolocalização no check-in não adotada (não confirmada em `docs/00`). Sem notificação ao professor de novos pedidos.
- [ ] Telas de presença verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador.
