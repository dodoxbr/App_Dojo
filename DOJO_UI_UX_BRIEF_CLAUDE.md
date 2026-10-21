# Dojo Platform — Brief de UI/UX para Claude Code

## Objetivo
Evoluir a interface HTML de teste para uma experiência visual consistente, moderna, esportiva e profissional. Preservar **todas as funcionalidades, rotas, autenticação, validações e integrações existentes**. Não reescrever a aplicação nem alterar o backend para fazer a mudança visual.

## Diagnóstico da tela atual
A tela atual apresenta login e criação de conta empilhados na mesma página, campos muito altos, pouca hierarquia e largura limitada sem composição visual. O símbolo de desenvolvimento visível sobre o formulário não é parte da interface final. A tela é funcional, mas deve ser tratada como protótipo.

## Direção visual
- Estilo: sports-tech premium, limpo, confiável, com influência de aplicativos de performance esportiva. Evitar estética de game, excesso de gradientes, brilho neon, fotos de fundo poluídas e componentes gigantes.
- Tema-base: azul-marinho profundo, superfície clara e acentos em turquesa. Oferecer tema escuro futuramente.
- Personalização por academia: logotipo, nome, cor primária e imagem de capa. Aplicar cores da academia por tokens, **sem substituir cores semânticas de erro/sucesso** e sem comprometer contraste.
- Mobile-first para o aluno; dashboard responsivo para mestre/professor.
- Textos e microcopy em português do Brasil.

## Tokens iniciais (proposta, ajustáveis após inspeção)
```css
:root {
  --color-brand: #183B63;
  --color-brand-strong: #102840;
  --color-accent: #0E9488;
  --color-bg: #F5F7FA;
  --color-surface: #FFFFFF;
  --color-text: #142235;
  --color-muted: #65748B;
  --color-border: #DFE5ED;
  --color-danger: #C43B47;
  --radius-card: 16px;
  --radius-control: 10px;
  --shadow-card: 0 8px 28px rgba(16,40,64,.07);
}
```
Preferir tokens semânticos (`--primary`, `--surface`, `--text`) mapeados para as cores acima; cores específicas da academia são carregadas por configuração validada. Espaçamento em escala 4/8/12/16/24/32; tipografia Inter ou fonte sans-serif já instalada; foco visível; contraste WCAG AA.

## Telas e composição

### 1. Login / cadastro (primeira implementação)
- Desktop: composição em duas áreas; esquerda com marca Dojo Platform, mensagem curta e ilustração/foto **apenas se houver ativo autorizado**, direita com card de autenticação de largura confortável (400–460 px).
- Mobile: uma coluna com logo, título, campos e CTA; sem overflow horizontal.
- Login e cadastro em telas/abas claramente separadas, em vez de formulários longos empilhados.
- Login: e-mail, senha, mostrar/ocultar senha, recuperar senha, CTA 'Entrar', link 'Criar conta'.
- Cadastro: nome, e-mail, senha, confirmação e dados adicionais apenas quando necessários; data de nascimento pode ser solicitada na etapa apropriada do onboarding.
- Estados: loading, erros de validação, falha de autenticação, sucesso, acessibilidade e navegação por teclado.
- Não alterar lógica de login nem inventar login social que ainda não esteja implementado.

### 2. Onboarding e filiação
- Passo 1: perfil do atleta; passo 2: buscar academia; passo 3: solicitar filiação; passo 4: aguardar aprovação.
- Exibir logo, nome, cidade e cores da academia encontrada.
- Mostrar estado PENDENTE/APROVADA/REJEITADA com mensagens claras; não liberar recursos privados antes da aprovação.

### 3. Home do aluno (mock se não existir)
- Cabeçalho com academia atual, foto do atleta e faixa/grau.
- Card principal 'Meu progresso': treinos validados, meta configurada, barra de evolução; deixar explícito que grau depende de aprovação do mestre.
- Resumo semanal, próximo treino, CTA 'Registrar treino'.
- Seções compactas: últimas técnicas, diário recente, trilha de aprendizagem.
- Navegação mobile: Início, Diário, Técnicas, Evolução, Perfil.

### 4. Diário de treino
- Entrada rápida: data, aula/turma opcional, técnicas escolhidas do catálogo, notas pessoais e mídia opcional.
- Privado por padrão; compartilhar apenas por ação explícita.
- Diferenciar 'estudada', 'praticada' e 'validada pelo professor'.

### 5. Catálogo técnico
- Busca, filtros por posição/categoria/nível, cards com nome, miniatura opcional, passos, erros comuns e vídeo curto quando existir.
- Não inventar vídeos nem demonstrar técnica incorreta; usar placeholder para mídias ausentes.

### 6. Painel professor/mestre
- Desktop: sidebar compacta + topbar + conteúdo com grid de cards e tabelas legíveis.
- Indicadores: alunos ativos, presenças, filiações pendentes, graduações elegíveis.
- Ações rápidas: criar aula, validar presença, revisar filiação, registrar graduação.
- Tabelas com filtros, estados vazios e confirmação para ações sensíveis.

## Componentes reutilizáveis
AppShell, BrandLogo, AcademyThemeProvider, Button, TextField, PasswordField, Card, Badge, ProgressBar, EmptyState, LoadingState, Modal/ConfirmDialog, PageHeader, BottomNavigation, SidebarNavigation, TechniqueCard, TrainingLogCard, BeltProgressCard.

## Regras de implementação
1. **Primeiro inspecione** framework, pastas, rotas, CSS, componentes, testes e fluxo de autenticação existentes. Não presuma React/Next.js se a tela atual é HTML puro.
2. Escreva um plano curto identificando o que será alterado e o que será preservado.
3. Implemente primeiro **somente login e cadastro** com layout responsivo, tokens e componentes reutilizáveis compatíveis com a stack atual.
4. Não troque stack, não refatore serviços, não altere schema e não acrescente dependências sem necessidade.
5. Não usar CSS global que quebre outras páginas; preferir estilos encapsulados/componentizados.
6. Sem lorem ipsum em telas finais; use dados de exemplo claramente identificados nas telas ainda não conectadas.
7. Não tratar presença autodeclarada como validada nem graduar automaticamente.
8. Implementar estados de carregamento, erro, vazio e foco; testar mobile 360/390 px, tablet 768 px e desktop 1280 px.
9. Rodar lint, build e testes disponíveis; relatar o que foi testado e o que não foi possível testar.
10. Entregar resumo dos arquivos modificados e capturas das telas, caso o ambiente permita.

## Critérios de aceite da primeira tarefa
- Login e cadastro não aparecem mais empilhados.
- Visual consistente com tokens e tipografia definidos.
- Layout utilizável em celular e desktop, sem rolagem horizontal.
- Todos os inputs possuem labels, mensagens de erro e foco visível.
- Fluxo de autenticação anterior continua funcionando.
- Componentes e estilos são reaproveitáveis nas próximas telas.
- Nenhum dado de exemplo é confundido com dados reais.

## Prompt para iniciar no Claude Code
> Leia `DOJO_UI_UX_BRIEF_CLAUDE.md` e `CLAUDE.md`, inspecione o projeto real e proponha um plano de mudança visual incremental. Implemente agora apenas a primeira entrega: login e cadastro responsivos, separados, com tokens de design e componentes reutilizáveis. Preserve toda a lógica atual, não altere banco/API e não adicione funcionalidades não solicitadas. Execute testes e build, corrija falhas causadas pelas mudanças e relate arquivos modificados e próximos passos.
