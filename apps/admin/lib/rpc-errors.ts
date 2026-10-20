// Maps database error codes (see migrations 004-011) to messages that do not leak other tenants' data.
export function rpcErrorMessage(
  error: { code?: string; message?: string },
  options: { conflict?: string } = {},
): string {
  switch (error.code) {
    case "42501":
      return "Você não tem permissão para esta ação.";
    case "P0002":
      return "Não encontrado. A pessoa precisa já ter criado a conta.";
    case "23505":
      return options.conflict ?? "A operação conflita com o estado atual (por exemplo, já decidido ou não alterável).";
    case "22023": {
      const m = error.message ?? "";
      if (m.includes("contrast")) return "Contraste insuficiente entre as cores (mínimo 4,5:1).";
      if (m.includes("instructor")) return "O instrutor precisa ser instrutor ou gestor aprovado desta academia.";
      if (m.includes("class inactive")) return "Esta turma está inativa. Ative-a para agendar aulas.";
      if (m.includes("time")) return "O horário final deve ser depois do inicial.";
      if (m.includes("date")) return "A data deve estar dentro de 1 ano a partir de hoje.";
      return "Dados inválidos. Revise os campos.";
    }
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}

// Used to pass an error through a redirect without reflecting arbitrary text from the URL.
export const redirectErrorCodes = ["42501", "P0002", "23505", "22023", "other"] as const;
export function errorFromCode(code: string | undefined, options: { conflict?: string } = {}): string | null {
  if (!code) return null;
  return rpcErrorMessage({ code: (redirectErrorCodes as readonly string[]).includes(code) ? code : "other" }, options);
}
