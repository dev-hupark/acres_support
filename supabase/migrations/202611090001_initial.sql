-- Initial installation for an empty Supabase project. Run the entire file once.
-- Scope: members, characters and GENERAL parties. Alliance/calendar are later migrations.
begin;
create schema if not exists acres_private;
revoke all on schema acres_private from public;

create table public.acres_users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  role text not null default 'USER' check (role in ('USER','ADMIN')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DELETING','DELETED')),
  main_character_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.acres_characters (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.acres_users,
  game_uid text unique check (length(game_uid) between 1 and 80 and game_uid=btrim(game_uid)),
  name text check (length(btrim(name)) between 1 and 60),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DELETED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,id), check (status='DELETED' or (game_uid is not null and name is not null))
);
alter table public.acres_users add constraint acres_main_owned_fk
  foreign key(id, main_character_id) references public.acres_characters(user_id,id) deferrable initially deferred;
create table public.acres_troops (
  code text primary key check(length(code) between 1 and 40),
  name text not null check(length(name) between 1 and 60), sort_order integer not null default 0
);
-- No invented troop codes. Operator supplies the real game troop catalogue.
create table public.acres_parties (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.acres_users,
  name text not null check(length(btrim(name)) between 1 and 100),
  departure_date date not null, deadline_at timestamptz not null,
  applications_closed boolean not null default false,
  scope text not null default 'GENERAL' check(scope='GENERAL'),
  status text not null default 'ACTIVE' check(status in ('ACTIVE','DISSOLVED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.acres_party_members (
  id uuid primary key default gen_random_uuid(), party_id uuid not null references public.acres_parties,
  user_id uuid not null references public.acres_users,
  status text not null check(status in ('PENDING','APPROVED','REJECTED','CANCELED','LEFT','KICKED')),
  is_manager boolean not null default false, blocked boolean not null default false,
  memo text check(length(memo)<=1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(party_id,user_id), unique(party_id,id,user_id),
  check(not is_manager or status='APPROVED')
);
create table public.acres_party_characters (
  id uuid primary key default gen_random_uuid(), party_id uuid not null references public.acres_parties,
  member_id uuid not null, user_id uuid not null, character_id uuid not null,
  status text not null default 'APPROVED' check(status in ('APPROVED','REMOVED_BY_USER','EXCLUDED_BY_ADMIN','PENDING_REAPPROVAL')),
  troop1 text references public.acres_troops, troop2 text references public.acres_troops,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(party_id,member_id,user_id) references public.acres_party_members(party_id,id,user_id),
  foreign key(user_id,character_id) references public.acres_characters(user_id,id),
  unique(party_id,character_id), check(troop1 is null or troop2 is null or troop1<>troop2)
);
create table public.acres_schedules (
  id uuid primary key default gen_random_uuid(), participation_id uuid not null references public.acres_party_characters,
  war_date date not null, status text not null check(status in ('ABSENT','PARTIAL')),
  memo text check(length(memo)<=1000),
  check(status<>'PARTIAL' or length(btrim(coalesce(memo,'')))>0), unique(participation_id,war_date),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.acres_notices (
  id uuid primary key default gen_random_uuid(), party_id uuid not null references public.acres_parties,
  author_id uuid references public.acres_users, title text not null check(length(btrim(title)) between 1 and 150),
  body text not null check(length(btrim(body)) between 1 and 10000), pinned boolean not null default false,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','DELETED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.acres_parties(status,departure_date);
create index on public.acres_party_members(user_id,status);
create index on public.acres_party_characters(character_id,status);
create index on public.acres_notices(party_id,status,pinned);

create function acres_private.current_user_id() returns uuid language sql stable security definer set search_path=''
as $$ select id from public.acres_users where auth_id=auth.uid() and status='ACTIVE' $$;
create function acres_private.is_admin() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.acres_users where id=acres_private.current_user_id() and role='ADMIN') $$;
create function acres_private.approved(p_party uuid) returns boolean language sql stable security definer set search_path=''
as $$ select acres_private.is_admin() or exists(select 1 from public.acres_party_members where party_id=p_party and user_id=acres_private.current_user_id() and status='APPROVED') $$;
create function acres_private.manages(p_party uuid) returns boolean language sql stable security definer set search_path=''
as $$ select acres_private.is_admin() or exists(select 1 from public.acres_parties where id=p_party and owner_id=acres_private.current_user_id()) or exists(select 1 from public.acres_party_members where party_id=p_party and user_id=acres_private.current_user_id() and status='APPROVED' and is_manager) $$;
create function acres_private.require_user() returns uuid language plpgsql stable security definer set search_path='' as $$
declare v uuid:=acres_private.current_user_id();
begin if v is null then raise exception '로그인과 최초 캐릭터 등록이 필요합니다.' using errcode='42501'; end if; return v; end $$;

-- Lock order: party -> user -> character. All party mutations serialize on party.
create function acres_private.lock_party(p_party uuid) returns public.acres_parties language plpgsql security definer set search_path='' as $$
declare p public.acres_parties;
begin
  perform acres_private.require_user();
  select * into p from public.acres_parties where id=p_party for update;
  if not found then raise exception '파티를 찾을 수 없습니다.'; end if;
  if p.status<>'ACTIVE' then raise exception '해체된 파티는 변경할 수 없습니다.'; end if;
  return p;
end $$;

create function public.acres_onboard(p_name text,p_game_uid text) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid; c uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.' using errcode='42501'; end if;
  if p_name is null or p_game_uid is null then raise exception '캐릭터명과 게임 UID가 필요합니다.'; end if;
  insert into public.acres_users(auth_id) values(auth.uid()) returning id into u;
  insert into public.acres_characters(user_id,name,game_uid) values(u,btrim(p_name),btrim(p_game_uid)) returning id into c;
  update public.acres_users set main_character_id=c where id=u;
  return u;
end $$;

create function public.acres_character_save(p_name text,p_game_uid text,p_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); c uuid;
begin
  perform 1 from public.acres_users where id=u for update;
  if p_name is null or p_game_uid is null then raise exception '캐릭터명과 게임 UID가 필요합니다.'; end if;
  if p_id is null then
    insert into public.acres_characters(user_id,name,game_uid) values(u,btrim(p_name),btrim(p_game_uid)) returning id into c;
    update public.acres_users set main_character_id=coalesce(main_character_id,c),updated_at=now() where id=u;
  else
    update public.acres_characters set name=btrim(p_name),game_uid=btrim(p_game_uid),updated_at=now() where id=p_id and user_id=u and status='ACTIVE' returning id into c;
    if not found then raise exception '캐릭터를 찾을 수 없습니다.'; end if;
  end if;
  return c;
end $$;
create function public.acres_character_action(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); replacement uuid;
begin
  perform 1 from public.acres_users where id=u for update;
  perform 1 from public.acres_characters where id=p_id and user_id=u and status='ACTIVE' for update;
  if not found then raise exception '캐릭터를 찾을 수 없습니다.'; end if;
  if p_action='main' then update public.acres_users set main_character_id=p_id,updated_at=now() where id=u;
  elsif p_action='delete' then
    if exists(select 1 from public.acres_party_characters pc join public.acres_parties p on p.id=pc.party_id where pc.character_id=p_id and pc.status in ('APPROVED','PENDING_REAPPROVAL') and p.status='ACTIVE') then raise exception '파티 참여 또는 재승인 대기 중인 캐릭터는 삭제할 수 없습니다.'; end if;
    select id into replacement from public.acres_characters where user_id=u and id<>p_id and status='ACTIVE' order by created_at,id limit 1;
    update public.acres_users set main_character_id=replacement,updated_at=now() where id=u and main_character_id=p_id;
    update public.acres_characters set status='DELETED',name=null,game_uid=null,updated_at=now() where id=p_id;
  else raise exception '지원하지 않는 작업입니다.'; end if;
end $$;

create function public.acres_party_create(p_name text,p_departure date,p_deadline timestamptz,p_characters uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); p uuid; m uuid; c uuid;
begin
  perform 1 from public.acres_users where id=u for update;
  if p_departure<(now() at time zone 'Asia/Seoul')::date then raise exception '출발일은 오늘 이후여야 합니다.'; end if;
  if coalesce(cardinality(p_characters),0)=0 then raise exception '참여 캐릭터를 1개 이상 선택하세요.'; end if;
  insert into public.acres_parties(owner_id,name,departure_date,deadline_at) values(u,btrim(p_name),p_departure,p_deadline) returning id into p;
  insert into public.acres_party_members(party_id,user_id,status) values(p,u,'APPROVED') returning id into m;
  foreach c in array p_characters loop
    perform 1 from public.acres_characters where id=c and user_id=u and status='ACTIVE' for update;
    if not found then raise exception '본인 캐릭터만 선택할 수 있습니다.'; end if;
    insert into public.acres_party_characters(party_id,member_id,user_id,character_id) values(p,m,u,c);
  end loop;
  return p;
end $$;

create function public.acres_party_apply(p_party uuid,p_memo text default '') returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); p public.acres_parties; m public.acres_party_members;
begin
  p:=acres_private.lock_party(p_party);
  perform 1 from public.acres_users where id=u for update;
  if p.applications_closed then raise exception '생성자가 모집을 마감했습니다.'; end if;
  if not exists(select 1 from public.acres_characters where user_id=u and status='ACTIVE') then raise exception '캐릭터를 먼저 등록해 주세요.'; end if;
  select * into m from public.acres_party_members where party_id=p_party and user_id=u for update;
  if m.blocked then raise exception '강퇴 차단 해제가 필요합니다.'; end if;
  if m.status in ('PENDING','APPROVED') then raise exception '이미 신청하거나 참여 중입니다.'; end if;
  insert into public.acres_party_members(party_id,user_id,status,memo) values(p_party,u,'PENDING',p_memo)
    on conflict(party_id,user_id) do update set status='PENDING',memo=excluded.memo,is_manager=false,updated_at=now();
end $$;

create function public.acres_member_action(p_party uuid,p_member uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); p public.acres_parties; m public.acres_party_members; manager boolean;
begin
  p:=acres_private.lock_party(p_party); manager:=acres_private.manages(p_party);
  select * into m from public.acres_party_members where id=p_member and party_id=p_party for update;
  if not found then raise exception '신청 회원을 찾을 수 없습니다.'; end if;
  if p_action in ('approve','reject') then
    if not manager then raise exception '관리 권한이 필요합니다.' using errcode='42501'; end if;
    if m.status<>'PENDING' then raise exception '이미 처리된 신청입니다.'; end if;
    update public.acres_party_members set status=case when p_action='approve' then 'APPROVED' else 'REJECTED' end,updated_at=now() where id=m.id;
  elsif p_action='cancel' then
    if m.user_id<>u or m.status<>'PENDING' then raise exception '대기 중인 본인 신청만 취소할 수 있습니다.'; end if;
    update public.acres_party_members set status='CANCELED',updated_at=now() where id=m.id;
  elsif p_action in ('kick','leave') then
    if m.user_id=p.owner_id then raise exception '생성자는 탈퇴/강퇴할 수 없습니다. 파티 해체를 이용하세요.'; end if;
    if m.status<>'APPROVED' then raise exception '승인 회원만 처리할 수 있습니다.'; end if;
    if p_action='leave' and m.user_id<>u then raise exception '본인만 탈퇴할 수 있습니다.' using errcode='42501'; end if;
    if p_action='kick' and (not manager or (m.is_manager and u<>p.owner_id and not acres_private.is_admin())) then raise exception '강퇴 권한이 없습니다.' using errcode='42501'; end if;
    delete from public.acres_schedules where participation_id in (select id from public.acres_party_characters where member_id=m.id);
    update public.acres_party_characters set status=case when p_action='kick' then 'EXCLUDED_BY_ADMIN' else 'REMOVED_BY_USER' end,troop1=null,troop2=null,updated_at=now() where member_id=m.id;
    update public.acres_party_members set status=case when p_action='kick' then 'KICKED' else 'LEFT' end,blocked=(p_action='kick'),is_manager=false,updated_at=now() where id=m.id;
  elsif p_action='unblock' then
    if not manager then raise exception '관리 권한이 필요합니다.' using errcode='42501'; end if;
    update public.acres_party_members set blocked=false,updated_at=now() where id=m.id;
  elsif p_action in ('manager','unmanager') then
    if u<>p.owner_id and not acres_private.is_admin() then raise exception '생성자 또는 ADMIN 권한이 필요합니다.' using errcode='42501'; end if;
    if m.status<>'APPROVED' or m.user_id=p.owner_id then raise exception '추가 관리자 지정 대상이 아닙니다.'; end if;
    update public.acres_party_members set is_manager=(p_action='manager'),updated_at=now() where id=m.id;
  else raise exception '지원하지 않는 작업입니다.'; end if;
end $$;

create function public.acres_party_update(p_party uuid,p_action text,p_deadline timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare p public.acres_parties; u uuid:=acres_private.require_user();
begin
  p:=acres_private.lock_party(p_party);
  if u<>p.owner_id and not acres_private.is_admin() then raise exception '생성자 또는 ADMIN 권한이 필요합니다.' using errcode='42501'; end if;
  if p_action='dissolve' then update public.acres_parties set status='DISSOLVED',updated_at=now() where id=p_party;
  elsif p_action='deadline' then
    if u<>p.owner_id then raise exception '마감 예정일은 생성자만 변경할 수 있습니다.' using errcode='42501'; end if;
    if p_deadline is null then raise exception '마감 예정 일시를 입력하세요.'; end if;
    update public.acres_parties set deadline_at=p_deadline,updated_at=now() where id=p_party;
  elsif p_action='close' then
    if u<>p.owner_id then raise exception '생성자만 모집을 마감할 수 있습니다.' using errcode='42501'; end if;
    update public.acres_parties set applications_closed=true,updated_at=now() where id=p_party;
  else raise exception '지원하지 않는 작업입니다.'; end if;
end $$;

create function public.acres_participation_action(p_party uuid,p_character uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); p public.acres_parties; c public.acres_characters; m public.acres_party_members; pc public.acres_party_characters;
begin
  p:=acres_private.lock_party(p_party);
  select * into c from public.acres_characters where id=p_character;
  if not found then raise exception '캐릭터를 찾을 수 없습니다.'; end if;
  perform 1 from public.acres_users where id=c.user_id for update;
  select * into c from public.acres_characters where id=p_character for update;
  select * into m from public.acres_party_members where party_id=p_party and user_id=c.user_id;
  if m.id is null or m.status<>'APPROVED' then raise exception '승인된 회원만 참여할 수 있습니다.'; end if;
  select * into pc from public.acres_party_characters where party_id=p_party and character_id=p_character;
  if p_action='add' then
    if c.user_id<>u or c.status<>'ACTIVE' then raise exception '본인 활성 캐릭터만 추가할 수 있습니다.' using errcode='42501'; end if;
    if pc.status in ('APPROVED','PENDING_REAPPROVAL') then raise exception '이미 참여하거나 재승인 대기 중입니다.'; end if;
    insert into public.acres_party_characters(party_id,member_id,user_id,character_id,status)
      values(p_party,m.id,u,c.id,case when pc.status='EXCLUDED_BY_ADMIN' then 'PENDING_REAPPROVAL' else 'APPROVED' end)
      on conflict(party_id,character_id) do update set status=excluded.status,troop1=null,troop2=null,updated_at=now();
  elsif p_action in ('remove','exclude') then
    if pc.status<>'APPROVED' or pc.id is null then raise exception '승인 참여 캐릭터가 아닙니다.'; end if;
    if p_action='remove' and c.user_id<>u then raise exception '본인 캐릭터만 제외할 수 있습니다.' using errcode='42501'; end if;
    if p_action='exclude' and not acres_private.manages(p_party) then raise exception '관리 권한이 필요합니다.' using errcode='42501'; end if;
    if c.user_id=p.owner_id and (select count(*) from public.acres_party_characters where party_id=p_party and user_id=p.owner_id and status='APPROVED')<=1 then raise exception '생성자의 마지막 참여 캐릭터는 제외할 수 없습니다.'; end if;
    delete from public.acres_schedules where participation_id=pc.id;
    update public.acres_party_characters set status=case when p_action='remove' then 'REMOVED_BY_USER' else 'EXCLUDED_BY_ADMIN' end,troop1=null,troop2=null,updated_at=now() where id=pc.id;
  elsif p_action in ('approve','reject') then
    if not acres_private.manages(p_party) then raise exception '관리 권한이 필요합니다.' using errcode='42501'; end if;
    if pc.status<>'PENDING_REAPPROVAL' or pc.id is null or c.status<>'ACTIVE' then raise exception '재승인 대기 캐릭터가 아닙니다.'; end if;
    update public.acres_party_characters set status=case when p_action='approve' then 'APPROVED' else 'EXCLUDED_BY_ADMIN' end,updated_at=now() where id=pc.id;
  else raise exception '지원하지 않는 작업입니다.'; end if;
end $$;

create function public.acres_participation_save(p_id uuid,p_troop1 text,p_troop2 text) returns void language plpgsql security definer set search_path='' as $$
declare pc public.acres_party_characters; u uuid:=acres_private.require_user();
begin
  select * into pc from public.acres_party_characters where id=p_id;
  perform acres_private.lock_party(pc.party_id);
  select * into pc from public.acres_party_characters where id=p_id;
  if pc.status<>'APPROVED' or not exists(select 1 from public.acres_party_members where id=pc.member_id and status='APPROVED') then raise exception '승인 참여 상태가 아닙니다.'; end if;
  if pc.user_id<>u and not acres_private.is_admin() then raise exception '소유자 또는 ADMIN만 변경할 수 있습니다.' using errcode='42501'; end if;
  update public.acres_party_characters set troop1=nullif(p_troop1,''),troop2=nullif(p_troop2,''),updated_at=now() where id=p_id;
end $$;

-- Add before remove so an OWNER keeps at least one approved character throughout.
-- Nested functions run in this same transaction; any failure rolls back both steps.
create function public.acres_participation_swap(p_party uuid,p_old uuid,p_new uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform acres_private.lock_party(p_party);
  if p_old=p_new then raise exception '다른 캐릭터를 선택하세요.'; end if;
  perform public.acres_participation_action(p_party,p_new,'add');
  if not exists(select 1 from public.acres_party_characters where party_id=p_party and character_id=p_new and status='APPROVED') then
    raise exception '관리자 제외 캐릭터는 재승인을 받은 후 교체해 주세요.';
  end if;
  perform public.acres_participation_action(p_party,p_old,'remove');
end $$;

create function public.acres_schedule_save(p_id uuid,p_date date,p_status text,p_memo text default '') returns void language plpgsql security definer set search_path='' as $$
declare pc public.acres_party_characters; p public.acres_parties; u uuid:=acres_private.require_user();
begin
  select * into pc from public.acres_party_characters where id=p_id;
  p:=acres_private.lock_party(pc.party_id);
  select * into pc from public.acres_party_characters where id=p_id;
  if pc.status<>'APPROVED' or not exists(select 1 from public.acres_party_members where id=pc.member_id and status='APPROVED') then raise exception '승인 참여 상태가 아닙니다.'; end if;
  if pc.user_id<>u and not acres_private.is_admin() then raise exception '소유자 또는 ADMIN만 변경할 수 있습니다.' using errcode='42501'; end if;
  if p_date is null or p_date<p.departure_date or p_date>p.departure_date+11 then raise exception '출발일 포함 12일 범위만 입력할 수 있습니다.'; end if;
  if p_status='FULL' then delete from public.acres_schedules where participation_id=p_id and war_date=p_date;
  else insert into public.acres_schedules(participation_id,war_date,status,memo) values(p_id,p_date,p_status,btrim(p_memo))
    on conflict(participation_id,war_date) do update set status=excluded.status,memo=excluded.memo,updated_at=now(); end if;
end $$;

create function public.acres_notice_save(p_party uuid,p_title text,p_body text,p_pinned boolean default false,p_id uuid default null,p_delete boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
  perform acres_private.lock_party(p_party);
  if not acres_private.manages(p_party) then raise exception '관리 권한이 필요합니다.' using errcode='42501'; end if;
  if p_id is null then
    if p_delete then raise exception '공지를 선택하세요.'; end if;
    insert into public.acres_notices(party_id,author_id,title,body,pinned) values(p_party,acres_private.current_user_id(),btrim(p_title),btrim(p_body),p_pinned);
  else
    update public.acres_notices set title=case when p_delete then title else btrim(p_title) end,body=case when p_delete then body else btrim(p_body) end,pinned=p_pinned,status=case when p_delete then 'DELETED' else 'ACTIVE' end,updated_at=now() where id=p_id and party_id=p_party and status='ACTIVE';
    if not found then raise exception '공지를 찾을 수 없습니다.'; end if;
  end if;
end $$;

-- Server-side bounded lists; every call requires an onboarded active user.
create function public.acres_party_list(p_mine boolean default false,p_offset integer default 0,p_search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); result jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
    select p.*,m.status as my_status,m.is_manager as my_manager from public.acres_parties p
    left join public.acres_party_members m on m.party_id=p.id and m.user_id=u
    where (case when p_mine then m.id is not null else p.status='ACTIVE' and p.departure_date>=(now() at time zone 'Asia/Seoul')::date end)
      and p.name ilike '%'||left(coalesce(p_search,''),100)||'%'
    order by p.departure_date,p.id limit 20 offset greatest(coalesce(p_offset,0),0)
  ) q; return result;
end $$;

create function public.acres_party_detail(p_party uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=acres_private.require_user(); p public.acres_parties; mine public.acres_party_members; can_read boolean; result jsonb;
begin
  select * into p from public.acres_parties where id=p_party;
  select * into mine from public.acres_party_members where party_id=p_party and user_id=u;
  if p.id is null or (p.status='DISSOLVED' and mine.id is null and not acres_private.is_admin()) then raise exception '파티를 찾을 수 없거나 접근 권한이 없습니다.'; end if;
  can_read:=acres_private.approved(p_party);
  result:=jsonb_build_object('party',to_jsonb(p),'mine',case when mine.id is null then null else to_jsonb(mine) end,
    'can_read',can_read,'can_manage',acres_private.manages(p_party),'can_own',p.owner_id=u or acres_private.is_admin(),
    'members','[]'::jsonb,'characters','[]'::jsonb,'schedules','[]'::jsonb,'notices','[]'::jsonb);
  if can_read then
    result:=result||jsonb_build_object(
      'members',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (select m.id,m.user_id,m.status,m.is_manager,m.blocked,
        case when acres_private.manages(p_party) or m.user_id=u then m.memo else null end as memo,
        coalesce(c.name,'탈퇴한 회원') as display_name
        from public.acres_party_members m join public.acres_users a on a.id=m.user_id left join public.acres_characters c on c.id=a.main_character_id
        where m.party_id=p_party and (m.status='APPROVED' or acres_private.manages(p_party)) order by m.created_at,m.id) q),
      'characters',(select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (select pc.*,c.name from public.acres_party_characters pc join public.acres_characters c on c.id=pc.character_id
        where pc.party_id=p_party and (pc.status='APPROVED' or pc.user_id=u or acres_private.manages(p_party)) order by pc.created_at,pc.id) q),
      'schedules',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.acres_schedules s join public.acres_party_characters pc on pc.id=s.participation_id where pc.party_id=p_party and pc.status='APPROVED'),
      'notices',(select coalesce(jsonb_agg(to_jsonb(n) order by n.pinned desc,n.created_at desc),'[]') from public.acres_notices n where n.party_id=p_party and n.status='ACTIVE'));
  end if;
  return result;
end $$;

-- No anonymous reads and no direct client mutations. Definer RPCs enforce transitions.
alter table public.acres_users enable row level security;
alter table public.acres_characters enable row level security;
alter table public.acres_troops enable row level security;
alter table public.acres_parties enable row level security;
alter table public.acres_party_members enable row level security;
alter table public.acres_party_characters enable row level security;
alter table public.acres_schedules enable row level security;
alter table public.acres_notices enable row level security;
create policy own_profile on public.acres_users for select to authenticated using(id=acres_private.current_user_id());
create policy own_characters on public.acres_characters for select to authenticated using(user_id=acres_private.current_user_id() and status='ACTIVE');
create policy troop_catalogue on public.acres_troops for select to authenticated using(acres_private.current_user_id() is not null);

revoke all on public.acres_users,public.acres_characters,public.acres_troops,public.acres_parties,public.acres_party_members,public.acres_party_characters,public.acres_schedules,public.acres_notices from anon,authenticated;
grant select on public.acres_users,public.acres_characters,public.acres_troops to authenticated;
grant usage on schema acres_private to authenticated;
-- Only names owned by this migration are affected; never change unrelated functions.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='acres_private' or (n.nspname='public' and left(p.proname,6)='acres_') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.nspname='public' then
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
end $$;
-- Private helpers used by RLS require execution but do not accept a client identity.
grant execute on function acres_private.current_user_id(),acres_private.is_admin(),acres_private.approved(uuid),acres_private.manages(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
