import CopyUidButton from './CopyUidButton';
import { daysFrom } from '../lib/format';

export default function ParticipationSummaryRow({ pc, troops, schedules, departureDate, onSchedule }) {
  const fullAttendance = daysFrom(departureDate).every(date => !schedules.some(s => s.participation_id === pc.id && s.war_date === date && s.status !== 'FULL'));
  const troopNames = [pc.troop1, pc.troop2].filter(Boolean).map(code => troops.find(t => t.code === code)?.name || code).join(' · ');
  return <div className="roster-character roster-character-flat">
    <strong>{pc.name || '삭제된 캐릭터'}{pc.game_uid ? ` (${pc.game_uid})` : ''}</strong>
    <CopyUidButton key={pc.game_uid} uid={pc.game_uid} characterName={pc.name} />
    <p className="small muted roster-troops">{troopNames || '병종 미지정'}</p>
    <button type="button" className={`roster-schedule-button${fullAttendance ? ' is-full' : ''}`} onClick={() => onSchedule(pc.id)} aria-label={`${pc.name || '캐릭터'} 일정확인${fullAttendance ? ' (전체 풀참)' : ''}`} title={fullAttendance ? '12일 전체 풀참' : '부분 참여 또는 불참 일정 있음'}>일정확인</button>
  </div>;
}
