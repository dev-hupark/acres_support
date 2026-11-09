-- Additive migration: no changes to existing party data or functions.
begin;
create table public.acres_party_map_entries (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.acres_parties(id),
  alias text not null check(length(btrim(alias)) between 1 and 80),
  x integer not null check(x between 0 and 600),
  y integer not null check(y between 0 and 600),
  memo text not null default '' check(length(memo)<=2000),
  is_dead char(1) not null default 'N' check(is_dead in ('Y','N')),
  faction text not null check(faction in ('FRIENDLY','ENEMY','ALLIANCE','NEUTRAL','OTHER')),
  status text not null default 'ACTIVE' check(status in ('ACTIVE','DELETED')),
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(faction='OTHER' or (x<=599 and y<=599))
);
create index acres_party_map_active_idx on public.acres_party_map_entries(party_id,x,y) where status='ACTIVE';
alter table public.acres_party_map_entries enable row level security;
revoke all on public.acres_party_map_entries from public,anon,authenticated;
-- All reads and mutations pass through RPC; no client-supplied acting user IDs.

create function public.acres_map_list(p_party uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform acres_private.require_user();
  if not acres_private.approved(p_party) or not exists(select 1 from public.acres_parties where id=p_party) then
    raise exception '승인된 파티원만 맵을 조회할 수 있습니다.' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at,e.id),'[]'::jsonb)
    from public.acres_party_map_entries e where e.party_id=p_party and e.status='ACTIVE');
end $$;

create function public.acres_map_save(
  p_party uuid,p_alias text,p_x integer,p_y integer,p_memo text,p_is_dead text,p_faction text,
  p_id uuid default null,p_version integer default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.acres_party_map_entries; extent integer;
begin
  -- The party lock serializes overlap checks, creates, updates, deletes and dissolution.
  perform acres_private.lock_party(p_party);
  if not acres_private.approved(p_party) then
    raise exception '승인된 파티원만 맵을 수정할 수 있습니다.' using errcode='42501';
  end if;
  if p_alias is null or length(btrim(p_alias)) not between 1 and 80 then raise exception '별칭은 1~80자로 입력하세요.'; end if;
  if p_faction is null or p_faction not in ('FRIENDLY','ENEMY','ALLIANCE','NEUTRAL','OTHER') then raise exception '세력을 선택하세요.'; end if;
  if p_is_dead is null or p_is_dead not in ('Y','N') then raise exception '사망 여부는 Y 또는 N이어야 합니다.'; end if;
  extent:=case when p_faction='OTHER' then 1 else 2 end;
  if p_x is null or p_y is null or p_x<0 or p_y<0 or p_x+extent-1>600 or p_y+extent-1>600 then
    raise exception '기타 좌표는 0~600, 2×2 항목의 시작 좌표는 0~599로 입력하세요.';
  end if;
  if p_id is not null then
    select * into e from public.acres_party_map_entries where id=p_id and party_id=p_party and status='ACTIVE' for update;
    if not found then raise exception '맵 항목을 찾을 수 없거나 이미 삭제되었습니다.'; end if;
    if p_version is null or p_version<>e.version then
      raise exception '다른 회원이 수정했습니다. 최신 정보를 확인한 후 다시 저장하세요.' using errcode='40001';
    end if;
  end if;
  if exists(select 1 from public.acres_party_map_entries other where other.party_id=p_party and other.status='ACTIVE'
    and (p_id is null or other.id<>p_id)
    and other.x<p_x+extent and p_x<other.x+case when other.faction='OTHER' then 1 else 2 end
    and other.y<p_y+extent and p_y<other.y+case when other.faction='OTHER' then 1 else 2 end) then
    raise exception '다른 항목이 점유한 칸입니다. 겹치지 않는 좌표를 선택하세요.';
  end if;
  if p_id is null then
    insert into public.acres_party_map_entries(party_id,alias,x,y,memo,is_dead,faction)
    values(p_party,btrim(p_alias),p_x,p_y,coalesce(p_memo,''),p_is_dead,p_faction) returning * into e;
  else
    update public.acres_party_map_entries set alias=btrim(p_alias),x=p_x,y=p_y,memo=coalesce(p_memo,''),
      is_dead=p_is_dead,faction=p_faction,version=version+1,updated_at=clock_timestamp()
      where id=p_id and party_id=p_party returning * into e;
  end if;
  return to_jsonb(e);
end $$;

create function public.acres_map_delete(p_party uuid,p_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare e public.acres_party_map_entries;
begin
  perform acres_private.lock_party(p_party);
  if not acres_private.approved(p_party) then
    raise exception '승인된 파티원만 맵을 삭제할 수 있습니다.' using errcode='42501';
  end if;
  select * into e from public.acres_party_map_entries where id=p_id and party_id=p_party and status='ACTIVE' for update;
  if not found then raise exception '맵 항목을 찾을 수 없거나 이미 삭제되었습니다.'; end if;
  if p_version is null or p_version<>e.version then
    raise exception '다른 회원이 수정했습니다. 최신 정보를 확인한 후 다시 삭제하세요.' using errcode='40001';
  end if;
  update public.acres_party_map_entries set status='DELETED',version=version+1,updated_at=clock_timestamp() where id=e.id;
end $$;

revoke all on function public.acres_map_list(uuid),public.acres_map_save(uuid,text,integer,integer,text,text,text,uuid,integer),public.acres_map_delete(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.acres_map_list(uuid),public.acres_map_save(uuid,text,integer,integer,text,text,text,uuid,integer),public.acres_map_delete(uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
