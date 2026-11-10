import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Field, useAction } from './Forms';
import { daysFrom, labels } from '../lib/format';
import { rpc } from '../lib/supabase';
import './ScheduleModal.css';

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = date => `${date.slice(5).replace('-', '/')} (${weekdays[new Date(`${date}T12:00:00Z`).getUTCDay()]})`;

export default function ScheduleModal({ pc, departureDate, schedules, onClose, onSaved, readOnly = false }) {
  const [days, setDays] = useState(() => daysFrom(departureDate).map(date => {
    const existing = schedules.find(s => s.participation_id === pc.id && s.war_date === date);
    return { date, status: existing?.status || 'FULL', memo: existing?.memo || '' };
  }));
  const [full, setFull] = useState(() => days.every(day => day.status === 'FULL'));
  const [selected, setSelected] = useState(null);
  const [validation, setValidation] = useState('');
  const action = useAction();
  const dialog = useRef(null);
  const close = useRef(null);
  const callbacks = useRef({ onClose, busy: action.busy });
  callbacks.current = { onClose, busy: action.busy };
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!callbacks.current.busy) callbacks.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const targets = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      const first = targets[0]; const last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);

  const update = (key, value) => {
    setFull(false);
    setValidation('');
    setDays(current => current.map(day => day.date === selected ? { ...day, [key]: value } : day));
  };
  const save = event => {
    event.preventDefault();
    if (readOnly) return;
    const payload = full ? days.map(day => ({ date: day.date, status: 'FULL', memo: '' })) : days.map(day => ({ ...day, memo: day.status === 'FULL' ? '' : day.memo.trim() }));
    const invalid = payload.find(day => day.status === 'PARTIAL' && !day.memo);
    if (invalid) { setSelected(invalid.date); setValidation(`${dayLabel(invalid.date)} 부분 참여 메모를 입력해 주세요.`); return; }
    setValidation('');
    action.run(async () => {
      await rpc('acres_schedule_replace', { p_id: pc.id, p_schedules: payload });
      await onSaved();
      onClose();
    });
  };
  const current = days.find(day => day.date === selected);
  return createPortal(<div className="schedule-modal-backdrop"><section className="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title" ref={dialog}>
    <header className="schedule-modal-header"><h2 id="schedule-modal-title">{readOnly ? '일정확인' : '일정관리'}</h2><button type="button" ref={close} disabled={action.busy} onClick={onClose} aria-label={readOnly ? '일정확인 닫기' : '일정관리 닫기'}>닫기</button></header>
    <p className="small muted schedule-character">{pc.name}{pc.game_uid ? ` (${pc.game_uid})` : ''} · KST 20:00~24:00</p>
    <form onSubmit={save}><fieldset disabled={action.busy}>
      {!readOnly && <div className="schedule-modal-toolbar"><label className="check"><input type="checkbox" checked={full} onChange={e => { setFull(e.target.checked); setValidation(''); if (e.target.checked) setDays(prev => prev.map(day => ({ ...day, status: 'FULL', memo: '' }))); }} />풀참</label><button type="submit" className="primary">{action.busy ? '저장 중…' : '저장'}</button></div>}
      {action.notice}{validation && <div className="alert" role="alert">{validation}</div>}
      <div className="schedule-date-grid" role="group" aria-label="출발일 포함 12일 일정">{days.map(day => <button type="button" key={day.date} className={`schedule-day ${day.status.toLowerCase()} ${selected === day.date ? 'selected' : ''}`} aria-pressed={selected === day.date} aria-label={`${day.date} ${dayLabel(day.date)} ${day.status === 'FULL' ? '풀참' : labels[day.status]}`} onClick={() => { setSelected(day.date); if (!readOnly) setFull(false); }}><strong>{dayLabel(day.date)}</strong><small>{day.status === 'FULL' ? '풀참' : labels[day.status]}</small></button>)}</div>
      {current && <div className="schedule-day-editor"><h3>{dayLabel(current.date)}</h3>{readOnly ? <><p className="small muted">{current.status === 'FULL' ? '풀참' : labels[current.status]}</p>{current.memo && <p className="notice-body">{current.memo}</p>}</> : <><Field label="참여 여부"><select value={current.status} onChange={e => update('status', e.target.value)}>{['FULL', 'PARTIAL', 'ABSENT'].map(status => <option value={status} key={status}>{status === 'FULL' ? '풀참' : labels[status]}</option>)}</select></Field>{current.status !== 'FULL' && <Field label={current.status === 'PARTIAL' ? '메모 (필수)' : '메모 (선택)'}><textarea rows={2} maxLength={1000} value={current.memo} onChange={e => update('memo', e.target.value)} placeholder="참여 가능한 시간 등을 입력하세요" /></Field>}</>}</div>}
      <p className="small muted schedule-modal-help">{readOnly ? '날짜를 선택하면 해당 날짜의 참여 여부와 메모를 확인할 수 있습니다.' : '날짜를 선택해 참여 여부를 편집한 뒤 저장하세요. 풀참을 체크하면 12일 전체를 풀참으로 저장합니다.'}</p>
    </fieldset></form>
  </section></div>, document.body);
}
