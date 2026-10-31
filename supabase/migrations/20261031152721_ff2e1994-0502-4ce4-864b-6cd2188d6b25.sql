alter table public.companies add column fiscal_year_start smallint not null default 1 check (fiscal_year_start between 1 and 12);
alter table public.profiles add column is_active boolean not null default true;

create or replace function public.current_company_id() returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where user_id = auth.uid() and is_active
$$;

create or replace function public.protect_last_active_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.is_active and not new.is_active and public.has_role(old.user_id, 'admin') then
    if not exists (select 1 from public.profiles p join public.user_roles r on r.user_id = p.user_id
                   where p.company_id = old.company_id and p.is_active and r.role = 'admin' and p.user_id <> old.user_id) then
      raise exception 'The last Admin of a company cannot be deactivated';
    end if;
  end if;
  return new;
end $$;
create trigger protect_last_active_admin before update on public.profiles for each row execute function public.protect_last_active_admin();
revoke execute on function public.protect_last_active_admin() from public, anon, authenticated;

create or replace function public.seed_demo(_company uuid, _user uuid) returns void language plpgsql security definer set search_path = public as $$
declare g_cnc uuid; g_asm uuid; pa uuid; pb uuid; pc uuid; s_act uuid; s uuid; vols jsonb;
begin
  insert into machine_groups(company_id,name) values (_company,'CNC Machining') returning id into g_cnc;
  insert into machine_groups(company_id,name) values (_company,'Assembly') returning id into g_asm;
  insert into machines(company_id,group_id,name,hours_per_period,efficiency) values
    (_company,g_cnc,'CNC 1',160,0.85),(_company,g_cnc,'CNC 2',160,0.85),
    (_company,g_asm,'Assembly 1',160,0.90),(_company,g_asm,'Assembly 2',160,0.90);
  insert into products(company_id,name,price,material_cost,other_variable_cost) values (_company,'A',100,40,5) returning id into pa;
  insert into products(company_id,name,price,material_cost,other_variable_cost) values (_company,'B',150,90,10) returning id into pb;
  insert into products(company_id,name,price,material_cost,other_variable_cost) values (_company,'C',80,30,0) returning id into pc;
  insert into routings(company_id,product_id,group_id,minutes_per_unit) values
    (_company,pa,g_cnc,6),(_company,pa,g_asm,3),
    (_company,pb,g_cnc,12),(_company,pb,g_asm,2),
    (_company,pc,g_cnc,3),(_company,pc,g_asm,6);
  vols := jsonb_build_object(pa,1000,pb,600,pc,1500);

  insert into scenarios(company_id,name,version_label,created_by) values (_company,'Actual','Actual',_user) returning id into s_act;
  insert into scenario_inputs(company_id,scenario_id,volumes,operating_expense) values (_company,s_act,vols,100000);
  insert into scenarios(company_id,name,version_label,base_scenario_id,created_by) values (_company,'Budget','Budget',s_act,_user) returning id into s;
  insert into scenario_inputs(company_id,scenario_id,volumes,operating_expense) values (_company,s,vols,100000);
  insert into scenarios(company_id,name,version_label,base_scenario_id,created_by) values (_company,'Forecast','Forecast',s_act,_user) returning id into s;
  insert into scenario_inputs(company_id,scenario_id,volumes,operating_expense,adjustments) values (_company,s,vols,100000,
    jsonb_build_object('volume',jsonb_build_object('all',-0.05)));
  insert into scenarios(company_id,name,version_label,base_scenario_id,created_by) values (_company,'Simulation','Simulation',s_act,_user) returning id into s;
  insert into scenario_inputs(company_id,scenario_id,volumes,operating_expense,adjustments) values (_company,s,vols,100000,
    jsonb_build_object('price',jsonb_build_object('all',0.03),'mixShift',jsonb_build_array(jsonb_build_object('productId',pc,'deltaPoints',0.05))));
end $$;
revoke execute on function public.seed_demo(uuid, uuid) from public, anon, authenticated;