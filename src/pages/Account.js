import { useState } from 'react';
import { Field, useAction, Empty } from '../components/Forms';
import { rpc } from '../lib/supabase';

export function CharacterForm({ initial, onSave, busy, submitText = '캐릭터 등록' }) {
  const [name, setName] = useState(initial?.name || '');
  const [uid, setUid] = useState(initial?.game_uid || '');
  return <form onSubmit={e => { e.preventDefault(); onSave(name.trim(), uid.trim()); }}><fieldset disabled={busy}>
    <div className="form-grid"><Field label="캐릭터명"><input required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="게임 내 캐릭터명" /></Field>
    <Field label="게임 UID" hint="다른 캐릭터와 중복되지 않는 게임 UID를 입력하세요."><input required maxLength={80} value={uid} onChange={e => setUid(e.target.value)} placeholder="게임 UID" /></Field></div>
    <button type="submit" className="primary">{busy ? '처리 중…' : submitText}</button>
  </fieldset></form>;
}

export function Onboarding({ onDone }) {
  const action = useAction();
  return <section className="panel onboarding"><p className="eyebrow">FIRST STEP</p><h1>첫 캐릭터를 등록해 주세요.</h1><p className="muted">Google 로그인이 완료되었습니다. 대표 캐릭터를 등록하면 모든 메뉴를 이용할 수 있습니다.</p>{action.notice}<CharacterForm busy={action.busy} submitText="등록하고 시작하기" onSave={(name, uid) => action.run(async () => { await rpc('acres_onboard', { p_name: name, p_game_uid: uid }); window.location.hash = '/'; onDone(); })} /></section>;
}

export function Account({ profile, characters, onDone }) {
  const [edit, setEdit] = useState(null);
  const action = useAction();
  const change = (id, type) => {
    if (type === 'delete' && !window.confirm('캐릭터를 삭제할까요? 파티 참여 중인 캐릭터는 삭제할 수 없으며, 대표 캐릭터 삭제 시 다른 캐릭터가 대표로 지정됩니다.')) return;
    action.run(async () => { await rpc('acres_character_action', { p_id: id, p_action: type }); onDone(); });
  };
  return <><p className="eyebrow">MY ACCOUNT</p><h1>사용자 정보 관리</h1><p className="muted intro">내 캐릭터를 관리하고, 서비스에 표시할 대표 캐릭터를 선택하세요.</p>{action.notice}
    <section className="panel"><div className="section-heading"><h2>내 캐릭터 <span className="count">{characters.length}</span></h2><span className="tag">{profile.role === 'ADMIN' ? 'ADMIN' : '회원'}</span></div>
    {!characters.length && <Empty>등록된 캐릭터가 없습니다. 파티 생성·신청 전 캐릭터를 등록해 주세요.</Empty>}
    <div className="character-list">{characters.map(c => <article className="character-row" key={c.id}><span className="character-avatar">{c.name.slice(0, 1)}</span><div className="grow"><strong>{c.name}</strong><span className="small muted">UID {c.game_uid}</span></div>{c.id === profile.main_character_id && <span className="tag accent">대표</span>}<div className="actions"><button disabled={action.busy || c.id === profile.main_character_id} onClick={() => change(c.id, 'main')}>대표 지정</button><button disabled={action.busy} onClick={() => setEdit(c)}>수정</button><button className="danger-text" disabled={action.busy} onClick={() => change(c.id, 'delete')}>삭제</button></div></article>)}</div></section>
    <section className="panel"><div className="section-heading"><h2>{edit ? '캐릭터 수정' : '새 캐릭터 등록'}</h2>{edit && <button onClick={() => setEdit(null)}>수정 취소</button>}</div><CharacterForm key={edit?.id || 'new'} initial={edit} busy={action.busy} submitText={edit ? '변경 저장' : '캐릭터 등록'} onSave={(name, uid) => action.run(async () => { await rpc('acres_character_save', { p_name: name, p_game_uid: uid, p_id: edit?.id || null }); setEdit(null); onDone(); })} /></section>
    <section className="panel subtle"><h2>계정 탈퇴</h2><p className="muted">소유한 파티 해체와 연맹 위임·해체가 먼저 필요합니다. 개인정보 보존·삭제 기준이 확정된 후 계정 탈퇴 기능을 제공합니다.</p><button disabled>계정 탈퇴 · 정책 확정 대기</button></section>
  </>;
}
