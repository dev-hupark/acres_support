import { useEffect, useState } from 'react';
import { rpc, supabase, errorMessage } from '../lib/supabase';
import { dateTime, kstToday, labels, toInstant } from '../lib/format';
import { Empty, Field, useAction } from '../components/Forms';
import PartyMap from './PartyMap';
import ParticipationOverview from '../components/ParticipationOverview';
import ScheduleModal from '../components/ScheduleModal';

const Badge = ({ status }) => <span className={`tag ${status === 'APPROVED' ? 'accent' : ''}`}>{labels[status] || status}</span>;
const characterLabel = character => `${character.name || '삭제된 캐릭터'}${character.game_uid ? ` (${character.game_uid})` : ''}`;

function PartyForm({ characters }) {
  const [selected, setSelected] = useState([]);
  const action = useAction();
  return <section className="panel"><h2>새 파티 만들기</h2><p className="muted">일반 파티를 생성합니다. 참여 캐릭터를 1개 이상 선택해 주세요.</p>{action.notice}
    <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); action.run(async () => {
      const id = await rpc('acres_party_create', { p_name: f.get('name').trim(), p_departure: f.get('departure'), p_deadline: toInstant(f.get('deadline')), p_characters: selected }); window.location.hash = `/parties/${id}`;
    }); }}><fieldset disabled={action.busy}><div className="form-grid"><Field label="파티명"><input name="name" required maxLength={100} placeholder="함께할 파티의 이름" /></Field><Field label="출발일"><input type="date" name="departure" required min={kstToday()} defaultValue={kstToday()} /></Field><Field label="모집 마감 예정 일시 (KST)" hint="시간이 지나도 신청할 수 있습니다. 생성자가 직접 모집 마감해야 신청이 차단됩니다."><input type="datetime-local" name="deadline" required /></Field><Field label="공개 범위"><select disabled><option>일반 파티</option></select></Field></div>
      <p className="field-label">참여 캐릭터</p><div className="checks">{characters.map(c => <label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} />{characterLabel(c)}</label>)}</div>{!characters.length && <p className="muted">사용자 정보 관리에서 캐릭터를 먼저 등록하세요.</p>}
      <div className="actions"><button className="primary" disabled={!selected.length}>파티 생성</button><a className="button" href="#/parties">취소</a></div>
    </fieldset></form></section>;
}

function PartyList() {
  const [mine, setMine] = useState(false);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    rpc('acres_party_list', { p_mine: mine, p_offset: offset, p_search: query }).then(data => { if (active) setRows(data); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mine, offset, query, version]);
  return <><div className="section-heading"><div><p className="eyebrow">PARTY WORKSPACE</p><h1>파티 관리</h1></div><a href="#/parties/new" className="button primary">+ 파티 만들기</a></div><p className="muted intro">함께할 파티를 찾아 신청하고 나의 참여 일정을 준비하세요.</p>
    <div className="tabs"><button className={!mine ? 'active' : ''} onClick={() => { setMine(false); setOffset(0); }}>파티 모집</button><button className={mine ? 'active' : ''} onClick={() => { setMine(true); setOffset(0); }}>내 파티</button></div>
    <section className="panel"><form className="search" onSubmit={e => { e.preventDefault(); setOffset(0); setQuery(search.trim()); }}><input aria-label="파티명 검색" placeholder="파티명으로 검색" value={search} maxLength={100} onChange={e => setSearch(e.target.value)} /><button>검색</button><button type="button" onClick={() => setVersion(v => v + 1)}>새로고침</button></form>
      <p className="small muted">{mine ? '내가 생성·신청·참여한 파티입니다. 탈퇴·강퇴 후에는 기본 정보만 확인할 수 있습니다.' : '생성자가 모집 마감하지 않은 일반 파티입니다. 출발일과 마감 예정 일시가 지나도 계속 표시됩니다.'}</p>
      {loading ? <p role="status">파티를 불러오고 있습니다…</p> : error ? <div className="alert" role="alert">{error}</div> : !rows.length ? <Empty>표시할 파티가 없습니다.</Empty> : <div className="party-list">{rows.map(p => <a href={`#/parties/${p.id}`} key={p.id} className="party-row"><div><div className="actions"><span className="tag">일반 파티</span><Badge status={p.status} />{p.my_status && <Badge status={p.my_status} />}</div><h2>{p.name}</h2><span className="small muted">출발 {p.departure_date} · 마감 예정 {dateTime(p.deadline_at)}</span></div><span className={p.applications_closed || p.status === 'DISSOLVED' ? 'muted' : 'green'}>{p.status === 'DISSOLVED' ? '해체됨' : p.applications_closed ? '모집 마감' : '신청 가능'} <span aria-hidden="true">→</span></span></a>)}</div>}
      <div className="pagination"><button disabled={offset === 0 || loading} onClick={() => setOffset(v => Math.max(0, v - 20))}>이전</button><span>{offset / 20 + 1} 페이지</span><button disabled={rows.length < 20 || loading || !!error} onClick={() => setOffset(v => v + 20)}>다음</button></div>
    </section></>;
}

function NoticeForm({ initial, onSave, busy, cancel }) {
  return <form key={initial?.id || 'new'} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ p_id: initial?.id || null, p_title: f.get('title').trim(), p_body: f.get('body').trim(), p_pinned: f.get('pinned') === 'on' }); }}><fieldset disabled={busy}><Field label="공지 제목"><input name="title" maxLength={150} required defaultValue={initial?.title || ''} /></Field><Field label="본문"><textarea name="body" rows={5} maxLength={10000} required defaultValue={initial?.body || ''} /></Field><label className="check"><input type="checkbox" name="pinned" defaultChecked={initial?.pinned} />상단 고정</label><div className="actions"><button className="primary">{initial ? '공지 수정' : '공지 등록'}</button>{initial && <button type="button" onClick={cancel}>수정 취소</button>}</div></fieldset></form>;
}

function PartyDetail({ id, profile, characters }) {
  const [data, setData] = useState(null);
  const [troops, setTroops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState('overview');
  const [noticeEdit, setNoticeEdit] = useState(null);
  const [scheduleId, setScheduleId] = useState(null);
  const action = useAction();
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setData(null);
    Promise.all([rpc('acres_party_detail', { p_party: id }), supabase.from('acres_troops').select('*').order('sort_order')]).then(([detail, catalog]) => {
      if (catalog.error) throw catalog.error;
      if (active) { setData(detail); setTroops(catalog.data); }
    }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, version]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [next, catalog] = await Promise.all([rpc('acres_party_detail', { p_party: id }), supabase.from('acres_troops').select('*').order('sort_order')]);
        if (catalog.error) throw catalog.error;
        if (active) { setData(next); setTroops(catalog.data); setError(''); }
      } catch (e) { if (active) { setData(null); setError(errorMessage(e)); } }
    };
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); };
  }, [id]);
  const perform = (name, args, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return Promise.resolve(false);
    return action.run(async () => {
      try { await rpc(name, args); }
      finally { setVersion(v => v + 1); }
    });
  };
  if (loading) return <p role="status">파티 정보를 확인하고 있습니다…</p>;
  if (error || !data) return <section className="panel"><div className="alert" role="alert">{error || '파티를 찾을 수 없습니다.'}</div><button onClick={() => setVersion(v => v + 1)}>다시 시도</button><a className="button" href="#/parties">파티 목록</a></section>;
  const { party: p, mine, can_read: canRead, can_manage: canManage, can_own: canOwn } = data;
  const active = p.status === 'ACTIVE';
  const owner = p.owner_id === profile.id;
  const ownApproved = mine?.status === 'APPROVED';
  const schedulePc = data.characters.find(pc => pc.id === scheduleId && pc.status === 'APPROVED');
  const refreshDetail = async () => { const next = await rpc('acres_party_detail', { p_party: id }); setData(next); };
  const memberAction = (m, type, confirmation) => perform('acres_member_action', { p_party: id, p_member: m.id, p_action: type }, confirmation);
  const pcAction = (characterId, type, confirmation) => perform('acres_participation_action', { p_party: id, p_character: characterId, p_action: type }, confirmation);
  const mayApply = active && !p.applications_closed && !mine?.blocked && !['APPROVED', 'PENDING'].includes(mine?.status);
  const visibleTabs = [{ key: 'overview', label: '기본 정보' }, ...(canRead ? [{ key: 'members', label: '참여 현황' }, { key: 'notices', label: '파티 공지' }, { key: 'map', label: '맵 관리' }] : []), ...(canManage ? [{ key: 'manage', label: '운영 관리' }] : [])];
  const selectedTab = visibleTabs.some(t => t.key === tab) ? tab : 'overview';
  const pendingApplicants = data.members.filter(m => m.status === 'PENDING').length;
  return <><a className="back-link" href="#/parties">← 파티 목록</a><div className="section-heading"><div><div className="actions"><span className="tag">일반 파티</span><Badge status={p.status} />{mine && <Badge status={mine.status} />}</div><h1>{p.name}</h1></div><button disabled={action.busy} onClick={() => setVersion(v => v + 1)}>새로고침</button></div><p className="muted intro">출발 {p.departure_date} · 모집 마감 예정 {dateTime(p.deadline_at)}</p>{action.notice}
    {!active && <div className="alert">해체된 파티입니다. 조회만 가능하며 복구할 수 없습니다.</div>}
    <div className="tabs">{visibleTabs.map(t => <button key={t.key} className={selectedTab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}{t.key === 'manage' && pendingApplicants > 0 && <span className="tab-count-badge" aria-label={`승인 대기 ${pendingApplicants}명`}>{pendingApplicants}</span>}</button>)}</div>
    {selectedTab === 'overview' && <section className="panel"><h2>파티 안내</h2><dl className="details"><div><dt>파티명</dt><dd>{p.name}</dd></div><div><dt>출발일</dt><dd>{p.departure_date}</dd></div><div><dt>마감 예정</dt><dd>{dateTime(p.deadline_at)} (KST)</dd></div><div><dt>모집 상태</dt><dd>{!active ? '해체' : p.applications_closed ? '생성자가 모집 마감' : '신청 가능'}</dd></div></dl><p className="muted">마감 예정 시간이 지나도 생성자가 직접 마감하기 전까지 신청할 수 있습니다. 신청은 회원 단위이며, 승인 후 참여 캐릭터를 선택합니다.</p>
      {mayApply && <form onSubmit={e => { e.preventDefault(); perform('acres_party_apply', { p_party: id, p_memo: new FormData(e.currentTarget).get('memo').trim() }); }}><fieldset disabled={action.busy}><Field label="신청 메모 (선택)"><textarea name="memo" maxLength={1000} rows={3} placeholder="파티에 전하고 싶은 내용을 적어 주세요" /></Field><button className="primary" disabled={!characters.length}>{mine ? '재신청' : '파티 신청'}</button>{!characters.length && <a className="button" href="#/account">캐릭터 먼저 등록</a>}</fieldset></form>}
      {active && mine?.status === 'PENDING' && <div className="actions"><span className="muted">승인을 기다리고 있습니다.</span><button disabled={action.busy} onClick={() => memberAction(mine, 'cancel', '대기 중인 신청을 취소할까요?')}>신청 취소</button></div>}
      {mine?.blocked && <div className="alert">강퇴로 신청이 차단되어 있습니다. 파티 관리자의 차단 해제가 필요합니다.</div>}
      {active && ownApproved && !owner && <button className="danger-text" disabled={action.busy} onClick={() => memberAction(mine, 'leave', '파티에서 탈퇴할까요? 모든 참여 캐릭터가 제외되고 이 파티의 병종·일정이 삭제됩니다.')}>파티 탈퇴</button>}
      {!canRead && <p className="muted">승인된 파티원만 참여 현황·캐릭터·일정·공지를 조회할 수 있습니다.</p>}
    </section>}
    {selectedTab === 'members' && <ParticipationOverview data={data} troops={troops} profile={profile} characters={characters} onSchedule={setScheduleId} onSaved={refreshDetail} pcAction={pcAction} busy={action.busy} />}
    {selectedTab === 'notices' && <section className="panel"><h2>파티 공지</h2>{!data.notices.length && <Empty>등록된 공지가 없습니다.</Empty>}{data.notices.map(n => <article className="notice" key={n.id}>{n.pinned && <span className="tag accent">상단 고정</span>}<h3>{n.title}</h3><p className="small muted">{dateTime(n.created_at)}</p><p className="notice-body">{n.body}</p>{active && canManage && <div className="actions"><button disabled={action.busy} onClick={() => setNoticeEdit(n)}>수정</button><button disabled={action.busy} className="danger-text" onClick={() => perform('acres_notice_save', { p_party: id, p_id: n.id, p_title: n.title, p_body: n.body, p_pinned: n.pinned, p_delete: true }, '이 공지를 삭제할까요?')}>삭제</button><button disabled={action.busy} onClick={() => perform('acres_notice_save', { p_party: id, p_id: n.id, p_title: n.title, p_body: n.body, p_pinned: !n.pinned })}>{n.pinned ? '고정 해제' : '상단 고정'}</button></div>}</article>)}{active && canManage && <div className="notice-compose"><h3>{noticeEdit ? '공지 수정' : '공지 작성'}</h3><NoticeForm key={noticeEdit?.id || 'new'} initial={noticeEdit} busy={action.busy} cancel={() => setNoticeEdit(null)} onSave={args => { perform('acres_notice_save', { p_party: id, ...args }).then(ok => { if (ok) setNoticeEdit(null); }); }} /></div>}</section>}
    {selectedTab === 'map' && <PartyMap partyId={id} partyStatus={p.status} />}
    {selectedTab === 'manage' && <section className="panel"><h2>파티 운영 관리</h2>{!active ? <Empty>해체된 파티는 변경할 수 없습니다.</Empty> : <>
      {owner && <div className="management-box"><h3>모집 관리</h3><p className="muted">예정 일시와 별개로 직접 마감하면 신규 신청·재신청이 차단됩니다. 기존 대기 신청은 계속 처리할 수 있습니다.</p><button className="danger" disabled={action.busy || p.applications_closed} onClick={() => perform('acres_party_update', { p_party: id, p_action: 'close' }, '모집을 마감할까요? 이후 신규 신청·재신청을 받지 않습니다.')}>{p.applications_closed ? '모집 마감됨' : '모집 마감 처리'}</button><form onSubmit={e => { e.preventDefault(); perform('acres_party_update', { p_party: id, p_action: 'deadline', p_deadline: toInstant(new FormData(e.currentTarget).get('deadline')) }); }}><fieldset disabled={action.busy}><Field label="마감 예정 일시 변경 (KST)"><input type="datetime-local" name="deadline" required /></Field><button>예정 일시 저장</button></fieldset></form></div>}
      {data.members.map(m => <article className="manage-row" key={m.id}><div><strong>{m.display_name}{m.game_uid ? ` (${m.game_uid})` : ''}</strong><div className="actions"><Badge status={m.status} />{m.is_manager && <span className="tag">추가 관리자</span>}{m.user_id === p.owner_id && <span className="tag">생성자</span>}{m.blocked && <span className="tag">신청 차단</span>}</div>{m.memo && <p className="small">{m.memo}</p>}</div><div className="actions">
        {m.status === 'PENDING' && <><button disabled={action.busy} onClick={() => memberAction(m, 'approve')}>승인</button><button disabled={action.busy} onClick={() => memberAction(m, 'reject')}>반려</button></>}
        {m.status === 'APPROVED' && m.user_id !== p.owner_id && <>{(!m.is_manager || canOwn) && <button className="danger-text" disabled={action.busy} onClick={() => memberAction(m, 'kick', '회원 전체를 강퇴할까요? 모든 참여 캐릭터의 병종·일정이 삭제되고 재신청이 차단됩니다.')}>강퇴</button>}{canOwn && <button disabled={action.busy} onClick={() => memberAction(m, m.is_manager ? 'unmanager' : 'manager')}>{m.is_manager ? '관리자 해제' : '관리자 지정'}</button>}</>}
        {m.blocked && <button disabled={action.busy} onClick={() => memberAction(m, 'unblock')}>신청 차단 해제</button>}
      </div></article>)}
      {canOwn && <div className="management-box"><h3>파티 해체</h3><p className="muted">해체한 파티는 복구할 수 없으며 모든 변경 작업이 중지됩니다.</p><button className="danger" disabled={action.busy} onClick={() => perform('acres_party_update', { p_party: id, p_action: 'dissolve' }, '파티를 해체할까요? 이 작업은 되돌릴 수 없습니다.')}>파티 해체</button></div>}
    </>}</section>}
    {selectedTab === 'members' && schedulePc && canRead && <ScheduleModal key={`${schedulePc.id}:${active && (schedulePc.user_id === profile.id || canManage)}`} pc={schedulePc} departureDate={p.departure_date} schedules={data.schedules} readOnly={!active || !(schedulePc.user_id === profile.id || canManage)} onClose={() => setScheduleId(null)} onSaved={refreshDetail} />}
  </>;
}

export default function Parties({ route, profile, characters }) {
  if (route === '/parties/new') return <PartyForm characters={characters} />;
  const id = route.match(/^\/parties\/([0-9a-f-]{36})$/i)?.[1];
  if (id) return <PartyDetail id={id} profile={profile} characters={characters} />;
  return <PartyList />;
}
