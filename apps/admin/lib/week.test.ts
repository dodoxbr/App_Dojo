import { test } from "node:test";
import assert from "node:assert/strict";
import { countInWeek, localDay, weekStartLocal } from "./week.ts";

const TZ = "America/Sao_Paulo";

test("a semana começa na segunda-feira local", () => {
  // quarta-feira 2026-10-21 às 15:00 em Brasília
  assert.equal(weekStartLocal(new Date("2026-10-21T18:00:00Z"), TZ), "2026-10-19");
  // segunda-feira 00:30 local (03:30 UTC) ainda é a mesma segunda
  assert.equal(weekStartLocal(new Date("2026-10-19T03:30:00Z"), TZ), "2026-10-19");
  // domingo 23:30 local (02:30 UTC de segunda) ainda é da semana anterior
  assert.equal(weekStartLocal(new Date("2026-10-19T02:30:00Z"), TZ), "2026-10-12");
});

test("o dia local respeita o fuso (e não o UTC)", () => {
  assert.equal(localDay("2026-10-21T02:30:00Z", TZ), "2026-10-20");
  assert.equal(localDay("2026-10-21T12:00:00Z", TZ), "2026-10-21");
});

test("conta só os treinos da semana local, de segunda a domingo", () => {
  const now = new Date("2026-10-21T18:00:00Z");
  const instants = [
    "2026-10-19T12:00:00Z", // segunda: conta
    "2026-10-21T12:00:00Z", // quarta: conta
    "2026-10-25T20:00:00Z", // domingo à noite: conta
    "2026-10-19T02:00:00Z", // domingo anterior 23:00 local: não conta
    "2026-10-26T12:00:00Z", // próxima segunda: não conta
  ];
  assert.equal(countInWeek(instants, now, TZ), 3);
  assert.equal(countInWeek([], now, TZ), 0);
});
