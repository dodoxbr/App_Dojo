# Lacunas a validar com a academia piloto

- [ ] Nome do produto e identidade visual própria.
- [ ] Regras oficiais da academia para faixa/grau e exigências técnicas.
- [ ] Currículo da planilha revisado pelo mestre; permissões de reprodução.
- [ ] Quem pode criar academias e quem se torna gestor inicial.
- [ ] Instrutor pode aprovar filiação? Definir política.
- [ ] Aluno sem filiação pode registrar treinos pessoais? Proposta: sim.
- [ ] Quais dados são necessários para menores e responsável?
- [ ] Privacidade de fotos e duração de armazenamento.
- [ ] Check-in apenas manual inicialmente ou QR no MVP?
- [ ] Regras de contagem: duas aulas no mesmo dia, treinos externos, treinos No-Gi, faltas e retificações.
- [ ] Regras de elegibilidade para grau após troca de academia.
- [ ] Termos, privacidade, propriedade intelectual dos vídeos e política de moderação.

## Técnicas (US-001)
- [ ] 30 vulnerabilidades reportadas por `npm audit` (8 moderate, 22 high), em dependências transitivas do Expo (`@expo/config-plugins` etc.). Reavaliar quando o Expo publicar correções; não rodar `npm audit fix --force`.
- [ ] `packageManager` fixa npm@10.9.0, mas o ambiente local usa npm 11 e Node 24. Alinhar versão ou ajustar o campo.
- [ ] Assets em `apps/mobile/assets` são placeholders do template Expo; substituir pela identidade visual (item de nome/identidade acima).
- [ ] Testes de RLS cobrem só as 6 tabelas da migration inicial; cada história nova deve ampliar `supabase/tests/database/`.
- [ ] `academies` legível por qualquer autenticado (diretório); revisar se ganhar colunas sensíveis.
- [ ] CI (`.github/workflows/ci.yml`) escrito mas ainda não executado (pasta sem remoto Git).
