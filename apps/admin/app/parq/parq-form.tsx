"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { parqAdvice, parqQuestions } from "@dojo/contracts/parq";
import { healthResponsibilityTerm } from "@dojo/contracts/terms";
import { Alert, Button } from "@/components/ui";
import type { FormState } from "../login/actions";
import { submitParq } from "./actions";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import styles from "./parq.module.css";

const STEPS = ["Questionário", "Termo", "Assinatura"];

// Fluxo em 3 telas: (1) PAR-Q de 7 perguntas, (2) termo de responsabilidade de saúde (lido até o fim e marcado), (3) assinatura desenhada.
export function ParqForm({ userId, revalidate, subjectName, forMinor }: { userId: string; revalidate: string; subjectName?: string; forMinor?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>((prev, formData) => submitParq(userId, revalidate, prev, formData), {});
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => Array(parqQuestions.length).fill(null));
  const [notes, setNotes] = useState("");
  const [readAll, setReadAll] = useState(false);
  const [agree, setAgree] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const alertRef = useRef<HTMLDialogElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  const allAnswered = answers.every((a) => a !== null);
  const anyYes = answers.some((a) => a === true);

  // Texto curto que já cabe na caixa: nada para rolar, então conta como lido.
  useEffect(() => {
    if (step !== 2) return;
    const el = termRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 2) setReadAll(true);
  }, [step]);

  function nextFromQuestions() {
    if (!allAnswered) return;
    if (anyYes) alertRef.current?.showModal();
    else setStep(2);
  }

  function confirm() {
    const png = padRef.current?.getPng();
    if (!png) return setLocalError("Assine na área indicada antes de confirmar.");
    setLocalError(null);
    const fd = new FormData();
    answers.forEach((a, i) => fd.set(`q${i}`, a ? "sim" : "nao"));
    fd.set("notes", notes);
    fd.set("signaturePng", png);
    fd.set("agree", "on");
    startTransition(() => action(fd));
  }

  if (state.message) {
    const flagged = state.message === "flag";
    return (
      <div className={styles.form}>
        <Alert tone="success">PAR-Q e termo registrados{forMinor && subjectName ? ` para ${subjectName}` : ""}. Obrigado!</Alert>
        {flagged && <Alert tone="danger">{parqAdvice}</Alert>}
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <ol className={styles.steps} aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className={`${styles.stepItem} ${step === i + 1 ? styles.stepOn : ""} ${step > i + 1 ? styles.stepDone : ""}`} aria-current={step === i + 1 ? "step" : undefined}>
            <span className={styles.stepNum}>{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          <ol className={styles.questions}>
            {parqQuestions.map((q, i) => (
              <li key={i} className={styles.question}>
                <p className={styles.text}>{q}</p>
                <div className={styles.choices} role="radiogroup" aria-label={`Pergunta ${i + 1}`}>
                  <label className={styles.choice}><input type="radio" name={`q${i}`} checked={answers[i] === true} onChange={() => setAnswers(answers.map((a, j) => (j === i ? true : a)))} /> Sim</label>
                  <label className={styles.choice}><input type="radio" name={`q${i}`} checked={answers[i] === false} onChange={() => setAnswers(answers.map((a, j) => (j === i ? false : a)))} /> Não</label>
                </div>
              </li>
            ))}
          </ol>
          <label>Observações de saúde (opcional) <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="Lesões, cirurgias, medicamentos, alergias…" /></label>
          {!allAnswered && <p className={styles.hint}>Responda todas as 7 perguntas para avançar.</p>}
          <div><Button type="button" disabled={!allAnswered} onClick={nextFromQuestions}>Avançar</Button></div>
          <dialog ref={alertRef} className={styles.dialog} aria-labelledby="parq-alert-title">
            <h3 id="parq-alert-title">Atenção: atestado médico</h3>
            <p>{parqAdvice}</p>
            <div className={styles.dialogActions}>
              <Button type="button" variant="secondary" onClick={() => alertRef.current?.close()}>Voltar e revisar</Button>
              <Button type="button" onClick={() => { alertRef.current?.close(); setStep(2); }}>Entendi, continuar</Button>
            </div>
          </dialog>
        </>
      )}

      {step === 2 && (
        <>
          <p className={styles.hint}>Leia o termo até o final. Depois de rolar até o fim você poderá marcar que concorda.</p>
          <div
            ref={termRef}
            className={styles.term}
            tabIndex={0}
            role="region"
            aria-label="Termo de responsabilidade de saúde"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadAll(true);
            }}
          >
            <h3>Termo de responsabilidade de saúde</h3>
            <p className={styles.draft}><strong>Texto padrão (rascunho), em revisão jurídica.</strong></p>
            {healthResponsibilityTerm.map((s) => (
              <section key={s.id}>
                <h4>{s.title}</h4>
                {s.paragraphs.map((p) => <p key={p}>{p}</p>)}
              </section>
            ))}
          </div>
          <label className={styles.agree}>
            <input type="checkbox" checked={agree} disabled={!readAll} onChange={(e) => setAgree(e.target.checked)} />
            <span>Declaro que li e concordo com os termos de responsabilidade de saúde acima descritos.</span>
          </label>
          {!readAll && <p className={styles.hint}>Role o texto até o final para liberar a caixa de concordância.</p>}
          <div className={styles.rowActions}>
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>Voltar</Button>
            <Button type="button" disabled={!(readAll && agree)} onClick={() => setStep(3)}>Avançar</Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <p className={styles.hint}>{forMinor ? `Assine como responsável legal por ${subjectName ?? "o menor"}.` : "Assine com o dedo (ou o mouse) na área abaixo."} A assinatura, a data e a hora, o texto do termo, o IP e o navegador ficam guardados como prova do aceite.</p>
          <SignaturePad ref={padRef} onInk={setHasInk} />
          {localError && <Alert tone="danger">{localError}</Alert>}
          {state.error && <Alert tone="danger">{state.error}</Alert>}
          <div className={styles.rowActions}>
            <Button type="button" variant="secondary" onClick={() => setStep(2)} disabled={pending}>Voltar</Button>
            <Button type="button" variant="secondary" onClick={() => padRef.current?.clear()} disabled={pending || !hasInk}>Limpar</Button>
            <Button type="button" loading={pending} disabled={!hasInk} onClick={confirm}>Confirmar assinatura</Button>
          </div>
        </>
      )}
    </div>
  );
}
