# Lacunas a validar com a academia piloto

- [ ] Nome do produto e identidade visual própria.
- [ ] Regras oficiais da academia para faixa/grau e exigências técnicas.
- [ ] Currículo da planilha revisado pelo mestre; permissões de reprodução.
- [x] Quem pode criar academias e quem se torna gestor inicial: o super admin libera usuários; quem cria vira gestor (decisão do dono do produto, `docs/00`).
- [ ] Instrutor pode aprovar filiação? O gestor cadastra colaboradores e alunos; falta definir se o instrutor também aprova (hoje fora do catálogo de permissões).
- [ ] Aluno sem filiação pode registrar treinos pessoais? Proposta: sim.
- [ ] Quais dados são necessários para menores e responsável?
- [ ] Privacidade de fotos e duração de armazenamento.
- [ ] Check-in apenas manual inicialmente ou QR no MVP?
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
