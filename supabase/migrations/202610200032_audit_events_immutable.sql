-- Auditoria (docs/STATUS_PROJETO_DOJO.md, achado M-03): a trilha de auditoria passa a ser append-only, como promotions, manual_assessments e
-- charge_events. Nenhuma funcao do sistema altera ou apaga eventos (so inserem); a trava vale ate para papeis privilegiados.
create trigger audit_events_immutable before update or delete on public.audit_events
  for each row execute function public.prevent_mutation();
