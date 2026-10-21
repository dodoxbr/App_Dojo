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
| US-015 | (absorvida pela US-018) Foto da aula no calendário | — | Substituída: o dono do produto quer a foto como feed da academia, no lugar do WhatsApp |
| US-016 | Termos aceitos ao criar a conta e ficha de cadastro (nome, e-mail, telefone, endereço) em tabela privada; aos 18 anos o jovem cria uma conta nova | 013b | Feito, ver `docs/features/US-016.md` |
| US-017 | Financeiro: responsável financeiro como funcionalidade; o gestor controla mensalidade e pagamento de cada aluno (baixa manual primeiro); depois plataforma de pagamento (provedor a escolher, com ADR) | 016 | Feito (parte manual), ver `docs/features/US-017.md`; a plataforma de pagamento fica para depois da validação |
| US-018 | Feed de fotos da academia, no lugar do WhatsApp dos treinos (armazenamento privado, sem metadados, foto de menor só com consentimento) | 013b, 016 | Feito, ver `docs/features/US-018.md` |
| US-019 | Reações/comentários moderados e medalhas | 018 | Proposta F2/F4 |

## Definition of Done
- Critérios de aceite atendidos; UI com estados de carregamento, erro e vazio.
- RLS e autorização testadas inclusive contra acesso cruzado.
- Nenhuma migration destrutiva não revisada.
- Documentação e testes atualizados.
- Evidências de comandos executados e limitações reportadas.

## Futuro
F2: plano de aula pré-preenche diário, mídia, notificações, competição/pódio, social moderado.
F3: integração com plataforma de pagamento (o controle financeiro manual é a US-017).
F4: equipes/unidades, outras modalidades, recomendações e IA opcional.
