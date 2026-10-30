create type public.app_role as enum ('admin','analyst','viewer');
create type public.version_label as enum ('Actual','Budget','Forecast','Simulation');

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  table_name text not null,
  row_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(company_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

-- helper functions
create or replace function public.current_company_id() returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where user_id = auth.uid()
$$;
create or replace function public.user_company_id(_user_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where user_id = _user_id
$$;
create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.can_edit() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'analyst')
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin')
$$;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'viewer',
  invited_by uuid default auth.uid(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, email)
);
grant select, insert, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;

-- business tables
create table public.machine_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.machines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  group_id uuid not null references public.machine_groups(id) on delete cascade,
  name text not null,
  hours_per_period numeric not null default 160 check (hours_per_period >= 0),
  efficiency numeric not null default 0.85 check (efficiency > 0 and efficiency <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  name text not null,
  price numeric not null default 0 check (price >= 0),
  material_cost numeric not null default 0 check (material_cost >= 0),
  other_throughput_cost numeric not null default 0 check (other_throughput_cost >= 0),
  other_variable_cost numeric not null default 0 check (other_variable_cost >= 0),
  max_demand numeric check (max_demand >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  name text not null,
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  currency text not null default 'USD',
  fx numeric not null default 1 check (fx > 0),
  inflation numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  qty numeric not null default 1 check (qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, material_id)
);
create table public.routings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.machine_groups(id) on delete cascade,
  minutes_per_unit numeric not null default 0 check (minutes_per_unit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, group_id)
);
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  name text not null,
  version_label public.version_label not null default 'Simulation',
  base_scenario_id uuid references public.scenarios(id) on delete set null,
  is_locked boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.scenario_inputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  scenario_id uuid not null unique references public.scenarios(id) on delete cascade,
  volumes jsonb not null default '{}'::jsonb,
  operating_expense numeric not null default 0 check (operating_expense >= 0),
  adjustments jsonb not null default '{}'::jsonb,
  pinned_group_id uuid references public.machine_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- audit trigger
create or replace function public.audit_trigger() returns trigger language plpgsql security definer set search_path = public as $$
declare _c uuid; _r uuid; _b jsonb; _a jsonb;
begin
  if tg_op = 'DELETE' then _b := to_jsonb(old); _c := old.company_id; _r := old.id;
  elsif tg_op = 'UPDATE' then _b := to_jsonb(old); _a := to_jsonb(new); _c := new.company_id; _r := new.id;
  else _a := to_jsonb(new); _c := new.company_id; _r := new.id; end if;
  insert into public.audit_logs(company_id, user_id, table_name, row_id, action, before, after)
  values (_c, auth.uid(), tg_table_name, _r, tg_op, _b, _a);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['machine_groups','machines','products','materials','product_materials','routings','scenarios','scenario_inputs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "company read" on public.%I for select to authenticated using (company_id = public.current_company_id())', t);
    execute format('create policy "editors insert" on public.%I for insert to authenticated with check (company_id = public.current_company_id() and public.can_edit())', t);
    execute format('create policy "editors update" on public.%I for update to authenticated using (company_id = public.current_company_id() and public.can_edit()) with check (company_id = public.current_company_id())', t);
    execute format('create policy "editors delete" on public.%I for delete to authenticated using (company_id = public.current_company_id() and public.can_edit())', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

create trigger set_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.profiles for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.invitations for each row execute function public.audit_trigger();

-- companies audit (row is the company itself)
create or replace function public.audit_company() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(company_id, user_id, table_name, row_id, action, before, after)
  values (new.id, auth.uid(), 'companies', new.id, tg_op, case when tg_op='UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
create trigger audit after insert or update on public.companies for each row execute function public.audit_company();

-- policies: companies / profiles / roles / invitations / audit
create policy "own company read" on public.companies for select to authenticated using (id = public.current_company_id());
create policy "admin update company" on public.companies for update to authenticated using (id = public.current_company_id() and public.is_admin()) with check (id = public.current_company_id());

create policy "company profiles read" on public.profiles for select to authenticated using (company_id = public.current_company_id());
create policy "update own or admin" on public.profiles for update to authenticated
  using (company_id = public.current_company_id() and (user_id = auth.uid() or public.is_admin()))
  with check (company_id = public.current_company_id());
create policy "admin remove others" on public.profiles for delete to authenticated
  using (company_id = public.current_company_id() and public.is_admin() and user_id <> auth.uid());

create policy "company roles read" on public.user_roles for select to authenticated using (public.user_company_id(user_id) = public.current_company_id());
create policy "admin update roles" on public.user_roles for update to authenticated
  using (public.is_admin() and public.user_company_id(user_id) = public.current_company_id())
  with check (public.user_company_id(user_id) = public.current_company_id());
create policy "admin delete roles" on public.user_roles for delete to authenticated
  using (public.is_admin() and public.user_company_id(user_id) = public.current_company_id());

create policy "admin read invites" on public.invitations for select to authenticated using (company_id = public.current_company_id() and public.is_admin());
create policy "admin create invites" on public.invitations for insert to authenticated with check (company_id = public.current_company_id() and public.is_admin());
create policy "admin delete invites" on public.invitations for delete to authenticated using (company_id = public.current_company_id() and public.is_admin());

create policy "admin read audit" on public.audit_logs for select to authenticated using (company_id = public.current_company_id() and public.is_admin());

-- last admin protection + role audit
create or replace function public.protect_last_admin() returns trigger language plpgsql security definer set search_path = public as $$
declare _company uuid; _remaining int;
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    _company := public.user_company_id(old.user_id);
    if _company is not null then
      select count(*) into _remaining from public.user_roles ur join public.profiles p on p.user_id = ur.user_id
       where p.company_id = _company and ur.role = 'admin' and ur.user_id <> old.user_id;
      if _remaining = 0 then raise exception 'The last Admin of a company cannot be removed or demoted'; end if;
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger protect_last_admin before update or delete on public.user_roles for each row execute function public.protect_last_admin();

create or replace function public.audit_roles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(company_id, user_id, table_name, row_id, action, before, after)
  values (public.user_company_id(coalesce(new.user_id, old.user_id)), auth.uid(), 'user_roles', coalesce(new.id, old.id),
          case when tg_op = 'UPDATE' then 'ROLE_CHANGE' else tg_op end,
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit after insert or update or delete on public.user_roles for each row execute function public.audit_roles();

-- locked scenarios enforced in the database
create or replace function public.guard_scenario() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.is_locked then raise exception 'Scenario "%" is locked and cannot be deleted', old.name; end if;
    return old;
  end if;
  if new.is_locked is distinct from old.is_locked then
    if auth.uid() is not null and not (public.is_admin() or (public.has_role(auth.uid(),'analyst') and old.created_by = auth.uid())) then
      raise exception 'Only an Admin or the Analyst who created this scenario can lock or unlock it';
    end if;
    if (to_jsonb(new) - 'is_locked' - 'updated_at') <> (to_jsonb(old) - 'is_locked' - 'updated_at') then
      raise exception 'Change the lock state on its own, without other edits';
    end if;
    insert into public.audit_logs(company_id, user_id, table_name, row_id, action, before, after)
    values (new.company_id, auth.uid(), 'scenarios', new.id, case when new.is_locked then 'LOCK' else 'UNLOCK' end,
            jsonb_build_object('is_locked', old.is_locked), jsonb_build_object('is_locked', new.is_locked));
    return new;
  end if;
  if old.is_locked then raise exception 'Scenario "%" is locked', old.name; end if;
  return new;
end $$;
create trigger guard_scenario before update or delete on public.scenarios for each row execute function public.guard_scenario();

create or replace function public.guard_scenario_inputs() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.scenarios where id = coalesce(new.scenario_id, old.scenario_id) and is_locked) then
    raise exception 'This scenario is locked; its inputs cannot be changed';
  end if;
  return coalesce(new, old);
end $$;
create trigger guard_scenario_inputs before insert or update or delete on public.scenario_inputs for each row execute function public.guard_scenario_inputs();

-- events (login etc.)
create or replace function public.log_event(_action text, _details jsonb default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if _action not in ('LOGIN','LOGOUT','EXPORT') then raise exception 'Unsupported event'; end if;
  insert into public.audit_logs(company_id, user_id, table_name, row_id, action, after)
  values (public.current_company_id(), auth.uid(), 'auth', auth.uid(), _action, _details);
end $$;

-- demo data for a new company
create or replace function public.seed_demo(_company uuid, _user uuid) returns void language plpgsql security definer set search_path = public as $$
declare g_cnc uuid; g_asm uuid; g_paint uuid; pa uuid; pb uuid; pc uuid; pd uuid; m_steel uuid; m_alu uuid; m_paint uuid; s_act uuid; s_bud uuid; s_sim uuid;
begin
  insert into machine_groups(company_id,name) values (_company,'CNC') returning id into g_cnc;
  insert into machine_groups(company_id,name) values (_company,'Assembly') returning id into g_asm;
  insert into machine_groups(company_id,name) values (_company,'Paint') returning id into g_paint;
  insert into machines(company_id,group_id,name,hours_per_period,efficiency) values
    (_company,g_cnc,'CNC Mill 1',176,0.91),(_company,g_cnc,'CNC Mill 2',176,0.91),
    (_company,g_asm,'Assembly Line',176,0.95),(_company,g_paint,'Paint Booth',160,0.8);

  insert into products(company_id,name,price,material_cost,other_throughput_cost,other_variable_cost,max_demand) values (_company,'Bracket A',120,40,5,10,900) returning id into pa;
  insert into products(company_id,name,price,material_cost,other_throughput_cost,other_variable_cost,max_demand) values (_company,'Housing B',260,110.04,10,20,400) returning id into pb;
  insert into products(company_id,name,price,material_cost,other_throughput_cost,other_variable_cost,max_demand) values (_company,'Gear Kit C',180,50,8,15,600) returning id into pc;
  insert into products(company_id,name,price,material_cost,other_throughput_cost,other_variable_cost,max_demand) values (_company,'Panel D',90,35,4,8,700) returning id into pd;

  insert into materials(company_id,name,unit_cost,currency,fx,inflation) values (_company,'Steel sheet (kg)',4,'USD',1,0) returning id into m_steel;
  insert into materials(company_id,name,unit_cost,currency,fx,inflation) values (_company,'Aluminium (kg)',22,'EUR',1.08,0) returning id into m_alu;
  insert into materials(company_id,name,unit_cost,currency,fx,inflation) values (_company,'Powder coat (kg)',30,'USD',1,0) returning id into m_paint;
  insert into product_materials(company_id,product_id,material_id,qty) values (_company,pb,m_alu,4),(_company,pb,m_paint,0.5);

  insert into routings(company_id,product_id,group_id,minutes_per_unit) values
    (_company,pa,g_cnc,12),(_company,pa,g_asm,4),(_company,pa,g_paint,3),
    (_company,pb,g_cnc,20),(_company,pb,g_asm,6),(_company,pb,g_paint,5),
    (_company,pc,g_cnc,8),(_company,pc,g_asm,10),(_company,pc,g_paint,2),
    (_company,pd,g_cnc,5),(_company,pd,g_asm,3),(_company,pd,g_paint,4);

  insert into scenarios(company_id,name,version_label,created_by) values (_company,'Actual — this month','Actual',_user) returning id into s_act;
  insert into scenario_inputs(company_id,scenario_id,volumes,operating_expense) values
    (_company,s_act,jsonb_build_object(pa,700,pb,300,pc,250,pd,500),60000);
  insert into scenarios(company_id,name,version_label,base_scenario_id,created_by) values (_company,'Budget — next month','Budget',s_act,_user) returning id into s_bud;
  insert into scenario_inputs(company_id,scenario_id,volumes,operating_expense) values
    (_company,s_bud,jsonb_build_object(pa,720,pb,310,pc,260,pd,480),62000);
  insert into scenarios(company_id,name,version_label,base_scenario_id,created_by) values (_company,'Push Gear Kits + 3% price','Simulation',s_act,_user) returning id into s_sim;
  insert into scenario_inputs(company_id,scenario_id,volumes,operating_expense,adjustments) values
    (_company,s_sim,jsonb_build_object(pa,700,pb,300,pc,250,pd,500),60000,
     jsonb_build_object('price',jsonb_build_object('all',0.03),'mixShift',jsonb_build_array(jsonb_build_object('productId',pc,'deltaPoints',0.10))));
  update scenarios set is_locked = true where id = s_act;
end $$;
revoke execute on function public.seed_demo(uuid, uuid) from public, anon, authenticated;

-- signup: invited users join; others create a company and become Admin
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare _inv public.invitations; _company uuid;
begin
  select * into _inv from public.invitations where lower(email) = lower(new.email) and accepted_at is null order by created_at desc limit 1;
  if found then
    insert into public.profiles(user_id, company_id, full_name, email) values (new.id, _inv.company_id, new.raw_user_meta_data->>'full_name', new.email);
    insert into public.user_roles(user_id, role) values (new.id, _inv.role);
    update public.invitations set accepted_at = now() where id = _inv.id;
  else
    insert into public.companies(name) values (coalesce(nullif(new.raw_user_meta_data->>'company_name',''), 'My company')) returning id into _company;
    insert into public.profiles(user_id, company_id, full_name, email) values (new.id, _company, new.raw_user_meta_data->>'full_name', new.email);
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
    perform public.seed_demo(_company, new.id);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();