# UX, jornadas e telas

## Navegação mobile
- Início: próxima aula, resumo semanal, evolução e atalho de registro.
- Diário: calendário/lista, novo registro, técnicas, notas, mídia futura.
- Técnicas: categorias, busca por sinônimos, ficha técnica, favoritas futuras.
- Evolução: faixa/grau oficial, presença validada, trilha e avaliações.
- Perfil: filiações, dados pessoais e privacidade.

## Onboarding
`Criar conta → Escolher academia (busca/código) → Solicitar filiação → Aguardar aprovação → Receber acesso ao espaço da academia`.
Aluno sem academia pode usar diário pessoal e catálogo público; não tem acesso a dados internos da academia.

## Professor
`Selecionar turma → Criar sessão → Selecionar técnicas do dia → Abrir check-in → Confirmar presenças → Encerrar aula`.
O plano da aula deve permitir pré-preencher um rascunho no diário do aluno, mas jamais publicar ou confirmar registro sem ação do aluno.

## Mestre
`Configurar academia → Aprovar filiações → Definir regras e currículo → Consultar assiduidade → Avaliar elegíveis → Conceder grau`.

## Wireframes textuais
```text
INÍCIO DO ALUNO
[Logo academia]  [Trocar academia]
Olá!  Faixa [X] Grau [Y]
[Registrar treino] [Ver técnicas]
Treinos validados: 12 / meta configurada
Próxima aula: 07:00
[Meu diário] [Minha trilha]
```

## Requisitos de UX
- Registro do diário em até três passos usuais.
- Busca de técnica tolerante a acentos e sinônimos.
- Estado de filiação pendente explícito, sem mensagens ambíguas.
- Conteúdo privado claramente identificado.
- Erros de rede recuperáveis; nenhuma duplicação por repetição de toque.
