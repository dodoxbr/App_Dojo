# Referência: faixas e idades (NÃO oficial)

**Fonte indicada pelo dono do produto (2026-10-20):** https://www.meukimono.com.br/faixas-do-jiu-jitsu-guia-completo-atualizado-e-otimizado-2026

**Status:** material de consulta. É um **blog**, não a norma de uma federação. **Nenhuma regra do sistema é carregada a partir dele**: cada academia cadastra as suas (US-010). O sistema usa esta página apenas para (a) **sugestões de nome de faixa** no preenchimento (texto livre continua permitido) e (b) apoio quando a academia decidir criar critérios de idade (que exigem data de nascimento e o fluxo de menores, US-013).

## O que a página afirma (transcrito, sem validação)
**Faixas adultas:** Branca, Azul, Roxa, Marrom, Preta (e, além da preta, coral, vermelha e branca, vermelha).
| Faixa | Idade mínima | Tempo citado |
|---|---|---|
| Azul | 16 | médio: 1,5 a 2 anos · "IBJJF": mínimo 2 anos |
| Roxa | 16 | médio: cerca de 2 anos · "IBJJF": 1,5 a 2 anos |
| Marrom | 18 | médio: cerca de 1,5 ano · "IBJJF": mínimo 1 ano |
| Preta | 19 | 1º grau após 3 anos |
| Coral (7º grau) | 50 | — |
| Vermelha e branca (8º grau) | 57 | — |
| Vermelha (9º grau) | 67 | — |

**Faixas infantis (ordem):** Branca; Cinza e Branca; Cinza; Cinza e Preta; Amarela e Branca; Amarela; Amarela e Preta; Laranja e Branca; Laranja; Laranja e Preta; Verde e Branca; Verde; Verde e Preta. Idades mínimas citadas: amarela 7, laranja 10, verde 13; o grupo infantil vai "até 15 anos"; aos 16 a transição para azul (verde pode ir para azul ou roxa por critério do professor).

**Graus:** até 4 graus até a marrom; na preta, intervalos entre graus citados (1º após 3 anos; 2º e 3º +3; 4º a 6º +5; 7º e 8º +7; 9º +10); 10º grau "exclusivo dos pioneiros".

## Limites e inconsistências da fonte (por isso não é regra do sistema)
- Traz **dois conjuntos de tempos** (médio e "IBJJF") e não diz qual vale quando conflitam.
- **Não cita documento ou número de regra** da IBJJF; não fala de CBJJ nem de outras federações.
- **Não dá a faixa etária de cada faixa infantil**, só alguns mínimos.
- O próprio texto afirma que, até a marrom, o critério dos graus é **do professor**; e que critérios podem variar por academia.
- A soma dos intervalos de grau na preta não bate com a frase "mais de 30 anos" do texto.
- Sem tempo mínimo para faixa branca ou, em parte do texto, para branca/azul de 16–17 anos.

## Como o sistema usa isto
- `packages/contracts/src/belts.ts`: **sugestões de nome** (adulto e infantil) exibidas como lista de apoio nos campos de faixa. A pessoa pode digitar qualquer outro nome.
- Nenhuma idade, tempo ou grau é imposto. Se a academia quiser critério de idade, será um novo tipo de critério na US-013 (depende de data de nascimento, responsável e proteção reforçada de menores).
