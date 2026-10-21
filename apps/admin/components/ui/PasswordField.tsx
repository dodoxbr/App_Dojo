"use client";

import { useState } from "react";
import { TextField, type TextFieldProps } from "./TextField";
import styles from "./PasswordField.module.css";

// Campo de senha com mostrar/ocultar. O botão é de verdade (teclado e leitor de tela) e não envia o formulário.
export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button type="button" className={styles.toggle} onClick={() => setVisible((v) => !v)} aria-pressed={visible} aria-label={visible ? "Ocultar a senha" : "Mostrar a senha"}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      }
    />
  );
}
