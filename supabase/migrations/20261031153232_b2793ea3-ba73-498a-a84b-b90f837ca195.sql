create policy "company read scenario history" on public.audit_logs for select to authenticated
  using (company_id = public.current_company_id() and table_name in ('scenarios','scenario_inputs'));