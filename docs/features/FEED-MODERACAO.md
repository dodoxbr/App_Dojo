# Feed: moderação pelo professor e termo de imagem assinado

**Decisões do dono do produto (2026-10-22):** o professor é sempre moderador ("como já faz na academia": respeito vem primeiro, sem zoeira); foto com criança só aparece depois que o professor ou o gestor aprova; o responsável pode postar fotos do próprio menor; e só se posta foto de menor com o **termo de uso de imagem assinado** pelo responsável.

## Regras
- **Quem modera:** gestor e instrutor aprovado da academia (`is_feed_moderator`): aprovam, recusam, escondem, devolvem e apagam fotos e comentários.
- **Estados da foto:** `visible`, `hidden` (denunciada), `pending` (aguarda aprovação), `rejected` (recusada, com motivo; some em 3 dias).
- **Quando fica pendente:** foto que mostra criança ou adolescente, e foto postada por responsável. Gestor e instrutor publicam direto. Quem vê a pendente: o autor e os moderadores.
- **Responsável posta:** só com o próprio menor marcado, em academia onde o menor tem matrícula aprovada, o documento foi conferido e o termo de imagem está assinado.
- **Termo assinado:** nome completo digitado pelo responsável legal + data + versão do texto (`rascunho-2026-12`). Ao pedir a vaga (se autorizar fotos) ou depois, na tela do menor. O gestor vê quem assinou em Menores e responsáveis. O texto é **rascunho** (`/termo-de-imagem`) até a revisão jurídica.
- **Respeito:** aviso fixo no feed e no envio de foto; a legenda também passa pela moderação.

## Telas
- Feed: botão **Postar foto** (no lugar de Medalhas) abre `/feed/{academia}/postar`; fila "Aguardando aprovação" para quem modera; card "Fotos a aprovar" no início da equipe.
- Responsável: `/dependentes/{menor}/postar` e botão no acompanhamento do menor.

## Banco e testes
Migrations 038 (moderação) e 039 (assinatura). pgTAP: `feed_moderation.test.sql` (24), `photo_term.test.sql` (11); `feed.test.sql` e `feed_guardian.test.sql` ajustados (foto com menor agora precisa de aprovação).

## Pendências
Aprovar **todas** as fotos por opção da academia; notificação ao professor; moderação de comentários pelo professor no app; revisão jurídica do termo.

## Declarações no cadastro (2026-10-22)
"A autorização fica nos termos onde ele declara que leu e autorizou, declaração de saúde também; ao cadastrar, nem que ele leia e marque." No **cadastro** (painel e app) a pessoa lê e marca: os termos de uso e a privacidade (já era), a **declaração de saúde** (obrigatória) e a **autorização de imagem no feed** (opcional). Textos públicos em `/declaracao-de-saude` e `/termo-de-imagem` (rascunho, em revisão jurídica). Cada marca guarda a data e a versão (`terms_acceptances`).
- Só quem autorizou a imagem pode ser marcado numa foto (quem posta pode marcar a si mesmo). Em **Perfil > Declarações e autorizações** dá para autorizar ou revogar depois (contas antigas também declaram a saúde ali); revogar tira do feed as fotos em que a pessoa está marcada.
- Menor: o responsável marca a declaração de saúde do menor ao pedir a vaga (obrigatória no formulário) e assina o termo de imagem do menor (nome completo).
- Banco: migrations 040 (versão inicial, por academia) e 041 (no cadastro; substitui a 040); pgTAP `adult_image_consent.test.sql` (14).
