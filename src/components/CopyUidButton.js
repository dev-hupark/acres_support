import { useState } from 'react';

export default function CopyUidButton({ uid, characterName }) {
  const [status, setStatus] = useState('idle');
  if (!uid) return null;

  const copy = async () => {
    setStatus('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(String(uid));
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  };

  return <span className="uid-copy">
    <button type="button" className="uid-copy-button" aria-label={`${characterName || '캐릭터'} UID 복사`} disabled={status === 'copying'} onClick={copy}>{status === 'copying' ? '복사 중…' : '복사'}</button>
    <span className={status === 'error' ? 'small danger-text' : 'small green'} role="status">{status === 'copied' ? '복사됨' : status === 'error' ? '복사하지 못했습니다. UID를 직접 복사해 주세요.' : ''}</span>
  </span>;
}
