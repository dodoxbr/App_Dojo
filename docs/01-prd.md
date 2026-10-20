# PRD v1.0 — Requisitos do produto

## Problema e objetivo
Alunos anotam técnicas em WhatsApp ou notas isoladas; professores planejam conteúdos e acompanham presença de forma dispersa. A solução organiza o conhecimento do tatame e vincula o diário pessoal ao currículo da academia, com controle de presença e graduação.

## Personas
- **Aluno:** quer registrar rapidamente o que aprendeu e rever técnicas; acompanha frequência e progresso.
- **Instrutor:** planeja aula, escolhe técnicas, valida presenças e recomenda progresso.
- **Mestre/gestor:** aprova filiações e graus, configura critérios e acompanha turmas.
- **Responsável:** gerencia dados e permissões de menor, sem tornar conteúdo público.

## MVP — requisitos funcionais
| ID | Requisito | Prioridade | Critério de aceite resumido |
|---|---|---|---|
| RF-01 | Cadastro/login e perfil global | P0 | Usuário autenticado visualiza somente seus dados globais |
| RF-02 | Criar academia e personalizar tema | P0 | Logo, cores e nome persistidos; contraste mínimo validado |
| RF-03 | Solicitar filiação e aprovar/rejeitar | P0 | Só gestor autorizado decide; decisão auditada |
| RF-04 | Cadastro de técnicas e categorias | P0 | Busca por nome/sinônimo; técnica global ou específica da academia |
| RF-05 | Diário privado com técnicas e anotações | P0 | Usuário cria/edita seus registros; outro aluno não lê |
| RF-06 | Turmas, sessões e professor responsável | P0 | Professor cria sessão de turma autorizada |
| RF-07 | Presença validada | P0 | Só professor/gestor autorizado valida; não duplica |
| RF-08 | Regras de graduação e progresso | P0 | Apenas presenças válidas; regras versionadas; mestre decide |
| RF-09 | Currículo/trilha por nível | P0 | Mestre associa técnicas a trilha e professor valida domínio |
| RF-10 | Visão administrativa básica | P1 | Frequência por turma e lista de elegíveis autorizada |
| RF-11 | Responsável por menor | P0 para operação com menores | Sem exposição pública, vinculação verificável |

## Fora do MVP
Feed social, competições/pódios, pagamentos, cobrança automática, reconhecimento facial, IA generativa, marketplace e apps white-label publicados individualmente.

## Requisitos não funcionais
- **Segurança:** RLS, mínimo privilégio, logs auditáveis, tokens efêmeros e revogação.
- **Privacidade:** diário privado; fotos com acesso controlado; política de exclusão e retenção.
- **Desempenho (meta inicial):** navegação fluida em rede móvel, paginação e thumbnails; medir antes de fixar SLA.
- **Acessibilidade:** contraste WCAG AA para textos usuais; tamanho de toque e leitores de tela.
- **Observabilidade:** erros por módulo, falhas de autorização, eventos críticos e rastreabilidade.
- **Confiabilidade:** migrations reversíveis quando viável, backup e recuperação testada antes do piloto.

## Indicadores do piloto
Ativação (filiação aprovada), % de alunos que registram diário semanalmente, taxa de presença validada, tempo para lançar presença, técnicas mais consultadas, retenção semanal e feedback dos professores. Sem metas numéricas inventadas.
