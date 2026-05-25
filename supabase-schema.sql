create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  price text not null,
  images text[] not null default '{}',
  status text not null default 'Available' check (status in ('Available', 'Sold')),
  created_at timestamptz not null default now()
);

alter table public.properties
add column if not exists location text not null default '';

alter table public.properties
add column if not exists category text not null default '';

alter table public.properties
add column if not exists bedrooms int;

alter table public.properties
add column if not exists bathrooms int;

alter table public.properties
add column if not exists featured boolean not null default false;

alter table public.properties
add column if not exists media jsonb not null default '[]'::jsonb;

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.properties enable row level security;
alter table public.promos enable row level security;
alter table public.admins enable row level security;

create index if not exists properties_created_at_idx
on public.properties (created_at desc);

create index if not exists properties_status_idx
on public.properties (status);

create index if not exists properties_location_idx
on public.properties (location);

drop policy if exists "Public can read properties" on public.properties;
create policy "Public can read properties"
on public.properties for select
using (true);

drop policy if exists "Public can insert properties" on public.properties;
create policy "Admins can insert properties"
on public.properties for insert
to authenticated
with check (exists (
  select 1 from public.admins where admins.user_id = auth.uid()
));

drop policy if exists "Public can update properties" on public.properties;
create policy "Admins can update properties"
on public.properties for update
to authenticated
using (exists (
  select 1 from public.admins where admins.user_id = auth.uid()
))
with check (exists (
  select 1 from public.admins where admins.user_id = auth.uid()
));

drop policy if exists "Public can delete properties" on public.properties;
create policy "Admins can delete properties"
on public.properties for delete
to authenticated
using (exists (
  select 1 from public.admins where admins.user_id = auth.uid()
));

drop policy if exists "Public can read promos" on public.promos;
create policy "Public can read promos"
on public.promos for select
using (true);

drop policy if exists "Public can insert promos" on public.promos;
create policy "Admins can insert promos"
on public.promos for insert
to authenticated
with check (exists (
  select 1 from public.admins where admins.user_id = auth.uid()
));

drop policy if exists "Public can delete promos" on public.promos;
create policy "Admins can delete promos"
on public.promos for delete
to authenticated
using (exists (
  select 1 from public.admins where admins.user_id = auth.uid()
));

drop policy if exists "Admins can read admins" on public.admins;
create policy "Admins can read admins"
on public.admins for select
to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('promo-images', 'promo-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read property images" on storage.objects;
create policy "Public can read property images"
on storage.objects for select
using (bucket_id = 'property-images');

drop policy if exists "Public can upload property images" on storage.objects;
create policy "Admins can upload property images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-images'
  and exists (select 1 from public.admins where admins.user_id = auth.uid())
);

drop policy if exists "Public can read promo images" on storage.objects;
create policy "Public can read promo images"
on storage.objects for select
using (bucket_id = 'promo-images');

drop policy if exists "Public can upload promo images" on storage.objects;
create policy "Admins can upload promo images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'promo-images'
  and exists (select 1 from public.admins where admins.user_id = auth.uid())
);
