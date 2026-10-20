# Catálogo e importação da planilha

## Origem
Planilha fornecida pelo usuário: `Plano de Treino_Básico ao Avançado.xlsx`. A conversa descreve abas de avaliação, básico, intermediário, avançado e tempo de faixa. **Esta versão não declara que todas as células foram extraídas ou revisadas**. A importação efetiva é tarefa futura com revisão humana.

## Fluxo recomendado
1. Inventariar abas, colunas e linhas úteis, sem editar o original.
2. Exportar staging `techniques_staging.csv`: `source_sheet,source_row,raw_name,category,level,notes`.
3. Normalizar acentos, aliases e nomes; **não fundir** técnicas distintas por heurística automática.
4. Validar com o mestre categoria, descrição, posição e elegibilidade curricular.
5. Gerar seed versionada com `technique_id` estável e proveniência da linha de origem.
6. Vincular técnicas às trilhas curriculares da academia piloto.

## Ficha técnica
Nome, sinônimos, categoria, posição inicial, objetivo, passos, pontos de atenção, erros comuns, faixa/nível sugerido, links de mídia autorizados, autor/revisor, data de revisão e origem.

## Vídeos
Preferir vídeos reais autorizados e revisados; clipes curtos em loop, compressão e thumbnails. Conteúdo gerado por IA só após revisão técnica; não assumir precisão biomecânica.
