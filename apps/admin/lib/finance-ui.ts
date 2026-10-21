import { rpcErrorMessage } from "./rpc-errors";

// Date helpers shared by the finance screens (the academy's own time zone decides "today" and the month).
export const todayIn = (tz: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export const fmtDate = (iso: string): string => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });

// Error keys travel in the URL after a redirect, so only these fixed keys are accepted (no arbitrary text is reflected).
const messages: Record<string, string> = {
  amount: "Informe um valor entre R$ 0,01 e R$ 100.000,00.",
  due_day: "O dia de vencimento vai do dia 1 ao 28.",
  starts_on: "A data de início deve ficar dentro de 1 ano.",
  "not a student": "Só alunos aprovados têm plano de mensalidade.",
  "not a member": "Só se cobra quem faz parte da academia.",
  month: "Mês inválido: use de 24 meses atrás até 3 meses à frente.",
  method: "Escolha a forma de pagamento.",
  paid_on: "A data do pagamento não pode ser futura nem anterior a 2 anos.",
  description: "Descreva a cobrança (2 a 120 caracteres).",
  due_date: "O vencimento deve ficar dentro de 1 ano.",
  reason: "Informe o motivo (3 a 500 caracteres).",
  note: "A observação pode ter até 500 caracteres.",
  discount: "O desconto deve ser menor que o valor do plano. Para isentar, use Isentar na cobrança.",
  "discount note": "Informe o motivo do desconto (por exemplo: irmãos, bolsa).",
  state: "A cobrança não está no estado esperado. Atualize a página e confira o histórico.",
  forbidden: "Você não tem permissão para esta ação.",
  other: "Não foi possível concluir a operação. Tente novamente.",
};

export function financeErrorKey(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "forbidden";
  if (error.code === "23505") return "state";
  if (error.code === "22023") {
    const m = error.message ?? "";
    for (const key of Object.keys(messages).sort((a, b) => b.length - a.length)) if (key !== "state" && key !== "forbidden" && key !== "other" && m.includes(key)) return key;
  }
  return "other";
}

export function financeMessage(key: string | undefined): string | null {
  if (!key) return null;
  return messages[key] ?? rpcErrorMessage({ code: "other" });
}
