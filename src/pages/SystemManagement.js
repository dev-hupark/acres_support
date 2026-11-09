import { useCallback, useEffect, useRef, useState } from 'react';
import { Empty, Field, useAction } from '../components/Forms';
import { errorMessage, rpc } from '../lib/supabase';
import './SystemManagement.css';

const stats = [
  ['health', '체력'], ['rage', '분노'], ['movement', '이동거리'],
  ['attack', '공격력'], ['attack_range', '사거리'], ['food_consumption', '식량소비'],
];

function TroopManagement() {
  const [troops, setTroops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [result, setResult] = useState('');
  const request = useRef(0);
  const invalidate = useCallback(() => { request.current++; }, []);
  const action = useAction();
  const load = useCallback(async () => {
    const token = ++request.current;
    try {
      const data = await rpc('acres_admin_troop_list');
      if (token === request.current) { setTroops(data.troops); setCategories(data.categories); setError(''); }
    } catch (e) {
      if (token === request.current) { setTroops([]); setCategories([]); setError(errorMessage(e)); }
    } finally { if (token === request.current) setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => { invalidate(); window.removeEventListener('focus', load); };
  }, [load, invalidate]);

  const create = event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const args = { p_name: form.get('name').trim(), p_category: form.get('category').trim() };
    for (const [key] of stats) args[`p_${key}`] = form.get(key).trim() === '' ? null : Number(form.get(key));
    setResult('');
    action.run(async () => {
      try { await rpc('acres_admin_troop_create', args); setFormKey(v => v + 1); }
      finally { await load(); }
    }, '병종을 추가했습니다.');
  };
  const changeStatus = troop => {
    const active = troop.status !== 'INACTIVE';
    if (active && !window.confirm(`“${troop.name}” 병종을 비활성화할까요? 기존 파티 선택은 보존하고 신규 선택만 차단합니다.`)) return;
    setResult('');
    action.run(async () => {
      try {
        await rpc('acres_admin_troop_status', { p_code: troop.code, p_status: active ? 'INACTIVE' : 'ACTIVE' });
        setResult(active ? '기존 파티 선택은 유지하고 신규 선택 목록에서 제외했습니다.' : '병종을 활성화했습니다.');
      } finally { await load(); }
    }, '처리했습니다.');
  };
  const rows = troops.filter(t => `${t.name} ${t.category || ''}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <><div className="section-heading"><div><p className="eyebrow">SYSTEM CATALOGUE</p><h1>병종 관리</h1></div><span className="tag accent">시스템 ADMIN 전용</span></div><p className="muted intro">파티에서 사용하는 병종과 능력치를 관리합니다.</p>
    {action.notice}{result && <p role="status" className="small green">{result}</p>}{error && <div className="alert" role="alert">{error}<button onClick={load} disabled={action.busy}>다시 시도</button></div>}
    <section className="panel"><h2>병종 추가</h2><p className="small muted">구분은 공통코드에 등록된 방패병·궁병·창병·기병·병기 중 선택합니다. 능력치는 0 이상, 소수점 세 자리까지 입력할 수 있으며 미입력 값은 미정으로 저장됩니다.</p>
      <form key={formKey} onSubmit={create}><fieldset disabled={action.busy || loading || !!error}><div className="form-grid"><Field label="병종명"><input name="name" required maxLength={60} placeholder="병종명" /></Field><Field label="구분"><select name="category" required defaultValue=""><option value="" disabled>병종 구분 선택</option>{categories.map(c => <option value={c.code} key={c.code}>{c.name}</option>)}</select></Field></div><div className="troop-stat-form">{stats.map(([key, label]) => <Field key={key} label={label}><input name={key} type="number" min="0" max="99999999999.999" step="0.001" placeholder="미정" /></Field>)}</div><button className="primary">{action.busy ? '처리 중…' : '병종 추가'}</button></fieldset></form>
    </section>
    <section className="panel"><div className="section-heading"><h2>병종 목록 <span className="count">{troops.length}</span></h2><button onClick={load} disabled={action.busy || loading}>새로고침</button></div><Field label="병종명·구분 검색"><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="검색어" /></Field>
      {loading ? <p role="status">병종을 불러오고 있습니다…</p> : !error && !rows.length ? <Empty>표시할 병종이 없습니다.</Empty> : !error && <div className="troop-table-wrap"><table className="troop-table"><thead><tr><th>병종명</th><th>구분</th>{stats.map(([key, label]) => <th key={key}>{label}</th>)}<th>상태</th><th>관리</th></tr></thead><tbody>{rows.map(t => <tr key={t.code}><th scope="row">{t.name}</th><td>{t.category_name || '미지정'}</td>{stats.map(([key]) => <td key={key}>{t[key] == null ? '—' : t[key]}</td>)}<td><span className="tag">{t.status === 'INACTIVE' ? '비활성' : '활성'}</span></td><td><button className={t.status === 'INACTIVE' ? '' : 'danger-text'} disabled={action.busy} onClick={() => changeStatus(t)} aria-label={`${t.name} ${t.status === 'INACTIVE' ? '활성화' : '비활성화'}`}>{t.status === 'INACTIVE' ? '활성화' : '비활성화'}</button></td></tr>)}</tbody></table></div>}
      <p className="small muted">병종은 삭제하지 않고 활성·비활성으로 관리합니다. 비활성화해도 기존 파티의 병종 선택은 유지됩니다.</p>
    </section>
  </>;
}

export default function SystemManagement({ route, profile }) {
  if (profile.role !== 'ADMIN') return <section className="panel"><h1>접근 권한이 없습니다.</h1><p className="muted">시스템 ADMIN만 이용할 수 있습니다.</p><a href="#/" className="button">대시보드로</a></section>;
  if (route === '/system/troops') return <TroopManagement />;
  return <><p className="eyebrow">SYSTEM MANAGEMENT</p><h1>시스템 관리</h1><p className="muted intro">서비스 운영에 사용하는 기준 정보를 관리합니다.</p><div className="menu-grid"><a href="#/system/troops" className="menu-card"><span className="menu-number">01</span><h2>병종 관리</h2><p>병종명, 구분, 능력치를 등록하고 활성·비활성을 관리합니다.</p><span className="card-link">병종 관리로 이동 ↗</span></a></div></>;
}
