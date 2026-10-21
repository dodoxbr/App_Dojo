# Roteiro de testes manuais (uso real no navegador)

Os testes automáticos conferem regras, permissões e se as telas **abrem**. Eles **não** clicam, não olham o visual e não testam o celular. Este roteiro cobre isso. Siga na ordem; cada passo diz o que **esperar**. Marque `[x]` e anote qualquer diferença (veja "Como relatar" no fim).

> Só use **dados de teste**. Não cadastre pessoas reais, CPFs ou fotos de verdade de crianças.

## 0. Preparar o ambiente local

Pré-requisitos já instalados: Node.js, Git, **Docker Desktop (aberto e rodando)**, VS Code.

```bash
npm install
npm run db:start            # sobe o Supabase local (a primeira vez baixa imagens; demora)
npx supabase status         # mostre as chaves: copie a "anon key" (chave publicável) e a API URL
```
Crie o arquivo `apps/admin/.env.local` com:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cole a anon key>
```
Zerar o banco quando quiser recomeçar (apaga tudo do ambiente LOCAL): `npm run db:reset`.

Iniciar o painel: `npm run dev -w @dojo/admin` → abra **http://localhost:3000**.
Os e-mails de confirmação **não saem de verdade**: abra o **Mailpit em http://127.0.0.1:54324** e clique no link de cada e-mail.

Dica: use **janelas anônimas diferentes** (ou navegadores diferentes) para ficar logado como várias pessoas ao mesmo tempo.

## 1. Pessoas do teste

| Papel | E-mail sugerido | Data de nascimento |
|---|---|---|
| Dono da plataforma (super admin) | dono@teste.local | 01/01/1980 |
| Mestre (gestor da academia) | mestre@teste.local | 01/01/1975 |
| Professor | professor@teste.local | 01/01/1985 |
| Aluno adulto 1 | aluno1@teste.local | 01/01/1990 |
| Aluno adulto 2 | aluno2@teste.local | 01/01/1992 |
| Responsável (mãe) | mae@teste.local | 01/01/1984 |
| Responsável financeiro (tio) | tio@teste.local | 01/01/1982 |
| Outro gestor (outra academia) | outro@teste.local | 01/01/1978 |

Senha de todos: uma de 8+ caracteres, só de teste.

## 2. Conta, termos e ficha
- [ ] **Cadastro.** Em `/login`, "Criar conta" como **dono**. Esperado: pede nome, data de nascimento, e-mail, senha e o aceite dos termos. Sem marcar os termos, não deixa cadastrar.
- [ ] **Termos.** Clique em "termos de uso e a política de privacidade". Esperado: página pública com aviso de **rascunho**, e falando de **fotos, Instagram, remoção, crianças e saúde**. Os dados da empresa aparecem como "a definir".
- [ ] **Confirmar e-mail** pelo Mailpit e entrar. Esperado: abre "Meu perfil".
- [ ] **Super admin.** No terminal: `node scripts/make-platform-admin.mjs dono@teste.local`. Recarregue o perfil. Esperado: aparece o atalho "Plataforma (super admin)".
- [ ] Repita o cadastro para **mestre, professor, aluno1, aluno2, mae, tio, outro** (a mãe pode marcar "Esta conta é para cuidar de um menor" e preencher nome e data de nascimento de um menor, por exemplo 9 anos atrás).
- [ ] **Ficha** (em "Minha ficha de cadastro"): preencha nome completo, telefone com DDD, CEP, endereço, **contato de emergência** e, em um aluno, uma **observação de saúde** marcando o consentimento. Esperado: salva; telefone e CEP aceitam máscara. Sem contato de emergência não salva.
- [ ] **Sem ficha, sem entrada.** Com uma conta sem ficha, abra o link da academia (passo 4) e tente pedir entrada. Esperado: avisa para preencher a ficha antes.

## 3. Plataforma e academia (dono e mestre)
- [ ] Como **dono**, em `/plataforma`, "Liberar criação de academias" para o e-mail do **mestre**. Esperado: aparece em "Criadores liberados".
- [ ] Como **mestre**, "Criar academia": nome, endereço (ex.: `academia-teste`), **razão social** e **CNPJ de teste `11.222.333/0001-81`**. Esperado: cria e abre a academia. Um CNPJ errado (ex.: `11.222.333/0001-80`) deve ser recusado.
- [ ] Abra `/termos/academia-teste`. Esperado: os termos mostram a razão social e o CNPJ da academia.
- [ ] Em "Identidade visual", troque as cores. Esperado: mostra o contraste e só deixa salvar se for legível.
- [ ] Em "O que o instrutor pode fazer": veja as 6 permissões (inclui **"Ver observações de saúde…"**, ligada por padrão). Ligue/desligue uma e confira que muda.
- [ ] Como **outro**, libere (pelo dono) e crie uma segunda academia. Esperado: ele **não** vê nada da primeira (tente colar o endereço de `/academia/<id>` da primeira: deve voltar para o perfil).

## 4. Entrada e membros
- [ ] Como **aluno1**, abra `/entrar/academia-teste` e "Solicitar entrada". Esperado: fica "pendente".
- [ ] Como **mestre**, em "Membros e pedidos de entrada": aprove o aluno1. Esperado: vira membro. Rejeite um pedido do aluno2 e depois peça de novo (ou use "Cadastrar aluno ou colaborador" pelo e-mail).
- [ ] Cadastre o **professor** como "colaborador/instrutor" pelo e-mail. Esperado: aparece como instrutor.
- [ ] Em Membros, ao lado de cada pessoa há "Ficha" e, para alunos, "Financeiro". Abra a ficha do aluno1. Esperado: nome, telefone, endereço, emergência e saúde; aparece o aviso de que a consulta foi registrada.

## 5. Turmas, aulas e presença
- [ ] Mestre: "Turmas e aulas" → "Nova turma" (instrutor = professor) → "Agendar aula" para daqui a pouco (hoje).
- [ ] Aluno1: "Agenda de aulas" → faz o **check-in**. Esperado: presença **"aguardando confirmação"** (não conta ainda).
- [ ] Professor: abre a aula → "Presenças": **confirma** a presença do aluno1. Esperado: passa a "validada". Também teste **revogar** com motivo.
- [ ] **QR:** na tela da aula do professor há o "QR de check-in". Com o celular, abra a URL do QR (rede local) e veja que o QR **não valida sozinho** (o professor ainda confirma).
- [ ] Na tela da aula, o professor vê **"Atenção à saúde"** com a observação do aluno e o contato de emergência. Desligue a permissão "ver observações de saúde" (passo 3) e recarregue: a seção **some**.

## 6. Técnicas, diário, currículo e graduação
- [ ] Aluno1: "Catálogo de técnicas": pesquise "tesoura". Abra uma técnica.
- [ ] Aluno1: "Meu diário" → registrar treino com técnicas. Esperado: aparece só para ele. Mestre e professor **não** veem o diário.
- [ ] Mestre: "Currículos" → crie um currículo e adicione técnicas. Aluno1: "Minha trilha": marque "estudei"/"praticando". Professor: "Avaliações de domínio": valide uma técnica. Esperado: aluno só **declara**; o professor **valida**.
- [ ] Mestre: "Graduação" → cadastre uma regra (tempo mínimo + critério manual). Registre uma graduação inicial para o aluno1 e veja a **recomendação** (o sistema só recomenda; quem concede é o mestre). Corrija uma graduação (retificar) e veja o histórico.
- [ ] Mestre: "Painel e indicadores". Esperado: números coerentes com o que você fez (grupos pequenos escondem dados de privacidade).

## 7. Desafios
- [ ] Aluno1 cria um desafio (mínimo 3 participantes). Aluno2, o professor e o mestre entram. Esperado: ao chegar em 3, **ativa**. Registre treinos e veja o **ranking**. Quem não participa não vê.

## 8. Menores e responsáveis
- [ ] **Mãe**: "Meus dependentes" → "Cadastrar um menor" (ou use o que preencheu no cadastro). Preencha a **ficha do menor**.
- [ ] Mãe: abra o link `/entrar/academia-teste` e "Pedir vaga para um menor": marque o consentimento, a autorização de **fotos** e a de **redes sociais (Instagram)**. Esperado: fica aguardando o gestor.
- [ ] Mestre: "Menores e responsáveis": marque "Conferi o documento do responsável pessoalmente" → "Confirmar conferência". Depois, em Membros, **aprove** o menor. Esperado: o menor aparece com "(menor · responsável conferido)". Sem a conferência, **não** aprova.
- [ ] Professor valida a presença do menor. Mãe, em "Meus dependentes", abre o menor: vê **presenças confirmadas, graduação e próximas aulas** (mas **não** o diário).
- [ ] Mãe gera o código do **responsável financeiro**. Tio entra em "Meus dependentes" e informa o código. Esperado: o tio vê o menor só na parte financeira; **não** vê presença nem graduação.
- [ ] Mãe **revoga o consentimento**. Esperado: o menor fica **suspenso** na hora. Peça nova vaga e confirme que precisa de **nova conferência** do mestre.

## 9. Financeiro (manual)
- [ ] Mestre: Financeiro → "Planos dos alunos": aluno1 R$ 150,00, vence dia 10; menor R$ 120,00 com **desconto** R$ 20,00 (motivo "irmãos"). Esperado: o desconto exige motivo.
- [ ] "Gerar cobranças do mês". Esperado: uma por aluno com plano ativo; clicar de novo **não duplica**. O menor mostra o responsável financeiro e o valor já descontado.
- [ ] "Marcar como pago" (PIX, hoje) em uma cobrança. Esperado: resumo do mês atualiza "Recebido". Teste **cancelar**, **isentar** e **reabrir** (todos pedem motivo) e veja o histórico no financeiro do aluno. Crie uma **cobrança avulsa**.
- [ ] Ligue a **geração automática**. (O agendador roda de madrugada; no local, o teste automático já cobre.)
- [ ] Aluno1 e mãe/tio abrem "Meu financeiro". Esperado: veem as cobranças; **não** conseguem marcar pagamento. Professor **não** vê o financeiro.

## 10. Feed de fotos
- [ ] Aluno1: "Feed da academia" → postar uma foto **tirada pelo celular, com localização ligada**. Legenda e marcação de pessoas. Esperado: aparece no feed.
- [ ] **Conferir os metadados:** baixe a foto do feed (botão direito → salvar imagem) e veja as propriedades/EXIF (Windows: botão direito → Propriedades → Detalhes). Esperado: **sem** localização GPS e sem modelo do celular.
- [ ] Marque o **menor** (com autorização de fotos). Esperado: posta. Tente marcar o menor **sem** autorização de fotos: o sistema **não deixa**. Marque "há criança" sem marcar ninguém: recusa.
- [ ] No post do menor, o autor/gestor vê o aviso se **pode ou não** ir para o Instagram (conforme a autorização de redes sociais).
- [ ] **Mãe**: "Ver o treino do (nome)" no menor. Esperado: vê **só** as fotos em que o filho aparece. O tio (financeiro) **não** vê.
- [ ] Aluno2 **denuncia** uma foto. Esperado: some para os outros; autor e mestre ainda veem; o mestre vê o motivo e "Devolve ao feed" ou apaga.
- [ ] Mãe revoga o consentimento: as fotos do menor **ficam ocultas** na hora.
- [ ] Apague uma foto como autor. Esperado: some de vez. (Aos 30 dias, a limpeza automática apaga as demais.)
- [ ] Alguém de **outra academia** (ex.: o gestor "outro") tenta abrir `/feed/<id da academia 1>`. Esperado: página não encontrada. O endereço de uma imagem do feed, aberto sem estar logado, redireciona para o login.

## 11. Privacidade e permissões (tente "furar")
- [ ] Aluno tenta abrir `/academia/<id>` e `/academia/<id>/financeiro`: volta para o perfil.
- [ ] Professor tenta `/academia/<id>/membros/<id-aluno>` (ficha): não consegue. Tenta o financeiro: não consegue.
- [ ] O super admin (dono) **não** vê o financeiro, a ficha, a saúde nem o feed da academia (só o que a página de plataforma mostra).
- [ ] Diário: mestre/professor não leem. O dono só lê se `node scripts/set-admin-diary-access.mjs on` (fase de teste). Confirme com `... status` e **desligue** com `off`.
- [ ] Menor sem consentimento ativo: não aparece em desafios nem no feed; não tem login.

## 12. Celular
Abra o painel no celular (mesma rede: `http://<IP-do-computador>:3000`, ou o endereço de teste na internet). Repita rapidamente: login, cadastro, ficha, check-in, postar foto, feed. Esperado: sem rolagem horizontal, botões e campos tocáveis, texto legível. Anote o que ficar ruim (o painel ainda **não tem layout**: é só funcional).

## 13. Antes de encerrar a rodada
- [ ] `node scripts/set-admin-diary-access.mjs status` (local) ou rode `scripts/prelaunch-check.sql` e leia as linhas **ATENCAO**.
- [ ] Rode os testes automáticos para garantir que nada quebrou: `npm run check` e `npm run db:test`.

## Como relatar um problema
Para cada diferença, anote em uma linha:
1. **Onde** (endereço da página) e **quem** estava logado (papel);
2. **O que fez** (passo a passo curto);
3. **O que esperava** e **o que aconteceu** (cole a mensagem na tela, se houver);
4. **Print** da tela, se ajudar. Não inclua senhas nem chaves.

Mande a lista e eu corrijo em ordem de gravidade (dado vazado ou permissão errada primeiro; depois fluxo quebrado; por último aparência).
