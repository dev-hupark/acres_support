import { useId, useState } from 'react';
import ParticipationSummaryRow from './ParticipationSummaryRow';
import TroopStatistics from './TroopStatistics';
import CharacterSelectionModal from './CharacterSelectionModal';

const views = [{ id: 'list', name: '목록보기' }, { id: 'statistics', name: '병종통계보기' }];

export default function ParticipationOverview({ data, troops, onSchedule, profile, characters = [], onSaved, pcAction, busy = false }) {
  const [view, setView] = useState('list');
  const [selecting, setSelecting] = useState(false);
  const prefix = useId();
  const approvedMembers = data.members.filter(m => m.status === 'APPROVED');
  const active = data.party.status === 'ACTIVE';
  const changeWithKeyboard = (event, index) => {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    else return;
    event.preventDefault(); setView(views[next].id); document.getElementById(`${prefix}-${views[next].id}`)?.focus();
  };
  return <section className="panel"><h2>참여 현황</h2><div className="tabs" role="tablist" aria-label="참여 현황 보기 방식">{views.map((v, index) => <button type="button" role="tab" key={v.id} id={`${prefix}-${v.id}`} aria-controls={`${prefix}-panel`} aria-selected={view === v.id} tabIndex={view === v.id ? 0 : -1} className={view === v.id ? 'active' : ''} onClick={() => setView(v.id)} onKeyDown={event => changeWithKeyboard(event, index)}>{v.name}</button>)}</div>
    <div role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-${view}`}>
      {view === 'statistics' ? <TroopStatistics members={data.members} characters={data.characters} troops={troops} /> : <>
        {!approvedMembers.length && <div className="empty">승인된 참여자가 없습니다.</div>}
        {approvedMembers.map(m => <article key={m.id} className="member-block"><div className="section-heading"><div className="roster-member-heading"><strong>{m.display_name}</strong>{active && m.user_id === profile?.id && <button type="button" className="character-add-button" disabled={busy} onClick={() => setSelecting(true)}>캐릭터추가</button>}</div><span className="tag">{m.user_id === data.party.owner_id ? '생성자' : m.is_manager ? '추가 관리자' : '파티원'}</span></div>
          {data.characters.filter(pc => pc.user_id === m.user_id && pc.status === 'APPROVED').map(pc => <ParticipationSummaryRow key={pc.id} pc={pc} troops={troops} schedules={data.schedules} departureDate={data.party.departure_date} onSchedule={onSchedule} editable={active && (pc.user_id === profile?.id || data.can_manage)} canExclude={active && data.can_manage} onSaved={onSaved} pcAction={pcAction} busy={busy} />)}
          {!data.characters.some(pc => pc.user_id === m.user_id && pc.status === 'APPROVED') && <p className="small muted">참여 캐릭터가 아직 없습니다.</p>}
          {data.characters.filter(pc => pc.user_id === m.user_id && pc.status === 'PENDING_REAPPROVAL').map(pc => <div className="roster-pending" key={pc.id}><span>{pc.name}{pc.game_uid ? ` (${pc.game_uid})` : ''} · 재승인 대기</span>{active && data.can_manage && <div className="actions"><button disabled={busy} onClick={() => pcAction(pc.character_id, 'approve')}>재승인</button><button disabled={busy} onClick={() => pcAction(pc.character_id, 'reject')}>재승인 거절</button></div>}</div>)}
        </article>)}
      </>}
    </div>
    {selecting && active && data.mine?.status === 'APPROVED' && <CharacterSelectionModal partyId={data.party.id} characters={characters} participations={data.characters} onSaved={onSaved} onClose={() => setSelecting(false)} />}
  </section>;
}
