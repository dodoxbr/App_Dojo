// Error keys travel in the URL after a redirect, so only these fixed keys are accepted (no arbitrary text is reflected).
const messages: Record<string, string> = {
  file: "Escolha uma foto para postar.",
  toobig: "A foto é grande demais (máximo 8 MB).",
  format: "Use uma foto JPEG, PNG ou WebP.",
  decode: "Não foi possível ler essa foto. Tente outra imagem.",
  size: "A foto continua grande demais depois de reduzida. Tente outra.",
  fields: "Revise os campos do post.",
  caption: "A legenda pode ter até 500 caracteres.",
  tags: "Marque só pessoas da academia (máximo 30).",
  "tag minors": "Você disse que há criança ou adolescente na foto: marque quem aparece.",
  "photo consent": "Há alguém marcado que não autorizou o uso da imagem (menor sem a autorização do responsável, ou adulto que ainda não autorizou). Desmarque a pessoa ou escolha outra foto.",
  "guardian tags": "Marque o seu menor na foto (só os seus menores podem ser marcados).",
  "not pending": "Essa foto já foi analisada.",
  "daily limit": "Limite diário atingido (20 posts ou 30 comentários por dia).",
  body: "Escreva o comentário (1 a 300 caracteres).",
  reason: "Informe o motivo da denúncia (3 a 300 caracteres).",
  forbidden: "Você não tem permissão para esta ação.",
  other: "Não foi possível concluir a operação. Tente novamente.",
};

export function feedErrorKey(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "forbidden";
  if (error.code === "22023") {
    const m = error.message ?? "";
    for (const key of Object.keys(messages).sort((a, b) => b.length - a.length)) {
      if (!["forbidden", "other", "file", "toobig", "format", "decode", "size", "fields"].includes(key) && m.includes(key)) return key;
    }
    if (m.includes("image")) return "format";
  }
  return "other";
}

export function feedMessage(key: string | undefined): string | null {
  return key ? (messages[key] ?? messages.other ?? null) : null;
}
