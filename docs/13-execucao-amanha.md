# Checklist da primeira sessão no computador

## 1. Preparação
- Instalar/verificar Node.js LTS, npm, Git, Docker Desktop, VS Code + Claude Code, Supabase CLI.
- Extrair ZIP, abrir pasta raiz no VS Code e inicializar Git.
- Verificar `node --version`, `npm --version`, `docker --version`, `supabase --version`.

## 2. Testar fundação já incluída
```bash
npm install
npm test
```

## 3. Supabase local (depois de Docker e CLI instalados)
```bash
supabase start
supabase db reset
```

## 4. Abrir Claude Code
Colar conteúdo de `prompts/01-primeira-sessao.md`. Solicitar revisão da migration e implementação de US-001, sem começar features posteriores.

## 5. Gates
- Não habilitar cadastro real de menores.
- Não usar service_role em cliente.
- Não publicar no ar antes de implementar autorização de criação de academia, aprovações e testes de RLS.
- Não importar planilha como regras oficiais sem revisão do mestre.
