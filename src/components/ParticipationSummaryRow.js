import { useState } from 'react';
import CopyUidButton from './CopyUidButton';
import { useAction } from './Forms';
import { rpc } from '../lib/supabase';
import { daysFrom } from '../lib/format';

export default function ParticipationSummaryRow({ pc, troops, schedules, departureDate, onSchedule, editable = false, canExclude = false, onSaved, pcAction, busy = false }) {
  const [editing, setEditing] = useState(false);
  const [slot1, setSlot1] = useState(pc.troop1 || '');
  const [slot2, setSlot2] = useState(pc.troop2 || '');
  const action = useAction();
  const options = <><option value="">미지정</option>{troops.filter(t => t.status !== 'INACTIVE' || t.code === pc.troop1 || t.code === pc.troop2).map(t => <option key={t.code} value={t.code} disabled={t.status === 'INACTIVE'}>{t.name}{t.status === 'INACTIVE' ? ' (비활성)' : ''}</option>)}</>;
  const fullAttendance = daysFrom(departureDate).every(date => !schedules.some(s => s.participation_id === pc.id && s.war_date === date && s.status !== 'FULL'));
  const troopNames = [pc.troop1, pc.troop2].filter(Boolean).map(code => troops.find(t => t.code === code)?.name || code).join(' · ');
  return <div className="roster-character roster-character-flat">
    <strong>{pc.name || '삭제된 캐릭터'}{pc.game_uid ? ` (${pc.game_uid})` : ''}</strong>
    <CopyUidButton key={pc.game_uid} uid={pc.game_uid} characterName={pc.name} />
    <p className="small muted roster-troops">{troopNames || '병종 미지정'}</p>
    <div className="roster-row-actions">{editable && <button type="button" disabled={busy || action.busy} aria-label={`${pc.name} 병종 수정`} aria-expanded={editing} onClick={() => { setSlot1(pc.troop1 || ''); setSlot2(pc.troop2 || ''); setEditing(current => !current); }}>수정</button>}
      <button type="button" className={`roster-schedule-button${fullAttendance ? ' is-full' : ''}`} onClick={() => onSchedule(pc.id)} aria-label={`${pc.name || '캐릭터'} 일정확인${fullAttendance ? ' (전체 풀참)' : ''}`} title={fullAttendance ? '12일 전체 풀참' : '부분 참여 또는 불참 일정 있음'}>일정확인</button></div>
    {editing && editable && <div className="roster-editor">{action.notice}<form onSubmit={event => { event.preventDefault(); action.run(async () => {
      await rpc('acres_participation_save', { p_id: pc.id, p_troop1: slot1, p_troop2: slot2 });
      await onSaved(); setEditing(false);
    }); }}><fieldset className="compact-troops" disabled={busy || action.busy}><label>병종1<select aria-label={`${pc.name} 병종1`} value={slot1} onChange={event => setSlot1(event.target.value)}>{options}</select></label><label>병종2<select aria-label={`${pc.name} 병종2`} value={slot2} onChange={event => setSlot2(event.target.value)}>{options}</select></label><div className="actions"><button type="submit" disabled={!!slot1 && slot1 === slot2}>저장</button><button type="button" onClick={() => setEditing(false)}>취소</button></div></fieldset></form>
      {canExclude && <details className="character-tools"><summary>캐릭터 관리</summary><div className="actions"><button type="button" className="danger-text" disabled={busy || action.busy} onClick={() => pcAction(pc.character_id, 'exclude', '관리자 권한으로 제외할까요? 병종·일정을 삭제하고 재등록 시 재승인이 필요합니다.')}>관리자 제외</button></div></details>}
    </div>}
  </div>;
}
