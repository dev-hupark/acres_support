import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAction } from './Forms';
import { rpc } from '../lib/supabase';
import './ScheduleModal.css';

export default function CharacterSelectionModal({ partyId, characters, participations, onSaved, onClose }) {
  const [selected, setSelected] = useState(() => characters.filter(c => participations.some(pc => pc.character_id === c.id && ['APPROVED', 'PENDING_REAPPROVAL'].includes(pc.status))).map(c => c.id));
  const action = useAction();
  const titleId = useId();
  const dialog = useRef(null);
  const close = useRef(null);
  const callbacks = useRef();
  callbacks.current = { onClose, busy: action.busy };
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!callbacks.current.busy) callbacks.current.onClose(); }
      if (event.key !== 'Tab') return;
      const targets = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')];
      const first = targets[0]; const last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);

  return createPortal(<div className="schedule-modal-backdrop"><section ref={dialog} className="schedule-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <header className="schedule-modal-header"><h2 id={titleId}>참여 캐릭터 선택</h2><button type="button" ref={close} disabled={action.busy} onClick={onClose} aria-label="참여 캐릭터 선택 닫기">닫기</button></header>
    <p className="small muted">참여할 내 캐릭터를 선택하세요. 체크를 해제하면 참여에서 제외되고 해당 파티의 병종·일정이 삭제됩니다.</p>
    {action.notice}
    <form onSubmit={event => { event.preventDefault(); action.run(async () => {
      await rpc('acres_participation_set', { p_party: partyId, p_characters: selected });
      await onSaved(); onClose();
    }); }}><fieldset disabled={action.busy}>
      <div className="character-selection-list">{characters.map(c => {
        const pc = participations.find(item => item.character_id === c.id);
        return <label className="check" key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={event => setSelected(current => event.target.checked ? [...current, c.id] : current.filter(id => id !== c.id))} /><span>{c.name}{c.game_uid ? ` (${c.game_uid})` : ''}{pc?.status === 'PENDING_REAPPROVAL' ? ' · 재승인 대기' : pc?.status === 'EXCLUDED_BY_ADMIN' ? ' · 선택 시 재승인 필요' : ''}</span></label>;
      })}</div>
      {!characters.length && <p className="muted">등록한 캐릭터가 없습니다. <a href="#/account" onClick={onClose}>캐릭터 등록</a></p>}
      <div className="actions"><button type="submit" className="primary">{action.busy ? '저장 중…' : '저장'}</button><button type="button" onClick={onClose}>취소</button></div>
    </fieldset></form>
  </section></div>, document.body);
}
