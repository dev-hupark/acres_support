import { useRef, useState } from 'react';
import { errorMessage } from '../lib/supabase';

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const run = async (task, success = '저장했습니다.') => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setMessage(null);
    try { await task(); setMessage({ text: success, error: false }); return true; }
    catch (e) { setMessage({ text: errorMessage(e), error: true }); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, run, notice: message && <div className={message.error ? 'alert' : 'success'} role={message.error ? 'alert' : 'status'}>{message.text}</div> };
}

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className="muted">{hint}</small>}</label>;
}
export function Empty({ children }) { return <div className="empty">{children}</div>; }
