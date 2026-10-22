// US-016: terms shown at sign-up. EVERY TEXT HERE IS A DRAFT pending legal review (docs/11): it does not name a company, a
// CNPJ or a contact because those data do not exist yet. The accepted version is recorded in the database.
export const CURRENT_TERMS_VERSION = 'rascunho-2026-11';

export type TermsSection = { id: string; title: string; paragraphs: string[] };

// Variables of the texts: {{empresa}} and {{cnpj}} (the academy, controller of the data of its members) and {{operador}} and
// {{operador_cnpj}} (the company that runs the platform). Missing values read "a definir".
export type TermsVars = Partial<Record<'empresa' | 'cnpj' | 'operador' | 'operador_cnpj', string | null | undefined>>;

export function fillTerms(sections: TermsSection[], vars: TermsVars): TermsSection[] {
  const sub = (text: string) => text.replace(/\{\{(empresa|cnpj|operador|operador_cnpj)\}\}/g, (_m, key: keyof TermsVars) => vars[key]?.trim() || 'a definir');
  return sections.map((s) => ({ ...s, title: sub(s.title), paragraphs: s.paragraphs.map(sub) }));
}

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
    id: 'fotos',
    title: '4. Fotos e vídeos dos treinos',
    paragraphs: [
      'A plataforma tem um feed de fotos de cada academia. As fotos postadas ficam visíveis para todos os membros da academia por 30 dias e depois são apagadas da plataforma.',
      'A academia costuma divulgar os treinos nas redes sociais dela, como o Instagram. Ao participar dos treinos, você concorda que fotos e vídeos em que você apareça podem ser publicados nas redes sociais da academia.',
      'Você pode pedir a remoção de uma foto a qualquer momento, pela denúncia no próprio feed ou falando com a academia. A academia retira o que estiver sob o controle dela; o que já foi copiado por terceiros ou publicado em redes de terceiros pode depender de pedido na própria rede.',
      'Fotos de menores só entram no feed com a autorização do responsável. A publicação nas redes sociais da academia exige uma autorização separada do responsável.',
    ],
  },
  {
    id: 'conduta',
    title: '5. Conduta',
    paragraphs: [
      'Não use a plataforma para assediar, enganar ou expor outras pessoas, nem para tentar acessar dados que não são seus.',
      'A academia pode suspender ou encerrar o vínculo de quem descumprir estas regras.',
    ],
  },
  {
    id: 'pagamentos',
    title: '6. Mensalidades e pagamentos',
    paragraphs: [
      'O controle financeiro da academia é feito pelo gestor, que registra manualmente as mensalidades e os pagamentos recebidos. A plataforma não recebe, intermedeia nem processa pagamentos.',
      'O aluno consulta as próprias cobranças. Em caso de menor, o responsável legal e o responsável financeiro consultam as cobranças do menor.',
      'Se a academia passar a usar uma plataforma de pagamento, estes termos serão atualizados e você será avisado antes.',
    ],
  },
  {
    id: 'mudancas',
    title: '7. Mudanças',
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
      'Fotos dos treinos: as imagens que os membros postam no feed da academia, sem os dados escondidos da foto (como a localização), guardadas por 30 dias.',
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
      'Fotos de menores só entram no feed se o responsável autorizar de forma expressa. A publicação nas redes sociais da academia, como o Instagram, é uma autorização separada e pode ser dada ou retirada a qualquer momento.',
    ],
  },
  {
    id: 'direitos',
    title: '5. Seus direitos',
    paragraphs: [
      'Você pode pedir acesso, correção e exclusão dos seus dados, e revogar consentimentos, conforme a LGPD.',
      'Em cada academia, quem decide como os dados dos seus membros são usados (o controlador) é a própria academia: {{empresa}}, CNPJ {{cnpj}}.',
      'A plataforma é operada por {{operador}}, CNPJ {{operador_cnpj}}. O canal de atendimento será informado aqui antes da abertura para o público.',
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

// ---- Termo de uso de imagem de menor (assinado pelo responsável legal). RASCUNHO até a revisão jurídica (docs/11).
export const PHOTO_TERM_VERSION = 'rascunho-2026-12';

export const photoTerm: TermsSection[] = [
  {
    id: 'objeto',
    title: '1. O que este termo autoriza',
    paragraphs: [
      'Eu, responsável legal, autorizo a academia {{empresa}} a registrar e publicar fotos do menor sob a minha responsabilidade em atividades da academia (aulas, treinos, graduações e eventos).',
      'A autorização vale somente para a finalidade abaixo, é específica para este menor e para esta academia e não envolve nenhum pagamento.',
    ],
  },
  {
    id: 'onde',
    title: '2. Onde as fotos aparecem',
    paragraphs: [
      'No feed fechado da academia, visível apenas para os membros dela, por 30 dias; depois disso as fotos são apagadas.',
      'Nas redes sociais da academia (por exemplo, o Instagram) somente se eu marcar essa opção de forma separada. Sem essa marca, as fotos do menor não vão para redes sociais.',
    ],
  },
  {
    id: 'moderacao',
    title: '3. Aprovação pelo professor',
    paragraphs: [
      'Toda foto em que o menor aparece só é publicada depois que o professor ou o gestor da academia aprova. Conteúdo sem respeito (zoeira, ofensa, exposição de colega) é recusado.',
    ],
  },
  {
    id: 'revogacao',
    title: '4. Posso mudar de ideia',
    paragraphs: [
      'Posso revogar esta autorização a qualquer momento na plataforma. Ao revogar, as fotos do menor deixam de aparecer no feed e o menor fica suspenso até nova autorização.',
      'Fotos já publicadas fora da plataforma (redes sociais) devem ser retiradas pela academia a meu pedido.',
    ],
  },
  {
    id: 'assinatura',
    title: '5. Assinatura',
    paragraphs: [
      'Ao digitar meu nome completo e confirmar, declaro que li este termo, que sou o responsável legal do menor e que a autorização é dada por mim. A plataforma guarda meu nome, a data e a versão do termo.',
    ],
  },
];

// Texto curto para o ADULTO autorizar a própria imagem no feed interno da academia. RASCUNHO até a revisão jurídica.
export const adultImageTerm: TermsSection[] = [
  {
    id: 'adulto',
    title: 'Autorização de imagem (adulto)',
    paragraphs: [
      'Autorizo que a minha imagem apareça em fotos postadas no feed fechado da academia {{empresa}}, visível apenas para os membros dela, por 30 dias. A autorização vale só para esta academia e não envolve pagamento.',
      'Posso revogar a qualquer momento na plataforma: as fotos em que estou marcado saem do feed. Fotos já publicadas fora da plataforma devem ser retiradas pela academia a meu pedido.',
    ],
  },
];

// A assinatura é o nome completo (nome e sobrenome) digitado pelo responsável. As mesmas regras estão no banco (`valid_signature`).
export function isValidSignature(name: string | null | undefined): boolean {
  const v = (name ?? '').trim();
  return v.length >= 5 && v.length <= 120 && /\s/.test(v);
}

// ---- Declaração de saúde (a pessoa lê e marca no cadastro). RASCUNHO até a revisão jurídica (docs/11).
export const DECLARATIONS_VERSION = 'rascunho-2026-12';

export const healthDeclaration: TermsSection[] = [
  {
    id: 'saude',
    title: 'Declaração de saúde',
    paragraphs: [
      'Declaro que estou em condições de saúde para praticar Jiu-Jitsu e que não tenho nenhuma restrição médica que me impeça de treinar.',
      'Estou ciente de que o Jiu-Jitsu é um esporte de contato, com risco de lesões, e me comprometo a avisar o professor sobre qualquer condição de saúde, lesão, gravidez ou medicamento que possa afetar o treino, e a parar se me sentir mal.',
      'As informações de saúde que eu registrar na ficha são dado sensível: só eu, o professor com permissão e o gestor da academia podemos vê-las, e cada consulta é registrada.',
    ],
  },
];
