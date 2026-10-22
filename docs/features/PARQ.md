# PAR-Q e termo de responsabilidade de saúde

**Pedido do dono do produto (2026-10-22):** questionário PAR-Q + termo de saúde assinado, com validade de 12 meses.

## Fluxo (3 telas, `/parq` e `/dependentes/{menor}/parq`)
1. **Questionário:** 7 perguntas de sim/não (texto de referência do PAR-Q padrão). Só avança quando todas estão respondidas. Qualquer "sim" abre um aviso: será preciso apresentar **atestado médico físico**; dá para salvar mesmo assim.
2. **Termo de responsabilidade de saúde:** texto com rolagem. A caixa "Declaro que li e concordo…" só libera depois de rolar até o fim; "Avançar" só ativa com o fim lido **e** a caixa marcada.
3. **Assinatura desenhada:** área para assinar com o dedo ou o mouse; "Limpar" e "Confirmar assinatura" (só ativa com traço).
O menor é respondido pelo **responsável legal**. Validade: 12 meses (depois, vence e pede de novo).

## O que fica guardado (por resposta)
Respostas e observação (dado de saúde, privado), assinatura em PNG, **hora do banco**, quem assinou (conta autenticada), versão do texto e **hash SHA-256 do texto do termo** (prova qual texto foi aceito), **IP** e **navegador** informados pelo servidor do painel. A auditoria guarda só o resultado (nunca respostas nem assinatura). Quem lê: a própria pessoa, o responsável, e quem tem a permissão de ver saúde (gestor, instrutor com `view_health`); abrir as respostas é registrado.

## Atestado
"Sim" em qualquer pergunta = **atestado médico pendente** até o gestor/professor marcar que conferiu (`mark_medical_certificate`, auditado). A situação aparece em Saúde (tabela "PAR-Q dos alunos") e no aviso do início do aluno. **Nada é bloqueado** por enquanto (só informa).

## Validade jurídica (resumo honesto; não é parecer jurídico)
- **Data e hora:** vêm do **banco** (`clock_timestamp()`), não do aparelho, que o usuário pode alterar.
- **IP e aparelho:** o servidor do painel lê `x-forwarded-for` e `user-agent` da requisição e grava com a assinatura. Em produção, atrás de um proxy/hospedagem, o IP real vem do cabeçalho do proxy; em desenvolvimento aparece `::1` (a própria máquina). Não há "ID do aparelho" confiável no navegador; o navegador/`user-agent` é só um indício. No app (Expo), o ID do aparelho exigiria biblioteca própria e o consentimento do usuário.
- **Identidade:** a conta autenticada (e-mail confirmado + senha) é quem assina; o responsável assina pelo menor.
- **ICP-Brasil:** o que existe aqui é **assinatura eletrônica simples** (Lei 14.063/2020 e MP 2.200-2/2001 admitem outras formas além da ICP-Brasil, desde que as partes aceitem). Assinatura **qualificada** (certificado ICP-Brasil, ex.: Gov.br avançada ou certificado A1/A3) exigiria um provedor de assinatura (custo e integração). Para termo de saúde de academia, a assinatura simples com evidências costuma ser o praticado, **mas isso é questão para o advogado**.
- **LGPD:** respostas de saúde são **dado pessoal sensível** (art. 11): finalidade estrita (segurança no treino), acesso mínimo, consulta registrada, consentimento específico e em destaque (menor: pelo responsável). Definir com o jurídico: prazo de guarda das assinaturas/evidências, pedido de exclusão e base legal da guarda do termo.

## Telas
`/parq` (aluno) · `/dependentes/{menor}/parq` (responsável) · Saúde da academia: tabela do PAR-Q + `/academia/{id}/saude/parq/{aluno}` (respostas, assinatura, evidências, "Conferi o atestado").

## Banco e testes
Migrations 042 a 044. pgTAP `parq.test.sql` (22). Contratos `parq.test.ts`. Conferido no navegador (fluxo completo, botões que só ativam no momento certo, modal de atestado, evidências).

## Pendências
Ver `docs/11-pendencias.md` (regras do DF não validadas, bloqueio de agendamento, 70+ anos, app Expo, retenção).
