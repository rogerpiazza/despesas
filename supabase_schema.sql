-- =============================================
-- Schema: Controle de Despesas
-- Execute no Supabase SQL Editor
-- =============================================

-- Pessoas
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Fontes de renda recorrentes de cada pessoa
create table if not exists income_sources (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  name text not null,
  expected_day int check (expected_day between 1 and 31),
  created_at timestamptz default now()
);

-- Rendas reais lançadas por mês
create table if not exists income_entries (
  id uuid primary key default gen_random_uuid(),
  income_source_id uuid not null references income_sources(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  received_date date not null,
  month_year text not null, -- formato: 'YYYY-MM'
  created_at timestamptz default now()
);

-- Contas fixas recorrentes
create table if not exists fixed_bills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  due_day int not null check (due_day between 1 and 31),
  estimated_amount numeric(12,2),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Valores reais e pagamentos de contas fixas por mês
create table if not exists bill_month_entries (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references fixed_bills(id) on delete cascade,
  month_year text not null,
  amount numeric(12,2) not null default 0,
  paid_by uuid references people(id),
  paid_date date,
  created_at timestamptz default now(),
  unique (bill_id, month_year)
);

-- Gastos extras
create table if not exists extra_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid not null references people(id),
  expense_date date not null,
  month_year text not null,
  created_at timestamptz default now()
);

-- =============================================
-- RLS: Permite acesso público (app sem login)
-- =============================================

alter table people enable row level security;
alter table income_sources enable row level security;
alter table income_entries enable row level security;
alter table fixed_bills enable row level security;
alter table bill_month_entries enable row level security;
alter table extra_expenses enable row level security;

-- Políticas permissivas para anon (acesso compartilhado sem login)
create policy "allow all people" on people for all to anon using (true) with check (true);
create policy "allow all income_sources" on income_sources for all to anon using (true) with check (true);
create policy "allow all income_entries" on income_entries for all to anon using (true) with check (true);
create policy "allow all fixed_bills" on fixed_bills for all to anon using (true) with check (true);
create policy "allow all bill_month_entries" on bill_month_entries for all to anon using (true) with check (true);
create policy "allow all extra_expenses" on extra_expenses for all to anon using (true) with check (true);
