# Segurança, LGPD e governança

**Documento de projeto, não parecer jurídico.** Validar bases legais, consentimentos quando aplicáveis e políticas com responsável jurídico antes do piloto.

## Controles mínimos
- Autenticação Supabase, refresh seguro, rate limiting, e-mail verificado quando exigido.
- RLS para todas as entidades privadas; testes negativos entre academias e entre usuários da mesma academia.
- RPC transacional e autorizada para aprovações, presenças e graduações.
- Segredos apenas no servidor; `service_role` nunca em app/web; auditoria de eventos críticos.
- Fotos em tabela privada do banco (ADR-022, em vez de Storage), EXIF removido no servidor, limite de tamanho, entrega sob a regra de acesso do banco e retenção de 30 dias com apagamento real.
- Backups e plano de restauração; exclusão/anonimização conforme obrigações aplicáveis.
- LGPD: transparência, minimização, finalidade, direitos do titular e atendimento a solicitações.

## Menores
Conta de responsável e autorização verificável antes de operar dados de menores; não exibir fotos ou dados de crianças publicamente; considerar melhor interesse da criança e do adolescente. Bloquear cadastro autônomo de menor até fluxo completo existir.

## Biometria
Não incluir reconhecimento facial no MVP; identificação biométrica é dado pessoal sensível e exige análise específica e alternativa não biométrica.

## Matriz de autorização (resumo)
| Recurso | Aluno | Professor | Gestor |
|---|---|---|---|
| Próprio diário | Ler/editar | Sem acesso por padrão | Sem acesso por padrão |
| Filiação própria | Solicitar/ver | Ver turma se autorizado | Aprovar/rejeitar |
| Presença | Ver própria | Validar turma | Validar academia |
| Currículo | Ler se filiado | Propor/avaliar | Configurar |
| Graduação oficial | Ver | Recomendar | Conceder |

## Gates antes do piloto
Políticas de privacidade/termos, fluxo para menores, avaliação de storage, testes de autorização, logs, recuperação de conta, exclusão e plano de incidentes.
