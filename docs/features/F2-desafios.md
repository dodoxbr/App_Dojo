# Proposta F2 — Desafios da academia (estilo "Gymrats")

**Status:** proposta registrada em 2026-10-20 a pedido do dono do produto. **Ainda não implementada.** Entra no backlog depois da US-012 (painel) e da US-013 (menores), porque envolve ranking entre pessoas e não pode incluir crianças antes do fluxo de responsáveis.

## Ideia
Desafios entre os alunos de uma academia, com pontuação e ranking, para estimular frequência e prática: **desafios de treino** (assiduidade, sequência semanal, treinos extras) e **desafios de golpes** (praticar uma técnica, repetições, avançar na trilha). Inspiração: apps de desafio em grupo, mas dentro das regras do produto (academia como fronteira, diário privado, presença só validada).

## Princípios (herdados do projeto)
1. **Opt-in.** Entrar num desafio é uma escolha do aluno; sair é possível a qualquer momento e remove a pessoa do ranking.
2. **Diário continua privado.** Desafio não lê o diário. Registros de desafio são objetos próprios; o aluno decide o que informa.
3. **Fonte verificável.** Presença validada (US-008) e domínio validado (US-009) pontuam automaticamente. Registros informados pelo próprio aluno (treino extra, repetições de golpe) ficam como **não verificados** até um professor/gestor confirmar, e a pontuação mostra a diferença.
4. **Regras dos pontos são da academia.** Nenhum valor padrão: quem cria define período, tipo e pontos (como nas regras de graduação).
5. **Ranking só entre participantes** (e o gestor). Mostra nome de exibição e pontos; nunca anotações, e-mail ou dados de menores.
6. **Crianças só depois da US-013** (responsável, consentimento e proteção reforçada). Sem fotos nesta fase (Storage privado e moderação ficam para depois).
7. **Tudo no servidor:** entradas idempotentes, auditoria, sem escrita direta (como o resto do sistema).

## Possível divisão em histórias
| ID | História | Observação |
|---|---|---|
| US-014 | Desafios automáticos (presença validada e sequência semanal) + participação opt-in + ranking | Não exige digitação do aluno; pontua pelo que já é verificado |
| US-015 | Desafios de treino e de golpes com registro do aluno e verificação pelo professor | Introduz "entrada não verificada" vs "verificada" |
| US-016 | Reações/comentários moderados, medalhas e histórico de desafios | Só depois de moderação definida (F4 de `docs/10`) |

## Decisões que preciso de você (com a minha sugestão)
1. **Quem cria desafios?** Sugestão: gestor, e instrutor se o gestor liberar uma nova permissão `manage_challenges` (mesma matriz das outras).
2. **O ranking aparece completo ou só o topo?** Sugestão: o aluno vê o próprio lugar e o topo; o gestor vê todos.
3. **Registros do aluno (treino extra, repetições) valem pontos antes de confirmados?** Sugestão: contam, mas marcados como "não verificados"; o gestor escolhe, por desafio, se só contam os verificados.
4. **Premiação/medalha:** apenas símbolo dentro do app (sem valor financeiro) no início?
