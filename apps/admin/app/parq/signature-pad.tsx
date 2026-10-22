"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import styles from "./parq.module.css";

export type SignaturePadHandle = { getPng: () => string | null; clear: () => void };

// Área de assinatura: desenha com o dedo ou o mouse (eventos de ponteiro). Devolve a assinatura em PNG (data URL) e avisa se há traço.
export const SignaturePad = forwardRef<SignaturePadHandle, { onInk?: (hasInk: boolean) => void }>(function SignaturePad({ onInk }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * ratio);
    c.height = Math.round(h * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e1a27";
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setHasInk(false);
    onInk?.(false);
  }, [onInk]);

  useImperativeHandle(ref, () => ({
    clear,
    getPng: () => {
      const c = canvas.current;
      if (!c || !hasInk) return null;
      // Fundo branco: a imagem fica legível em qualquer visualizador.
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const octx = out.getContext("2d");
      if (!octx) return null;
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(c, 0, 0);
      return out.toDataURL("image/png");
    },
  }), [clear, hasInk]);

  return (
    <div className={styles.padWrap}>
      <canvas
        ref={canvas}
        className={styles.pad}
        aria-label="Área de assinatura: desenhe a sua assinatura com o dedo ou o mouse"
        role="img"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d");
          const p = point(e);
          ctx?.beginPath();
          ctx?.moveTo(p.x, p.y);
          ctx?.lineTo(p.x + 0.01, p.y + 0.01);
          ctx?.stroke();
          if (!hasInk) {
            setHasInk(true);
            onInk?.(true);
          }
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d");
          const p = point(e);
          ctx?.lineTo(p.x, p.y);
          ctx?.stroke();
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      />
      {!hasInk && <span className={styles.padHint} aria-hidden="true">Assine aqui</span>}
    </div>
  );
});
