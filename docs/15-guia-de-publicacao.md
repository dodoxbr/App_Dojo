# Guia de publicação — do teste à hospedagem

> **Estado:** guia de trabalho. Os passos vêm da documentação oficial do Supabase e da Vercel e do que o projeto já faz, mas **nada disto foi executado em um projeto hospedado ainda**. Preços e limites mudam: confira nas páginas oficiais antes de contratar (links no fim). Quando um passo falhar, anote a mensagem e ajustamos este guia.

## 1. Onde hospedar (recomendação)

| Peça | Recomendação | Por quê | Custo de referência (confirmar) |
|---|---|---|---|
| Banco, login e regras de acesso | **Supabase**, projeto na região **América do Sul (São Paulo, `sa-east-1`)** | É o que o projeto já usa (Postgres + RLS + login). Dados no Brasil e menor latência | Plano **Pro: US$ 25/mês** (inclui crédito que cobre uma máquina "Micro"); **Free: US$ 0** |
| Painel web (Next.js) | **Vercel**, plano **Pro** | Next.js sem configuração; a plataforma é comercial e o plano gratuito (Hobby) **não permite uso comercial** | **US$ 20/mês** por pessoa que publica |
| E-mails (confirmação de conta) | Serviço de e-mail próprio via **SMTP** (por exemplo Resend, Amazon SES, Brevo) | O e-mail embutido do Supabase é limitado a **2 por hora** e só para teste | Costuma ter faixa gratuita |
| Domínio | `.com.br` no Registro.br | Endereço próprio e e-mails com seu domínio | cerca de R$ 40/ano |
| App do celular | **Depois** (Expo/EAS) | Hoje só existe login e perfil | — |

**Em resumo:** para a academia usar de verdade, conte com algo na casa de **US$ 45 a 55 por mês** (Supabase Pro + Vercel Pro) mais o domínio. Para **testar** sozinho ou com poucas pessoas, dá para começar de graça: Supabase Free + Vercel Hobby (somente enquanto for teste pessoal, sem cobrar ninguém).

**Por que não Supabase Free em produção:** o projeto é **pausado após 1 semana sem uso**, o banco é limitado a 500 MB, não há backups gerenciados nem recuperação a um ponto no tempo (isso é dos planos pagos) e o e-mail embutido não serve para ninguém real.

**Alternativas ao Vercel:** qualquer hospedagem que rode Node 20+ serve (Railway, Render, Fly.io, uma VPS com Docker, Cloudflare). São mais baratas ou flexíveis, mas **você opera** o servidor (atualizações, reinício, certificado). O Vercel é a opção de menor esforço.

**Custo do feed de fotos:** as fotos ficam no banco (ADR-022). Com 20 fotos por dia o crescimento é de cerca de 100 MB por mês; o Pro traz 8 GB de disco. As fotos são apagadas em 30 dias.

## 2. Três ambientes

1. **Local** (já existe): `npm run db:start` + `npm run dev -w @dojo/admin`. Dados de teste, e-mails no Mailpit.
2. **Teste na internet ("staging")**: um projeto Supabase **só para testes** + um projeto Vercel. Aqui você e o mestre testam no celular e no navegador, com dados falsos. **Pode ser gratuito.**
3. **Produção**: outro projeto Supabase (Pro) + o projeto Vercel de produção. **Nunca** misture: nenhuma conta ou dado de teste entra na produção.

Regra de ouro: toda mudança de banco passa por **staging primeiro**, depois produção. Nunca edite uma migração que já foi aplicada; crie uma nova.

## 3. Passo a passo do ambiente de teste (staging)

### 3.1 Contas
- Crie conta no **Supabase** e no **Vercel** (pode entrar com o GitHub). O código já está em `github.com/dodoxbr/App_Dojo`.
- Guarde senhas em um gerenciador de senhas. **Nunca** cole chaves secretas em conversa ou arquivo do projeto.

### 3.2 Projeto Supabase de teste
1. No painel: **New project** → nome `dojo-staging` → **Region: South America (São Paulo)** → defina uma **senha forte do banco** (guarde-a).
2. Em **Project Settings → API**, anote: **Project URL** e a chave pública (**anon / publishable key**). **Não use nem copie a chave `service_role`** em nenhum lugar do app.
3. No seu computador, na pasta do projeto:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>   # o ref está na URL do painel; pede a senha do banco
   npx supabase db push --dry-run                       # mostra o que será aplicado, sem aplicar
   npx supabase db push                                 # aplica as migrações 001 a 028
   ```
   (Nunca use `db reset --linked` em produção: apaga o banco.)
4. Confira no painel: **Database → Extensions** deve mostrar **pg_cron** habilitado (a migração 026 o habilita; se não estiver, ative em **Integrations → Cron**). Em **Integrations → Cron → Jobs** devem existir `auto-charges` e `purge-feed`.
5. Em **Authentication**:
   - **URL Configuration**: *Site URL* = o endereço do painel de teste (passo 3.3); em *Redirect URLs* acrescente o mesmo endereço.
   - **Sign In / Providers → Email**: confirmação de e-mail **ligada**; tamanho mínimo da senha **8**. (As configurações do arquivo `supabase/config.toml` valem só para o ambiente local: no painel você ajusta à mão.)
   - **SMTP Settings**: ative o SMTP próprio (veja 3.5). Sem isso, só 2 e-mails por hora saem.
6. Rode o verificador de pré-lançamento (4º passo da seção 5) para ver o estado do banco.

### 3.3 Projeto Vercel de teste
1. **Add New → Project** → importe `dodoxbr/App_Dojo`.
2. **Root Directory:** `apps/admin`. Marque a opção de **incluir arquivos fora do Root Directory** (o painel usa o pacote `packages/contracts`). Framework: Next.js (detecta sozinho). Instalação: `npm install` na raiz.
3. **Environment Variables** (Production e Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL do passo 3.2
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave pública (anon/publishable)
   - `PLATFORM_LEGAL_NAME` e `PLATFORM_CNPJ` = empresa que opera a plataforma (pode ficar vazio no teste: os termos mostram "a definir")
4. **Deploy.** Abra o endereço `*.vercel.app` gerado, volte ao Supabase (3.2, item 5) e coloque esse endereço como *Site URL*.
5. Região das funções: escolha uma próxima de São Paulo nas configurações do projeto Vercel (confira as regiões disponíveis).

### 3.4 Primeiro acesso (super admin) no ambiente hospedado
Os scripts `make-platform-admin` e `set-admin-diary-access` só funcionam no banco local (usam Docker). No ambiente hospedado use o **SQL Editor** do Supabase:
1. Crie sua conta pelo painel web (cadastro + e-mail de confirmação).
2. No SQL Editor, rode (troque o e-mail):
   ```sql
   insert into public.platform_admins (user_id)
     select id from auth.users where lower(email) = lower('seu-email@exemplo.com') on conflict do nothing;
   ```
3. **Acesso do super admin aos diários:** em teste pode ficar ligado; **em produção, desligue**:
   ```sql
   update public.platform_settings set admin_diary_access = false;
   ```
   Atenção: o padrão do banco é **ligado**, então todo ambiente novo precisa deste comando.

### 3.5 E-mail (SMTP)
1. Escolha um provedor (Resend, Amazon SES, Brevo...). Crie a conta e **verifique o seu domínio** (registros DNS SPF e DKIM, que o provedor indica).
2. No Supabase: **Authentication → SMTP Settings** → preencha servidor, porta, usuário, senha e o remetente (`nao-responda@seudominio.com.br`).
3. **Desligue o rastreamento de links** do provedor: ele pode alterar o link de confirmação e quebrar o cadastro.
4. Teste: crie uma conta nova no painel e veja se o e-mail chega (confira o spam).

### 3.6 Testar
Siga `docs/16-roteiro-de-testes.md` no endereço de teste, no computador **e no celular**. Os scripts automáticos (`scripts/smoke-*.mjs`) **recusam** rodar fora do Supabase local de propósito, para nunca criar dados de teste em ambiente real.

## 4. Produção

Só depois de o roteiro de testes passar em staging **e** de resolver as pendências marcadas "antes de gente real" (seção 6).

1. Novo projeto Supabase `dojo-producao` (plano **Pro**, região São Paulo). Repita 3.2 (link, `db push`, extensões, autenticação, SMTP).
2. **Backups:** no Pro há backups diários (retenção curta); a recuperação a um ponto no tempo é um complemento pago. Defina uma rotina extra: exportar o banco periodicamente (`pg_dump`) para um lugar seu, e **teste restaurar** uma vez.
3. Vercel: novo projeto (ou o mesmo com variáveis de *Production* diferentes) apontando para o Supabase de produção. Domínio próprio em **Settings → Domains**; ajuste os registros DNS no Registro.br; HTTPS é automático.
4. Supabase **Site URL** e *Redirect URLs* = o domínio de produção.
5. Crie seu usuário super admin (3.4), **desligue** o acesso aos diários e conceda a primeira academia pelo painel (`/plataforma`).
6. Rode `scripts/prelaunch-check.sql` e leve **tudo para OK**.
7. **Piloto:** comece com **uma academia** e um grupo pequeno. Acompanhe os logs do Supabase e da Vercel nos primeiros dias.

## 5. Verificador de pré-lançamento
Arquivo `scripts/prelaunch-check.sql` (somente leitura). Cole no SQL Editor do ambiente e execute. Ele confere: RLS em todas as tabelas, acessos do anônimo, acesso do super admin aos diários, quem são os super admins, tarefas agendadas, contas de exemplo e quais versões dos termos foram aceitas. Cada linha diz **OK** ou **ATENCAO**.

## 6. Antes de gente real (bloqueios)
- [ ] **Termos e política de privacidade revisados por advogado** (hoje são rascunho). Dados da empresa e canal de atendimento preenchidos. Incluir o tratamento de dados de **crianças**, **saúde** e **fotos/Instagram**.
- [ ] Decidir a base legal e o prazo de guarda; avaliar um **relatório de impacto** (RIPD) por tratar dados de menores e de saúde.
- [ ] Contratos/termos de tratamento de dados com os fornecedores (Supabase, Vercel, SMTP).
- [ ] Super admin **sem** acesso aos diários (`admin_diary_access = false`) e sem contas de exemplo.
- [ ] `pg_cron` ativo (geração automática de mensalidades e limpeza das fotos).
- [ ] Backup exportado e **restauração testada**.
- [ ] Roteiro de testes completo, no celular, com pelo menos um adulto, um professor, um gestor e um responsável com menor.
- [ ] Plano para incidentes: quem avisa os titulares e a autoridade se houver vazamento.
- [ ] Repositório do GitHub **privado** (hoje está público) e nenhum segredo no histórico (o CI roda a varredura de segredos).

## 7. Mudanças depois de publicado
- Alteração de banco = **nova migração** (nunca editar as antigas), testada no local, aplicada em staging (`db push --dry-run`, depois `db push`) e só então em produção.
- Cada commit passa pelo CI do GitHub (lint, testes, banco, telas, segredos). Não publique com o CI vermelho.
- O app só tem a chave pública (anon). A `service_role` nunca vai para o painel, para o celular nem para o repositório.

## Fontes consultadas
- Supabase — preços: https://supabase.com/pricing
- Supabase — regiões: https://supabase.com/docs/guides/platform/regions
- Supabase — Cron (habilitar o pg_cron): https://supabase.com/docs/guides/cron/install
- Supabase — migrações e `db push`: https://supabase.com/docs/guides/local-development/database-migrations
- Supabase — e-mail próprio (SMTP) e limites: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase — lista de verificação de produção: https://supabase.com/docs/guides/deployment/going-into-prod
- Vercel — preços e planos: https://vercel.com/pricing e https://vercel.com/docs/plans/hobby
- Vercel — monorepos: https://vercel.com/docs/monorepos
