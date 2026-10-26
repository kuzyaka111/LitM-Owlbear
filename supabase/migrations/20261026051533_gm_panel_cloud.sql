create table public.gm_panels (
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id text not null check (length(room_id) between 1 and 160),
  document jsonb not null check (
    jsonb_typeof(document) = 'object'
    and document->>'gmSchema' = '1'
    and jsonb_typeof(document->'scenes') = 'array'
    and jsonb_typeof(document->'groups') = 'array'
    and jsonb_typeof(document->'library') = 'array'
    and octet_length(document::text) <= 4000000
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, room_id)
);
alter table public.gm_panels enable row level security;
revoke all on public.gm_panels from anon;
grant select, insert, update on public.gm_panels to authenticated;
create policy "GM reads own panels" on public.gm_panels for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "GM creates own panels" on public.gm_panels for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "GM updates own panels" on public.gm_panels for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create function public.save_gm_panel(p_room_id text, p_expected_revision bigint, p_document jsonb)
returns public.gm_panels language plpgsql security invoker set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_saved public.gm_panels;
begin
  if v_owner is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Expected revision required';
  end if;
  if p_expected_revision = 0 then
    insert into public.gm_panels(owner_id, room_id, document)
    values (v_owner, p_room_id, p_document)
    on conflict (owner_id, room_id) do nothing returning * into v_saved;
  else
    update public.gm_panels
    set document = p_document, revision = revision + 1, updated_at = now()
    where owner_id = v_owner and room_id = p_room_id and revision = p_expected_revision
    returning * into v_saved;
  end if;
  if not found then
    raise exception using errcode = '40001', message = 'Panel changed on another device';
  end if;
  return v_saved;
end;
$$;
revoke all on function public.save_gm_panel(text,bigint,jsonb) from public, anon;
grant execute on function public.save_gm_panel(text,bigint,jsonb) to authenticated;
