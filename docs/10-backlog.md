# Backlog executável — ordem de implementação

Cada história deve ter migration, política RLS, testes negativos e interface mínima. Estimativas somente após spike técnico.

| ID | História | Dependências | Pronto quando |
|---|---|---|---|
| US-001 | Configurar monorepo, CI e Supabase local | — | Scripts de lint/test e banco local reproduzíveis |
| US-002 | Autenticar e criar perfil global | 001 | Login/logout e perfil próprio seguro |
| US-003 | Criar academia e personalizar tema | 002 | Criador vira gestor via operação segura |
| US-004 | Solicitar, aprovar e rejeitar filiação | 003 | Fluxo auditado, testes de autorização |
| US-005 | Cadastrar/buscar técnicas | 003 | Global + academia, aliases e revisão |
| US-006 | Criar diário privado e associar técnicas | 005 | CRUD privado e vínculo N:N |
| US-007 | Cadastrar turma e abrir sessão | 004 | Professor autorizado agenda aula |
| US-008 | Validar presença manual e QR | 007 | Token expirável, professor confirma |
| US-009 | Criar currículo e avaliar habilidades | 005,004 | Domínio validado por professor |
| US-010 | Configurar regras e calcular progresso | 008 | Regras versionadas e histórico imutável |
| US-011 | Aprovar grau e auditar | 010 | Mestre concede com evento atômico |
| US-012 | Painel de frequência e piloto | 011 | Indicadores e testes E2E |
| US-013 | Fluxo responsável/menores | 004 | Feito: parte 1 (idade) e parte 2 (responsável cria a conta do menor, consentimento verificado pelo gestor, responsável financeiro), ver `docs/features/US-013b.md` |

| US-014 | Desafios entre alunos (presença, treino e golpe) com ativação por mínimo e ranking completo | 012, 013a | Feito, ver `docs/features/US-014.md` |
| US-015 | Foto da aula no calendário para facilitar a confirmação de presença (armazenamento privado, sem metadados, consentimento) | 013b, 014 | Proposta |
| US-016 | Reações/comentários moderados e medalhas | 015 | Proposta F2/F4 |

## Definition of Done
- Critérios de aceite atendidos; UI com estados de carregamento, erro e vazio.
- RLS e autorização testadas inclusive contra acesso cruzado.
- Nenhuma migration destrutiva não revisada.
- Documentação e testes atualizados.
- Evidências de comandos executados e limitações reportadas.

## Futuro
F2: plano de aula pré-preenche diário, mídia, notificações, competição/pódio, social moderado.
F3: financeiro e integrações de pagamento.
F4: equipes/unidades, outras modalidades, recomendações e IA opcional.
