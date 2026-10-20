// Maps database error codes (see migration 202610200004) to messages that do not leak other tenants' data.
export function rpcErrorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "42501":
      return "Você não tem permissão para esta ação.";
    case "P0002":
      return "Não encontrado. Para liberar um criador, a pessoa precisa já ter criado a conta.";
    case "23505":
      return "Esse endereço (slug) já está em uso.";
    case "22023":
      return error.message?.includes("contrast")
        ? "Contraste insuficiente entre as cores (mínimo 4,5:1)."
        : "Dados inválidos. Revise os campos.";
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}
