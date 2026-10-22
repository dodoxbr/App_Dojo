"use client";

import { startTransition, useEffect, useRef, type FormHTMLAttributes } from "react";

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  /** O `action` devolvido por `useActionState`. */
  action: (formData: FormData) => void;
  /** Resultado da ação; com `resetOnSuccess`, o formulário é limpo quando vem `message`. */
  state?: { message?: string; error?: string };
  resetOnSuccess?: boolean;
};

// Formulário que NÃO apaga o que a pessoa digitou quando a ação dá erro. O React 19 limpa os campos depois de todo envio feito pelo
// atributo `action`; aqui o envio é feito à mão (mesma ação, mesmo estado pendente), então os campos ficam como estavam.
// Com `resetOnSuccess`, limpa só quando a ação responde com sucesso.
export function PreservingForm({ action, state, resetOnSuccess = false, ...rest }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.message) ref.current?.reset();
  }, [resetOnSuccess, state]);
  return (
    <form
      {...rest}
      ref={ref}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(formData));
      }}
    />
  );
}
