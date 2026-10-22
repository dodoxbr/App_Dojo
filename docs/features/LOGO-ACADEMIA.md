# Logo e perfil da academia (banner)

**Objetivo:** cada academia tem uma logo que vira o fundo (ampliada e desfocada) e o selo redondo do perfil da academia, como nos perfis de clubes de sites de campeonatos.

- **Quem troca:** gestor da academia (ou super admin), em `/academia/{id}` > "Logo da academia". Envia JPG, PNG ou WebP até 5 MB; o servidor regrava em WebP (até 900 px, sem metadados) e o banco confere quem pode.
- **Onde aparece:** perfil da academia (`/academia/{id}`), início da equipe (`/academia/{id}/inicio`) e link de entrada dos alunos (`/entrar/{slug}`). Sem logo, aparece a inicial da academia sobre o fundo da marca.
- **Banco:** tabela `academy_logos` (sem política de leitura), funções `set_academy_logo`, `remove_academy_logo` (gestor ou super admin, auditadas como `academy.logo`) e `academy_logo` / `academy_logo_version` (leitura pública: a logo é identidade pública da academia). Mesma abordagem do feed (ADR-022), sem serviço novo.
- **Testes:** pgTAP `academy_logo.test.sql` (12), conferência em navegador (envio, leitura, remoção).
- **Pendências:** a logo ainda não aparece no menu lateral, nos e-mails nem no app do aluno; a academia não tem cidade/estado para o subtítulo do banner.
