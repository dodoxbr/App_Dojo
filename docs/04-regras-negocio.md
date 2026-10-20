# Regras de negócio

## Filiação
1. Aluno autenticado solicita vínculo à academia.
2. Estado inicial `pending`; gestor autorizado aprova ou rejeita com registro de ator/data.
3. Somente `approved` habilita acesso a recursos internos.
4. Papéis são por academia; nenhum usuário aprova sua própria filiação por simples alteração de perfil.
5. Mudança de academia não apaga diário global ou conquistas do atleta; não transfere dados internos privados.

## Diário e catálogo
- Registro de treino não é presença validada.
- Diário privado por padrão, inclusive para colegas e gestores. Compartilhamento exige autorização granular futura.
- Técnicas possuem IDs estáveis, sinônimos e versões de conteúdo; variações locais não alteram conteúdo global.
- Registro pode ser associado a sessão real ou treino livre.

## Presença
- Somente uma presença por aluno/sessão; status `pending`, `validated`, `revoked`.
- Professor vinculado à turma ou gestor valida; revogação justificada e auditada.
- QR code expira, é vinculado à sessão e não confere autorização para validar sozinho.
- Somente `validated` conta para graduação, com regra de deduplicação e janela aplicável.

## Graduação
- Mestre configura número de presenças por faixa/grau e, se aplicável, tempo mínimo e requisitos técnicos.
- Números na fonte do Claude eram **fictícios** e não devem virar seed de produção.
- Elegibilidade é recomendação, nunca promoção automática.
- Progresso = presenças validadas após marco de progressão aplicável, conforme regra efetiva, sem mutação do histórico.
- Aprovação registra ator, instante, faixa/grau anterior e novo, e justificativa.
- Critérios de idade, kids e federação exigem confirmação com a academia.

## Currículo
`not_started` → `studied` → `practicing` → `validated`; apenas professor autorizado altera `validated`. Avaliação técnica e assiduidade são dimensões independentes.

## Tema
Academia pode alterar logo, paleta e capa; texto e componentes mantêm contraste, tipografia e acessibilidade. Marca da plataforma permanece nos termos definidos pelo produto.
