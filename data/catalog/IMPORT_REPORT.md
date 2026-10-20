# Relatório da importação do catálogo (US-005)

Gerado por `scripts/catalog/generate_seed.py`. Origem: `Plano de Treino_Básico ao Avançado.xlsx` (abas Básico, Intermediário, Avançado).
Revisão declarada pelo dono do produto em 2026-10-20. Abas ocultas e `Material de Estudo` **não** foram importadas.

## Totais
- Linhas extraídas: **151**
- Técnicas únicas no catálogo global: **131**
- Técnicas que aparecem em mais de um nível (nome e categoria idênticos): **10**
- Correções de digitação aplicadas: **18** (`name_corrections.csv`)
- Classificadas com tipo: **127**; com posição: **121** (de 131). Confiança: alta 84, baixa 4, média 43

## Correções de digitação aplicadas
O nome original continua em `technique_sources.raw_name`. As técnicas mantêm a revisão.

| Antes | Depois | Motivo |
|---|---|---|
| Pegada Cruzada no Pluso | Pegada Cruzada no Pulso | digitação: Pluso -> Pulso (a técnica irmã da aba Básico é 'Pegada Direta no Pulso') |
| Estragulamento Cruzado | Estrangulamento Cruzado | digitação: Estragulamento -> Estrangulamento |
| Estrang. Com Mão Invertida | Estrangulamento Com Mão Invertida | abreviação expandida |
| Estrang. Lapela Cruzando Braço | Estrangulamento Lapela Cruzando Braço | abreviação expandida |
| Estrang. Enrolando o Braço | Estrangulamento Enrolando o Braço | abreviação expandida |
| Triangulo | Triângulo | acentuação |
| ArmLock | Armlock | padronização de grafia (Armlock) |
| ArmLock | Armlock | padronização de grafia (Armlock) |
| Armlok Invertido | Armlock Invertido | digitação: Armlok -> Armlock |
| Arlock Mão nas Axilas | Armlock Mão nas Axilas | digitação: Arlock -> Armlock |
| Armlok Girando | Armlock Girando | digitação: Armlok -> Armlock |
| GravataTécnica | Gravata Técnica | espaço faltando |
| Tapa da Rosto | Tapa no Rosto | digitação: 'da' -> 'no' (a aba Avaliação usa 'Tapa no Rosto') |
| Pé na Virilia e Gancho | Pé na Virilha e Gancho | digitação: Virilia -> Virilha |
| Pés no Biceps | Pés no Bíceps | acentuação |
| Saida de Quadril | Saída de Quadril | acentuação |
| Tani Otochi | Tani Otoshi | digitação: grafia do golpe de judô é Tani Otoshi |
| O Soto Gari | Osoto Gari | grafia do golpe de judô (Osoto Gari); espaço indevido |

## Classificação (tipo e posição) — PROPOSTA, não validada

Preenchida a partir de fontes públicas, **sem validação do mestre** (`classification_status = 'proposed'`).
A categoria da planilha foi mantida. Regras e justificativa de cada linha em `classification.csv`.

Fontes consultadas:
- https://en.wikipedia.org/wiki/List_of_Brazilian_jiu-jitsu_techniques (classificação de quedas, finalizações, raspagens, posições)
- https://www.kingz.com/pages/jiu-jitsu-dictionary (Katagatame = arm triangle, Relógio = clock choke, Toreando, upa, shrimp, posições)
- https://bjjmore.com/brazilian-jiu-jitsu-submissions/ (estrangulamentos, chaves de braço/ombro e de perna; Baratoplata)

Limites: nenhuma fonte consultada traz os nomes em português do Brasil de todas as técnicas; os termos locais
(por exemplo `Barrigada`, `Mão de Vaca`, `Estrela`) ficam sem classificação ou só com a posição inferida da categoria.

## Para você confirmar (NÃO alterados)

| Categoria | Nome | Dúvida |
|---|---|---|
| Saídas de Baixo | Escrima e Capotada | 'Escrima' pode ser 'Esgrima' (esgrima = fencing). Confirmar a grafia antes de alterar. |
| Saídas de Baixo | Escrima e Passagem para as Costas | Mesma dúvida: 'Escrima' ou 'Esgrima'? |
| Saídas de Baixo | Saída com a Cabeça por Baixo da Axial | 'Axial' pode ser 'Axila'. Confirmar. |
| Ataques nas Costas | Cambalhota e pegada das | Nome termina em 'das' (parece incompleto na planilha). Qual é o nome completo? |
| Quedas | Oshi Gari | Não identifiquei golpe de judô com esse nome (talvez 'Osoto Gari' ou 'Ouchi Gari'). Confirmar. |
| Quedas | De Ashi Barai | Variante de 'De Ashi Harai'; mantida como está. |
| Ataques na Montada | Mão de Vaca no Ataque Duplo | Termo não identificado nas fontes públicas; tipo da técnica não classificado. |
| Saídas de Baixo | Barrigada | Termo não identificado nas fontes públicas; posição inferida só pelo contexto da categoria. |
| Passagem de Guarda | Estrela | Termo não identificado nas fontes públicas; mantida só como passagem de guarda. |
| Ataques nas Costas | Crucifixo | Pode ser posição de controle ou finalização; tipo não classificado. |
| Ataques nas Costas | Ataque com gancho por cima | Finalização não especificada; tipo não classificado. |
| Ataques nas Costas | Estrangulamento OSS | Termo 'OSS' mantido como na planilha. |

## Nomes iguais em categorias diferentes (mantidos como técnicas distintas)
- ArmLock: Ataques na Guarda; Ataques na Montada
- Chave de Braço Invertida: Ataques Laterais (100KG); Ataques na Guarda
- Meia Guarda: Passagem de Guarda; Raspagens
- Triangulo: Ataques Laterais (100KG); Ataques na Guarda

## Grafias parecidas, NÃO fundidas (revisar com o mestre)

| Semelhança | Nome A | Categoria A | Nome B | Categoria B |
|---|---|---|---|---|
| 0.95 | Tai Otoshi | Quedas | Tani Otoshi | Quedas |
| 0.92 | Estrangulamento Lapela | Ataques Laterais (100KG) | Estrangulamento com Lapela | Ataques Laterais (100KG) |
| 0.91 | Estrangulamento de Polegar | Ataques na Montada | Estrangulamento com Polegar | Ataques na Montada |

## Observações sobre a origem
- O número 45 aparece duas vezes em `Quedas` nas abas Básico e Intermediário; o número original é mantido em `technique_sources.source_number`.
- Na aba Avançado o bloco `Chaves Membros Inferiores` é numerado de 90 a 94 (a numeração salta de 54 para 90).
- Os nomes foram importados como escritos (apenas espaços normalizados) e só depois corrigidos pela migration `202610200009`.
- A marca `x` e a contagem `Acertos` da planilha são controles de avaliação e não foram importadas.
- A faixa citada em cada aba (BRANCA, AZUL, ROXA) fica na proveniência (`belt`); não foi interpretada como regra de graduação.
