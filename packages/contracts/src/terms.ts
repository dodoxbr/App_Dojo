// US-016: terms shown at sign-up. EVERY TEXT HERE IS A DRAFT pending legal review (docs/11): it does not name a company, a
// CNPJ or a contact because those data do not exist yet. The accepted version is recorded in the database.
export const CURRENT_TERMS_VERSION = 'rascunho-2026-10';

export type TermsSection = { id: string; title: string; paragraphs: string[] };

export const termsOfUse: TermsSection[] = [
  {
    id: 'objeto',
    title: '1. O que é a plataforma',
    paragraphs: [
      'A plataforma ajuda academias de Jiu-Jitsu a organizar turmas, aulas, presenças, currículo técnico, graduações e a comunicação com alunos e responsáveis.',
      'Cada academia define as próprias regras (por exemplo, os critérios de graduação). A plataforma não impõe regras oficiais de federação.',
    ],
  },
  {
    id: 'conta',
    title: '2. Sua conta',
    paragraphs: [
      'Você informa dados verdadeiros e mantém sua senha em segredo. Cada pessoa tem uma única conta, que pode participar de mais de uma academia.',
      'Menores de 18 anos não criam conta: o responsável adulto cadastra o menor e usa a plataforma em nome dele.',
    ],
  },
  {
    id: 'presenca',
    title: '3. Presença e graduação',
    paragraphs: [
      'Só conta como presença a que o professor ou o gestor confirmou. Registros de treino que você mesmo faz não valem como presença.',
      'A graduação oficial é concedida pela academia. O aluno pode informar uma graduação declarada, que depende de confirmação.',
    ],
  },
  {
    id: 'conduta',
    title: '4. Conduta',
    paragraphs: [
      'Não use a plataforma para assediar, enganar ou expor outras pessoas, nem para tentar acessar dados que não são seus.',
      'A academia pode suspender ou encerrar o vínculo de quem descumprir estas regras.',
    ],
  },
  {
    id: 'pagamentos',
    title: '5. Mensalidades e pagamentos',
    paragraphs: [
      'O controle financeiro entrará em uma etapa futura, com termos próprios para o responsável financeiro. Este texto será atualizado e você será avisado.',
    ],
  },
  {
    id: 'mudancas',
    title: '6. Mudanças',
    paragraphs: ['Quando estes termos mudarem, uma nova versão será publicada e pediremos que você aceite novamente.'],
  },
];

export const privacyPolicy: TermsSection[] = [
  {
    id: 'dados',
    title: '1. Quais dados tratamos',
    paragraphs: [
      'Conta: e-mail, nome de exibição e data de nascimento (usada só para saber se você é maior de idade).',
      'Ficha de cadastro: nome completo, telefone e endereço. Eles ficam em área privada.',
      'Uso da plataforma: filiação às academias, presenças confirmadas, graduações, avaliações de domínio técnico e participação em desafios.',
      'Diário de treino: é privado por padrão. O professor só lê o que você compartilhar de forma explícita.',
    ],
  },
  {
    id: 'finalidade',
    title: '2. Para que usamos',
    paragraphs: [
      'Para operar a sua participação nas academias onde você tem vínculo: confirmar presença, acompanhar sua evolução e manter contato.',
      'Não vendemos seus dados nem os usamos para publicidade de terceiros.',
    ],
  },
  {
    id: 'acesso',
    title: '3. Quem pode ver',
    paragraphs: [
      'Você vê os seus dados. O gestor da academia onde você tem vínculo vê a sua ficha de cadastro, e cada leitura fica registrada.',
      'Instrutores veem apenas o que o gestor liberar para a função deles, e nunca o seu diário sem o seu compartilhamento.',
      'Os dados de uma academia não são visíveis para outra.',
    ],
  },
  {
    id: 'menores',
    title: '4. Crianças e adolescentes',
    paragraphs: [
      'Os dados de menores são tratados com proteção reforçada e somente com o consentimento específico do responsável legal, conferido pessoalmente pelo gestor da academia.',
      'O responsável pode revogar o consentimento a qualquer momento; o menor fica suspenso na academia até um novo consentimento.',
      'Fotos de menores só são usadas se o responsável autorizar de forma expressa.',
    ],
  },
  {
    id: 'direitos',
    title: '5. Seus direitos',
    paragraphs: [
      'Você pode pedir acesso, correção e exclusão dos seus dados, e revogar consentimentos, conforme a LGPD.',
      'O canal de atendimento e o nome do controlador dos dados serão informados aqui antes da abertura para o público.',
    ],
  },
  {
    id: 'seguranca',
    title: '6. Segurança e guarda',
    paragraphs: [
      'Aplicamos controles de acesso por academia e por função, e registramos as ações importantes. O prazo de guarda dos dados será definido com a revisão jurídica deste texto.',
    ],
  },
];
