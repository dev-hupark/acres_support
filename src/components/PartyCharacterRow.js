import { useState } from 'react';
import { labels } from '../lib/format';
import { Field } from './Forms';

const label = character => `${character.name || '삭제된 캐릭터'}${character.game_uid ? ` (${character.game_uid})` : ''}`;

export default function PartyCharacterRow({ pc, profile, party, participations, characters, troops, canManage, busy, perform, pcAction, onSchedule }) {
  const [slot1, setSlot1] = useState(pc.troop1 || '');
  const [slot2, setSlot2] = useState(pc.troop2 || '');
  const active = party.status === 'ACTIVE';
  const own = pc.user_id === profile.id;
  const editable = active && pc.status === 'APPROVED' && (own || profile.role === 'ADMIN');
  const choices = troops.filter(t => t.status !== 'INACTIVE' || t.code === pc.troop1 || t.code === pc.troop2);
  const options = <><option value="">미지정</option>{choices.map(t => <option key={t.code} value={t.code} disabled={t.status === 'INACTIVE'}>{t.name}{t.status === 'INACTIVE' ? ' (비활성)' : ''}</option>)}</>;
  return <article className="party-character-flat"><div className="party-character-top"><strong>{label(pc)}</strong>{pc.status !== 'APPROVED' && <span className="tag">{labels[pc.status]}</span>}<button className="schedule-open-button" disabled={!editable || busy} onClick={() => onSchedule(pc.id)} aria-label={`${pc.name || '캐릭터'} 일정관리`}>일정관리</button></div>
    {pc.status === 'APPROVED' && <form onSubmit={e => { e.preventDefault(); perform('acres_participation_save', { p_id: pc.id, p_troop1: slot1, p_troop2: slot2 }); }}><fieldset disabled={!editable || busy} className="compact-troops"><label>병종1<select value={slot1} onChange={e => setSlot1(e.target.value)} aria-label={`${pc.name || '캐릭터'} 병종1`}>{options}</select></label><label>병종2<select value={slot2} onChange={e => setSlot2(e.target.value)} aria-label={`${pc.name || '캐릭터'} 병종2`}>{options}</select></label><button type="submit" disabled={!!slot1 && slot1 === slot2}>저장</button></fieldset></form>}
    {active && (own || canManage) && <details className="character-tools"><summary>캐릭터 관리</summary><div className="actions">
      {pc.status === 'APPROVED' && own && <button disabled={busy} onClick={() => pcAction(pc.character_id, 'remove', '이 캐릭터를 제외할까요? 해당 파티의 병종과 일정이 삭제됩니다.')}>본인 제외</button>}
      {pc.status === 'APPROVED' && canManage && <button disabled={busy} className="danger-text" onClick={() => pcAction(pc.character_id, 'exclude', '관리자 권한으로 제외할까요? 병종·일정이 삭제되고 재등록 시 승인이 필요합니다.')}>관리자 제외</button>}
      {pc.status === 'PENDING_REAPPROVAL' && canManage && <><button disabled={busy} onClick={() => pcAction(pc.character_id, 'approve')}>재승인</button><button disabled={busy} onClick={() => pcAction(pc.character_id, 'reject')}>재승인 거절</button></>}
    </div>{pc.status === 'APPROVED' && own && <form className="swap-form" onSubmit={e => { e.preventDefault(); perform('acres_participation_swap', { p_party: party.id, p_old: pc.character_id, p_new: new FormData(e.currentTarget).get('replacement') }, '참여 캐릭터를 교체할까요? 기존 캐릭터의 이 파티 병종·일정이 삭제됩니다.'); }}><fieldset disabled={busy}><Field label={`${label(pc)} 교체 대상`}><select name="replacement" required defaultValue=""><option value="" disabled>교체할 내 캐릭터 선택</option>{characters.filter(c => c.id !== pc.character_id && !participations.some(x => x.character_id === c.id && ['APPROVED', 'PENDING_REAPPROVAL', 'EXCLUDED_BY_ADMIN'].includes(x.status))).map(c => <option key={c.id} value={c.id}>{label(c)}</option>)}</select></Field><button>캐릭터 교체</button></fieldset></form>}</details>}
  </article>;
}
