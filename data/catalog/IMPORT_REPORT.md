# Relatório da importação do catálogo (US-005)

Gerado por `scripts/catalog/generate_seed.py`. Origem: `Plano de Treino_Básico ao Avançado.xlsx` (abas Básico, Intermediário, Avançado).
Revisão declarada pelo dono do produto em 2026-10-20. Abas ocultas e `Material de Estudo` **não** foram importadas.

## Totais
- Linhas extraídas: **151**
- Técnicas únicas no catálogo global: **131**
- Técnicas que aparecem em mais de um nível (nome e categoria idênticos): **10**

## Nomes iguais em categorias diferentes (mantidos como técnicas distintas)
- ArmLock: Ataques na Guarda; Ataques na Montada
- Chave de Braço Invertida: Ataques Laterais (100KG); Ataques na Guarda
- Meia Guarda: Passagem de Guarda; Raspagens
- Triangulo: Ataques Laterais (100KG); Ataques na Guarda

## Grafias parecidas, NÃO fundidas (revisar com o mestre)

| Semelhança | Nome A | Categoria A | Nome B | Categoria B |
|---|---|---|---|---|
| 0.92 | Estrangulamento Lapela | Ataques Laterais (100KG) | Estrangulamento com Lapela | Ataques Laterais (100KG) |
| 0.91 | Estrangulamento de Polegar | Ataques na Montada | Estrangulamento com Polegar | Ataques na Montada |

## Observações sobre a origem
- O número 45 aparece duas vezes em `Quedas` nas abas Básico e Intermediário; o número original é mantido em `technique_sources.source_number`.
- Na aba Avançado o bloco `Chaves Membros Inferiores` é numerado de 90 a 94 (a numeração salta de 54 para 90).
- Nomes foram importados como escritos (apenas espaços normalizados). Erros de digitação aparentes (por exemplo `Pluso`, `Estragulamento`, `Armlok`) devem ser corrigidos por edição, não pela importação.
- A marca `x` e a contagem `Acertos` da planilha são controles de avaliação e não foram importadas.
- A faixa citada em cada aba (BRANCA, AZUL, ROXA) fica na proveniência (`belt`); não foi interpretada como regra de graduação.
