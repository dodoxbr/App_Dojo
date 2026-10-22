# Página pública da academia (/a/{slug})

**Objetivo:** cada academia tem uma página aberta, sem login, parecida com o perfil de um clube em rede social: logo em banner, apresentação, **grade de horários**, contato (WhatsApp e telefone), endereço com link do mapa e redes sociais. Quem gosta, toca em "Quero treinar aqui" (vai para o pedido de entrada em `/entrar/{slug}`).

- **Quem edita:** gestor da academia (ou super admin), em `/academia/{id}/pagina`. Só aparece ao público se o gestor marcar **Publicar**; por padrão fica oculta. Mesma resposta (404) para "não existe" e "não publicada".
- **O que cabe:** frase de apresentação, descrição, modalidades, WhatsApp e telefone com DDD, endereço (texto livre: rua, quadra, conjunto…), cidade e UF, link do mapa (https), Instagram e TikTok (usuário ou link), Facebook, YouTube e site (https), e a grade de horários em grupos (ex.: Adulto — Manhã, Infantil, Feminino) com linhas de dias da semana e horários (aceita 7h, 9h30, 07:00), rótulo e observação opcionais.
- **Só dados da empresa:** nada de aluno, menor ou saúde. A grade é divulgação: não cria turma, aula nem presença (isso continua em Turmas e aulas).
- **Banco:** `academy_profiles` (sem política de leitura), funções `get_academy_profile`, `save_academy_profile`, `save_academy_schedule` (gestor/super admin, auditadas) e `public_academy_page(slug)` (leitura pública só do publicado). Limites e formatos (telefone, https, usuário de rede, UF, horários, dias 1–7) conferidos no banco e em `packages/contracts/src/academy-page.ts`.
- **Testes:** pgTAP `academy_public_page.test.sql` (21); contratos `academy-page.test.ts`; conferência em navegador (edição, publicação, visitante sem login, celular).
- **Pendências:** pré-visualização antes de publicar; foto de capa própria (hoje o fundo é a logo desfocada); mostrar as turmas reais (Turmas e aulas) em vez da grade digitada; link curto/domínio próprio; SEO além do título e descrição.
