# Lacunas a validar com a academia piloto

- [ ] Nome do produto e identidade visual própria.
- [x] Regras de faixa/grau: cada academia cadastra as suas (critérios combináveis); o sistema não traz regra oficial (decisão do dono do produto, US-010). Falta cada academia cadastrar a sua.
- [ ] Currículo da planilha revisado pelo mestre; permissões de reprodução.
- [x] Quem pode criar academias e quem se torna gestor inicial: o super admin libera usuários; quem cria vira gestor (decisão do dono do produto, `docs/00`).
- [ ] Instrutor pode aprovar filiação? O gestor cadastra colaboradores e alunos; falta definir se o instrutor também aprova (hoje fora do catálogo de permissões).
- [ ] Aluno sem filiação pode registrar treinos pessoais? Proposta: sim.
- [ ] Quais dados são necessários para menores e responsável?
- [ ] Privacidade de fotos e duração de armazenamento.
- [x] Check-in manual e por QR no MVP, com o mesmo núcleo (decisão do dono do produto, US-008).
- [ ] Regras de contagem: duas aulas no mesmo dia (resolvido por regra: opção "dias diferentes"), treinos externos, treinos No-Gi, faltas e retificações.
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
- [x] Vínculo técnica ↔ nível na trilha tratado na US-009: o atalho do currículo usa `technique_sources.level`. O campo `techniques.level` continua sendo o primeiro nível em que a técnica aparece.
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

## US-009 (currículo e habilidades)
- [ ] A matriz de permissões do gestor é por PAPEL: liberar `assess_skills` vale para todos os instrutores da academia. Avaliar se deve haver permissão por pessoa.
- [ ] Instrutor não propõe técnicas para a trilha (`docs/06`: "propor/avaliar"); só o gestor configura. Definir o fluxo de proposta e aprovação.
- [ ] Autovalidação bloqueada para todos (inclusive gestor): premissa de conflito de interesse; validar com a academia.
- [ ] Aluno só registra progresso em técnica de currículo ativo; ao desativar um currículo o progresso fica guardado, mas oculto da trilha.
- [ ] A "trilha por nível" do atalho depende da planilha importada; a relação nível ↔ faixa não foi definida (a planilha cita BRANCA/AZUL/ROXA, não interpretado como regra).
- [ ] Sem histórico visível de avaliações por técnica (só auditoria), sem metas por prazo e sem agrupamento por categoria na trilha do aluno.
- [ ] Lista de alunos para avaliar depende da permissão de ver a lista (`view_roster`).
- [ ] Telas só no painel web, verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador. Sem tela no app mobile.

## US-010 (regras de graduação)
- [ ] **Cada academia precisa cadastrar a sua regra.** O sistema nasce sem regras; sem regra não há recomendação. Nada da aba oculta "Tempo de Faixa" foi usado.
- [ ] Rótulos de faixa e grau são texto livre da academia (faixa até 40 caracteres, grau 0 a 20); não há escada de graduações nem sugestão de "próxima faixa".
- [ ] A graduação atual de cada membro é registrada pelo gestor uma única vez (evento inicial). Mudanças futuras dependem da US-011 (promoção/correção). Graduação declarada pelo aluno com confirmação (regra 7) não foi implementada.
- [ ] Critério de nível técnico usa a validação **atual** das técnicas (não exige que tenham sido validadas depois da última graduação). Avaliar se deve contar só o que foi validado após o marco.
- [ ] Critério manual ("comprometimento" etc.) é binário (atende / não atende) com observação; sem escala. Permissão `recommend_graduation` vale por papel.
- [ ] Sem regras por idade, kids ou federação (`docs/04`: exigem confirmação com a academia). Menores seguem sem tratamento (US-013).
- [ ] Não há como encerrar uma regra sem substituí-la por outra versão.
- [ ] Novos tipos de critério exigem migration (a validação fica no banco).
- [ ] Telas só no painel web, verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador. Sem tela no app mobile.

## US-011 (conceder graduação)
- [ ] Fluxo em uma etapa: o gestor concede direto. Se a academia quiser "professor recomenda → gestor aprova" como etapas registradas, é uma evolução (hoje a recomendação é calculada e fica na auditoria).
- [x] O mestre se gradua: permitido (decisão do dono do produto, migration 017); a auditoria mostra quem concedeu.
- [ ] A data de vigência pode ser retroativa até a graduação atual; não há validação contra a idade mínima de cada grau (regras por idade/kids/federação não definidas).
- [ ] Sem notificação ao aluno, sem certificado e sem promoção em lote.
- [ ] A retificação só alcança o último registro pela tela; retificar um registro mais antigo exige a operação direta (a regra no banco permite).
- [ ] Telas só no painel web, verificadas por typecheck, lint, build e smoke test do backend; falta uso manual em navegador. Sem tela no app mobile.

## Referência de faixas e idades (docs/14)
- [ ] A fonte indicada é um blog com tempos "médio" e "IBJJF" divergentes e sem a faixa etária de cada faixa infantil. Não foi usada como regra. Confirmar com a academia se haverá critério de idade (exige data de nascimento e o fluxo de menores, US-013).

## Desafios entre alunos (F2)
- [ ] Decisões abertas em `docs/features/F2-desafios.md` (quem cria, forma do ranking, pontos de registros não verificados, premiação). Depende da US-013 antes de qualquer participação de menores.

## US-012 (painel e indicadores)
- [ ] Tamanho mínimo de grupo para exibir diário e técnicas mais consultadas = 5 alunos aprovados: premissa de privacidade, a validar (`min_group_size()` em um só lugar).
- [ ] Sem metas: o painel só mede. Definir com a academia o que é "bom" depois do piloto.
- [ ] Feedback dos professores (indicador do `docs/01`) não tem coleta; precisa de definição.
- [ ] A consulta de técnica é contada ao abrir a página (atualizar a página conta de novo); sem deduplicação por pessoa, de propósito (não guarda quem).
- [ ] Retenção considera presença validada por semana (semana começa na segunda, no fuso da academia).
- [ ] Sem painel de toda a plataforma para o super admin (cada academia tem o seu); sem exportação.
- [ ] Testes de tela cobrem renderização e autorização (49 páginas, 5 papéis), não cliques em formulários. Falta E2E em navegador (Playwright), que exigiria dependência e ADR. Pela primeira vez as telas foram renderizadas por um teste automatizado; ainda falta uso humano em navegador e conferência visual.

## US-013 parte 1 (idade e bloqueio de menores)
- [x] Menores de 18 anos não entram sozinhos; a parte 2 (abaixo) criou o fluxo do responsável.
- [ ] Maioridade = 18 anos é premissa; confirmar com o jurídico, junto com as regras de consentimento (LGPD art. 14).
- [ ] A data de nascimento declarada pela pessoa não é verificada com documento; a conferência presencial pelo gestor fica para a parte 2.
- [ ] Conta antiga sem data não entra em academia até declarar; a declaração é única e só muda por correção manual do administrador.
- [ ] O app mobile pede a data de nascimento no cadastro (texto AAAA-MM-DD); falta seletor de data e a tela de perfil com a declaração única.

## US-014 (desafios)
- [ ] Limite de 3 desafios em aberto por criador e de 20 registros por pessoa por dia são premissas antiabuso; validar com a academia.
- [ ] Registros do aluno contam sem confirmação (decisão do dono do produto); o selo "confirmado" depende de presença validada (aula ± 1 hora, premissa). Não há revisão individual pelo professor além de anular.
- [ ] Sem foto da aula no calendário (US-015), sem reações/comentários/medalhas (US-016) e sem notificações.
- [ ] Sem desafios por equipe nem sequências semanais.
- [ ] Menores seguem fora dos desafios e rankings de propósito (regra da US-013b); incluir só com regra explícita e revisão jurídica.
- [ ] Desafio já ativado antes da data de início fica "ativado, começa em breve"; o desafio não é reaberto se terminar sem o mínimo (expira).
- [ ] Telas só no painel web, verificadas pelo teste de renderização; falta uso humano em navegador. Sem tela no app mobile.

## US-013 parte 2 (responsável e menor)
- [ ] **Texto do consentimento é rascunho** (`rascunho-2026-10`); precisa de revisão jurídica (LGPD art. 14) antes de qualquer menor real. Definir também prazo de retenção e como o responsável pede exclusão dos dados do menor.
- [ ] **Dados financeiros** (CPF, endereço de cobrança, mensalidade, pagamento) não foram criados: não há módulo de cobrança no backlog e a decisão de LGPD está aberta. Hoje só se registra **quem é** o responsável financeiro (por código).
- [x] Aos 18 anos o acesso do responsável cessa e o jovem cria uma conta nova (decisão do dono do produto; ver "Decisões após a US-013b").
- [ ] A conferência do documento é **presencial e declarada pelo gestor**; o sistema não valida o documento nem o parentesco (premissa). Confirmar com a academia se isso basta.
- [ ] O dependente é criado inserindo em `auth.users` por função do banco (ADR-018). Acompanhar atualizações do Supabase Auth; os testes de banco e o smoke detectam quebra. Nunca foi testado em um projeto Supabase hospedado, só no stack local.
- [ ] Limite de 7 dependentes por responsável (decisão do dono do produto). Ainda não há troca de responsável legal (separação, tutela) nem mais de um responsável legal por menor.
- [ ] O pré-preenchimento do cadastro do menor usa o metadado da conta (editável pela própria pessoa); o servidor valida tudo de novo. Sem notificação ao responsável (e-mail/push).
- [ ] Sem tela no app mobile; telas do painel verificadas só pelo teste de renderização (63 páginas), sem uso humano em navegador.
- [ ] Foto de menor (US-015) só com o consentimento específico `consent_photos`; a regra ainda não é consumida por nenhuma tela.

## Decisões do dono do produto após a US-013b (2026-10-20)
- [ ] Termos gerados ao criar a conta (US-016); texto sempre rascunho até revisão jurídica.
- [ ] Ficha de cadastro com nome, e-mail, telefone e endereço (US-016): dados pessoais em tabela privada, visíveis só ao titular, ao responsável e ao gestor da academia; definir retenção e exclusão.
- [ ] Aos 18 anos o jovem cria uma **conta nova** (não assume a do menor). Falta decidir o que acontece com o histórico (frequência, graduação) do menor: copiar, vincular ou começar do zero. Isso substitui a pendência de "assunção de conta".
- [ ] Financeiro (US-017): controle por aluno pelo gestor; escolher a plataforma de pagamento (provedor, taxas, PIX/boleto/cartão, repasse) e registrar ADR; nunca guardar dados de cartão; CPF e endereço de cobrança entram com a ficha.
- [ ] Feed de fotos (US-018) substitui o grupo de WhatsApp dos treinos: definir quem posta, quem vê, retenção e o consentimento de foto (maiores também).
- [x] Limite de dependentes por responsável = 7 (migration 022).

## US-016 (termos e ficha)
- [ ] **Os termos são rascunho**: a empresa e o CNPJ vêm dos dados da academia e das variáveis `PLATFORM_LEGAL_NAME`/`PLATFORM_CNPJ`; falta o canal de atendimento. Precisam de revisão jurídica antes de qualquer pessoa real; só então definir a retenção dos dados.
- [x] A troca de versão dos termos só avisa no perfil (decisão do dono do produto).
- [ ] A ficha não verifica telefone, e-mail ou endereço (só o formato). Sem consulta de CEP, sem confirmação por SMS.
- [x] Contato de emergência (obrigatório) e observações de saúde (opcionais, com consentimento) entraram na US-016b.
- [ ] O gestor lê a ficha de todos os membros da academia (intencional, auditado). Confirmar se o instrutor também precisa de telefone (hoje não vê).
- [ ] Sem exportação nem exclusão a pedido do titular (LGPD art. 18); falta fluxo e prazo.
- [ ] CPF e dados de cobrança ficam para a US-017 (coletar só o necessário).
- [ ] O app mobile pede o aceite no cadastro, mas ainda não tem tela para a ficha nem para os termos.
- [ ] Contas criadas antes desta versão não têm ficha: ficam sem poder pedir entrada até preencher.
- [x] O professor passou a ver as observações de saúde e o contato de emergência (permissão `view_health`, ligada por padrão). Falta a revisão jurídica do uso de dado sensível e o aviso claro ao aluno de que o professor vê (o texto do consentimento da ficha já diz que o gestor vê; atualizar para o professor).
- [ ] A razão social/CNPJ da academia é informada pelo gestor e **não é conferida** em base oficial; só o dígito verificador é validado. A empresa da plataforma depende das variáveis de ambiente do ambiente de produção (ainda não existe).

## US-017 (financeiro manual)
- [ ] **Validar com a academia** se o fluxo manual (plano por aluno, gerar o mês, marcar o pagamento) atende; só depois decidir a plataforma de pagamento.
- [ ] Sem juros, multa, pagamento parcial, 2ª via nem comprovante: o gestor registra o valor cheio; para outro valor, cancele e crie uma avulsa. O desconto é um valor fixo por plano, com motivo.
- [ ] Sem lembrete de vencimento nem aviso ao aluno ou responsável (não há notificações na plataforma ainda).
- [ ] Sem relatório exportável (planilha) nem visão consolidada de vários meses; só o resumo do mês.
- [ ] Mensalidade só para alunos; instrutores e outros colaboradores não têm plano. Desconto de irmãos ou bolsa é manual, por aluno; avaliar regras automáticas (percentual, família) se a academia pedir.
- [x] Geração automática do mês entregue (opção por academia, job diário); a manual continua.
- [ ] Os dados financeiros são pessoais: o gestor vê o que cada pessoa deve; definir retenção e o que acontece com as cobranças quando a pessoa sai da academia (hoje ficam).
- [ ] O responsável financeiro só consulta; ele não marca pagamento. O app mobile não tem telas de financeiro.
- [ ] O super admin não vê o financeiro das academias (decisão de privacidade); suporte a problemas exigirá um procedimento à parte.

## Pós-US-017 (automático, desconto, saúde)
- [ ] O agendamento usa **pg_cron**: em produção precisa estar habilitado no painel do Supabase (não foi testado em projeto hospedado). Se o job não rodar, o gestor ainda gera o mês na mão.
- [ ] A geração automática cria as cobranças do **mês corrente** (inclusive ao ligar no meio do mês, com vencimento possivelmente já passado). Avaliar se deve gerar só a partir do mês seguinte.
- [ ] O texto do consentimento de saúde na ficha precisa citar o **professor** além do gestor; exige revisão jurídica.
- [ ] O professor vê a saúde de todos os alunos da aula; não há troca de permissão por turma. O professor responsável pela turma é o mesmo que tem a permissão geral de instrutor.
- [ ] CI: a varredura de segredos (gitleaks) acusava a senha fictícia dos testes locais e falhou em 3 execuções passadas; adicionada exceção em `.gitleaks.toml` só para esse valor (`senha-sintetica-123`).

## US-018 (feed de fotos)
- [ ] **A foto fica no banco** (ADR-022), não no Storage: acompanhar o tamanho; para vídeo ou volume alto, migrar para Storage com CDN.
- [ ] **Quem aparece na foto sem ser marcado** não é detectado: o sistema confia em quem posta para marcar os menores (e na denúncia dos outros membros). Não há reconhecimento facial nem revisão antes de publicar.
- [ ] Os termos agora dizem que as fotos são vistas pelos membros, que a academia pode postar no Instagram e como pedir a remoção. Para adultos o aceite é **por participar dos treinos**, sem opção individual de recusar o Instagram: pedir parecer jurídico e avaliar uma caixa de autorização separada para adultos (como existe para menores).
- [x] O responsável legal passou a ver as fotos do feed em que o filho aparece (decisão do dono do produto).
- [ ] Menor sem login não posta; um responsável posta como ele mesmo.
- [ ] A retenção de 30 dias é igual para todas as academias; não há "guardar uma foto" nem álbum. Reações e comentários entraram na US-019; seguem sem vídeo e sem notificações.
- [ ] O corte de 20 posts por dia e de 800 KB por foto são premissas de custo/antiabuso.
- [ ] O app mobile não tem o feed.
- [ ] A plataforma **não publica no Instagram**: quem decide e publica é a academia, fora do sistema. O aviso "pode/não pode ir para as redes sociais" só considera os menores **marcados**; menor não marcado na foto não é detectado.
- [ ] Remover uma foto da plataforma não remove cópias já publicadas no Instagram ou baixadas por terceiros; o texto dos termos avisa, mas o processo de retirada nas redes é da academia.

- **Armadilha do Next dev:** nunca use `serverAction.bind(null, …)` dentro de componente cliente passado ao `useActionState` (o servidor de desenvolvimento entra em laço e trava). Use closure `(prev, formData) => action(ids, prev, formData)` ou faça o `bind` em componente servidor. Passeio em navegador real: `node scripts/e2e-browser.mjs` (precisa de `SUPABASE_ANON_KEY`, painel em execução e Supabase local).

## US-019 (reações, comentários e medalhas)
- [ ] **Os limiares das medalhas são valores de TESTE** (10/25/50/100 presenças, 4/12 semanas seguidas, vencedor de desafio de presença): o dono do produto precisa fixar a lista e os critérios finais (`medal_catalog()` na migração 029).
- [ ] Decisões tomadas (2026-10-20): um só tipo de reação ("Osu!"); comentários de adultos com denúncia e gestor apaga; medalhas só do que é verificado; menor ganha medalha mas não reage nem comenta; responsável não comenta nem vê comentários.
- [ ] Os membros adultos veem as medalhas uns dos outros (quadro da academia), sem opção de esconder; menor só para o responsável e o gestor. Confirmar com o dono do produto e, se for o caso, com a revisão jurídica.
- [ ] Desafios de treino e de golpes (informados pelo aluno) **não** dão medalha, por não serem verificados.
- [ ] Medalhas são calculadas a cada consulta (ADR-023); revisar o custo se uma academia crescer muito.
- [ ] Sem edição de comentário, resposta, menção, vários tipos de reação, notificações e medalha manual do gestor.
- [ ] O app mobile não tem reações, comentários nem medalhas.
- [x] (resolvido com `supabase db reset` em 2026-10-21) **Testes do banco com dados de sobra:** `supabase test db` falha em 4 testes antigos (contagens globais de auditoria e de mensalidades) quando o banco local tem dados de testes manuais; num banco limpo (`supabase db reset`) eles passavam. Não foi feito reset para não apagar as contas de teste em uso.

## US-020 (aviso de 30 treinos)
- [ ] O professor pediu "30 treinos" e o dono do produto confirmou a contagem **desde a última graduação**; não há regra de graduação por número de treinos no sistema (nenhum número de graduação foi inventado). Confirmar se o marco vale igual para todas as faixas e para menores.
- [ ] O aviso é **só dentro do app** (sem push, e-mail ou WhatsApp). Sem "visto/dispensar".
- [ ] Para o instrutor o menor aparece só como "menor de idade", sem o nome do responsável.
- [ ] O app mobile não mostra o aviso.
- [ ] O número do aviso é **por professor** (padrão 30). Se vários professores acompanham o mesmo aluno, ele recebe o aviso quando o menor número entre os professores dele é atingido; instrutor sem permissão de graduação não configura (vale 30 para as turmas dele). Sem configuração por faixa ou por aluno e o gestor não ajusta o número de outro professor.
- [x] (corrigido em 2026-10-21; conferir no CI de madrugada) **`challenges.test.sql` depende do horário:** as aulas do cenário ficam 10 h e 6 h atrás e as datas são do dia local; entre 00:00 e ~10:00 (horário de Brasília) 2 testes (70 e 75) falham. Passa no resto do dia. Reescrever com horários fixos em relação ao início do dia local.

## Redesign (etapa 1: login e cadastro)
- [x] (2026-10-21) **Recuperar senha** feita: link "Esqueci minha senha" no login, `/recuperar-senha`, `/auth/callback`, `/redefinir-senha`. Ver a seção "Recuperar senha" abaixo.
- [ ] A marca "Dojo Platform" (BrandLogo) é **provisória**, desenhada no código; trocar só esse componente quando houver o logotipo oficial. Não há foto nem ilustração (o brief só permite com ativo autorizado).
- [ ] O selo "N" redondo que aparece na tela é do servidor de desenvolvimento do Next e **some no build de produção**.
- [ ] Os campos de senha e confirmação voltam vazios depois de um erro (de propósito); nome, data, e-mail e aceite dos termos ficam preenchidos.
- [ ] As demais telas ainda usam o visual antigo (`@layer legacy`); migrar na ordem do brief: onboarding/filiação, home do aluno, diário, catálogo, painel do professor. Componentes ainda a criar: AppShell, BottomNavigation, SidebarNavigation, PageHeader, ProgressBar, Badge, EmptyState, LoadingState, Modal/ConfirmDialog, AcademyThemeProvider, TechniqueCard, TrainingLogCard, BeltProgressCard.
- [ ] Tema escuro e cores por academia (AcademyThemeProvider) ainda não implementados; os tokens já estão prontos para isso.
- [ ] Capturas das telas de login em 360, 390, 768 e 1280 px: rodar `node scripts/e2e-login.mjs` (cria e apaga uma conta sintética no banco local).

## Redesign (etapa 2: navegação e home do aluno)
- [x] AppShell (barra lateral no desktop, barra inferior no celular), `NavLinks`, Badge, ProgressBar, EmptyState, PageHeader e ButtonLink criados; home do aluno em `/inicio` com dados reais (progresso pelos critérios da regra de graduação, treinos confirmados na semana, próximo treino, diário recente). Login agora leva a `/inicio`.
- [ ] O shell com a navegação do aluno só envolve `/inicio`, `/diario`, `/tecnicas`, `/graduacao` e `/perfil`; as demais telas do aluno (aulas, trilha, desafios, financeiro, feed, medalhas…) ainda não têm a navegação persistente.
- [x] (etapa 3) Gestor e instrutor têm navegação própria: layout `apps/admin/app/academia/[id]/layout.tsx` (menu por papel e por permissão; o super admin só vê Plataforma e Painel) e início da equipe em `/academia/[id]/inicio` (alunos ativos, pedidos de entrada, presenças a confirmar, alunos no número de treinos, ações rápidas, próximas aulas). `/inicio` leva quem só trabalha na equipe para esse início.
- [ ] A home mostra a primeira academia por ordem de nome; sem seletor de academia para quem treina em mais de uma.
- [ ] "Meta configurada" do brief: usa os critérios numéricos da regra de graduação da academia (presenças, dias, trilha); sem regra cadastrada mostra aviso, nunca um número inventado. O progresso do aluno não mostra o número do aviso dos 30 treinos (é do professor).
- [ ] Telas antigas dentro do shell ficam como cartão (visual legado) até serem migradas.

## Redesign (etapa 3: navegação por papel)
- [x] (etapa 4) O menu agora aparece também nas telas pessoais e compartilhadas, por layouts de `perfil`, `diario`, `tecnicas`, `graduacao`, `aulas`, `trilha`, `desafios`, `financeiro`, `feed`, `medalhas`, `checkin`, `turmas` e `dependentes` (`components/shell/AutoShell.tsx`): aluno e responsável veem o menu do aluno (com "Equipe" se também trabalharem numa academia); quem só trabalha na equipe vê o menu da equipe. Ficam sem menu: login, termos e `/entrar/[slug]`.
- [ ] O início da equipe usa a primeira academia (a que vier primeiro) de quem trabalha em mais de uma; sem seletor de academia.
- [ ] "Graduações elegíveis" do brief aparece como "No número de treinos" (aviso por professor, US-020); não existe indicador de elegibilidade pela regra de graduação do gestor.
- [ ] O menu "Mais" da barra inferior é um `<details>`; não foi testado com leitor de tela.

## Redesign (etapa 4: telas migradas)
- [x] Visual novo (componentes `Page`, `PageHeader`, `ItemLink`, `Badge`, `EmptyState`, `SelectField`) em **diário** (lista), **catálogo de técnicas** (busca e lista) e **agenda de aulas** (com o botão de check-in no componente `Button`). A lógica e os dados não mudaram.
- [x] (etapa 5) Telas reescritas com os componentes: perfil, trilha (com barra de progresso), graduação do aluno (critérios com barra e histórico em linha do tempo, também usados na tela do aluno para o professor), medalhas e a página inicial pública `/`. As demais (formulário e detalhe do diário, detalhe da técnica, desafios, financeiro, feed, dependentes, turmas e as telas de gestão) recebem o visual novo pela **ponte visual** do shell (`AppShell.module.css`, só em elementos sem classe), sem mudar o conteúdo; migrar para os componentes uma a uma quando houver necessidade de layout próprio.
- [ ] Lista de técnicas no celular: cartões compactados na etapa 5 (categoria e nível na linha de cima; tipo e posição em texto; etiquetas só para "da academia", "classificação proposta" e "aguardando revisão"). Conferir em aparelho real se ficou bom ou se deve virar duas colunas/paginação menor.
- [ ] Com o servidor de desenvolvimento ligado, `npm run typecheck` pode acusar conflito em `.next/dev/types` depois de criar layouts; apague `apps/admin/.next` (ou pare o servidor) para ver o resultado real. O CI parte de pasta limpa.

## Recuperar senha (2026-10-21)
- [x] Fluxo: pedido (resposta **sempre igual**, exista a conta ou não) → e-mail com link de uso único → `/auth/callback` troca o código por sessão (só caminhos internos em `next`) → nova senha com confirmação (8 a 72 caracteres) → todas as sessões são encerradas → login com o aviso "Senha alterada". Link vencido ou já usado volta para pedir outro. Testes: contratos (4), `scripts/smoke-pages.mjs` (rotas e redirecionamentos) e `scripts/e2e-reset-password.mjs` (Chrome real + Mailpit; cria e apaga uma conta de teste).
- [ ] **Para testar à mão:** em `/login` clique em "Esqueci minha senha", use o e-mail de uma conta existente, abra o Mailpit (http://127.0.0.1:54324), clique no botão do e-mail e escolha a nova senha. Use **o mesmo navegador** em que pediu o link e acesse por `localhost:3000` (o código do link só vale no navegador de origem).
- [ ] **Configuração local mudou** (`supabase/config.toml`): `site_url = http://localhost:3000`, redirecionamentos permitidos para `/auth/callback`, limite local de 30 e-mails por hora e e-mails em português (`supabase/templates/`). Depois de baixar essa mudança é preciso reiniciar o Supabase local (`npx supabase stop` e `npx supabase start`); o banco não é apagado.
- [ ] **Em hospedagem real** (ver `docs/15`): definir `NEXT_PUBLIC_SITE_URL`; no painel do Supabase, em Authentication > URL Configuration, pôr o endereço do painel em Site URL e `https://seu-dominio/auth/callback` em Redirect URLs; colar os textos de `supabase/templates/*.html` em Email Templates; configurar SMTP próprio (o servidor de e-mail padrão do Supabase tem limite baixo e não serve para produção); revisar o limite de envios em Authentication > Rate Limits.
- [ ] O pedido de redefinição não mostra erro de limite de envios (para não revelar nada); se o e-mail não chegar, a pessoa tenta de novo mais tarde. Sem monitoramento de falhas de envio.
- [ ] A senha só é trocada por quem abre o link no mesmo navegador do pedido (padrão PKCE). Abrir o link no celular depois de pedir no computador leva à tela "link venceu ou já foi usado".
- [ ] Contas que já fizeram ações auditadas não podem ser apagadas (a auditoria referencia a conta e agora é imutável); a rotina de exclusão de dados (LGPD) precisa de decisão de anonimização.

## Documentação e largura das telas (2026-10-21)
- [x] `docs/02-arquitetura.md` (seção de fotos e diagrama), `docs/01-prd.md` (o que entrou depois do MVP) e `docs/features/F2-desafios.md` (numeração das histórias) atualizados para refletir o que foi implementado.
- [x] Telas de gestão e de dados (financeiro, saúde, graduação, painel, currículos, avaliações, feed, desafios, turmas…) que fixavam 720 a 900 px agora usam 960 px dentro do shell. Formulários e listas curtas (420 a 640 px) ficam estreitos de propósito. Termos e a página de diários da plataforma, fora do shell, não mudaram.
