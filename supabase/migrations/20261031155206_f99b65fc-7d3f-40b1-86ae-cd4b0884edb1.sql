do $$
declare _c uuid; _u uuid;
begin
  select c.id, p.user_id into _c, _u from public.companies c join public.profiles p on p.company_id = c.id
   join public.user_roles r on r.user_id = p.user_id and r.role = 'admin' where c.name = 'ALanda' order by p.created_at limit 1;
  if _c is null then return; end if;
  update public.scenarios set is_locked = false where company_id = _c and is_locked;
  delete from public.scenarios where company_id = _c;
  delete from public.products where company_id = _c;
  delete from public.materials where company_id = _c;
  delete from public.machine_groups where company_id = _c;
  perform public.seed_demo(_c, _u);
end $$;