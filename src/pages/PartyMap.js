import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Field, useAction } from '../components/Forms';
import { rpc, errorMessage } from '../lib/supabase';
import { dateTime } from '../lib/format';
import { DEAD_COLOR, FACTIONS, GRID_SIZE, entryColor, entryRect, footprintSize, overlaps, pointFromPointer } from '../lib/map';
import './PartyMap.css';

const blank = () => ({ alias: '', x: '', y: '', faction: 'FRIENDLY', memo: '', is_dead: 'N' });
const ticks = [0, 100, 200, 300, 400, 500, 600];
const CELL_PIXELS = 1.3;

export function MapCanvas({ entries, selected, onSelect, onCoordinate }) {
  const plane = useRef(null);
  const [pointer, setPointer] = useState(null);
  const prefix = useId().replace(/:/g, '');
  const coordinate = event => pointFromPointer(event.clientX, event.clientY, plane.current.getBoundingClientRect());
  return <div className="party-map-view">
    <div className="map-viewport" aria-label="전장 지도"><div className="map-coordinate-frame" style={{ maxWidth: GRID_SIZE * CELL_PIXELS + 56 }}>
      <div className="map-plane" ref={plane} style={{ maxWidth: GRID_SIZE * CELL_PIXELS }}>
        <svg viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`} role="group" aria-label="좌하단 원점의 파티 지도" onPointerMove={e => setPointer(coordinate(e))} onPointerLeave={() => setPointer(null)} onClick={e => onCoordinate(coordinate(e))}>
          <defs><pattern id={`${prefix}-minor`} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d9e2d8" strokeWidth={0.6 / CELL_PIXELS} /></pattern><pattern id={`${prefix}-major`} width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#9caf9b" strokeWidth={1 / CELL_PIXELS} /></pattern></defs>
          <rect width={GRID_SIZE} height={GRID_SIZE} fill="#f3f7ef" />
          <rect width={GRID_SIZE} height={GRID_SIZE} fill={`url(#${prefix}-minor)`} /><rect width={GRID_SIZE} height={GRID_SIZE} fill={`url(#${prefix}-major)`} />
          {entries.map(entry => {
            const r = entryRect(entry); const chosen = selected === entry.id; const hit = Math.max(r.width, 14 / CELL_PIXELS);
            return <g key={entry.id} role="button" tabIndex={0} aria-label={`${entry.alias}, ${FACTIONS[entry.faction].name}, X ${entry.x} Y ${entry.y}, ${r.width}×${r.height}칸${entry.is_dead === 'Y' ? ', 사망' : ''}`} onClick={e => { e.stopPropagation(); onSelect(entry); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(entry); } }} className="map-entry-marker">
              <title>{entry.alias} · ({entry.x}, {entry.y}) · {entry.is_dead === 'Y' ? '사망' : FACTIONS[entry.faction].name}{entry.memo ? ` · ${entry.memo}` : ''}</title>
              <rect x={r.x + r.width / 2 - hit / 2} y={r.y + r.height / 2 - hit / 2} width={hit} height={hit} fill="transparent" />
              <rect {...r} fill={entryColor(entry)} stroke={chosen ? '#102e20' : entryColor(entry)} strokeWidth={(chosen ? 2 : 1) / CELL_PIXELS} data-testid={`map-footprint-${entry.id}`} />
              {chosen && <><circle cx={r.x + r.width / 2} cy={r.y + r.height / 2} r={Math.max(r.width, 12 / CELL_PIXELS)} fill="none" stroke="#254c3c" strokeWidth={1.5 / CELL_PIXELS} strokeDasharray={`${3 / CELL_PIXELS} ${2 / CELL_PIXELS}`} pointerEvents="none" /><text x={r.x + r.width / 2} y={r.y < 22 / CELL_PIXELS ? r.y + r.height + 18 / CELL_PIXELS : r.y - 10 / CELL_PIXELS} textAnchor={entry.x > 500 ? 'end' : entry.x < 100 ? 'start' : 'middle'} fontSize={12 / CELL_PIXELS} fill="#203a29" paintOrder="stroke" stroke="#f3f7ef" strokeWidth={3 / CELL_PIXELS} pointerEvents="none">{entry.alias.slice(0, 28)} ({entry.x}, {entry.y})</text></>}
            </g>;
          })}
        </svg>
        <div className="map-x-axis" aria-hidden="true">{ticks.map(t => <span key={t} style={{ left: `${(t + 0.5) / GRID_SIZE * 100}%` }}>{t}</span>)}</div>
        <div className="map-y-axis" aria-hidden="true">{ticks.map(t => <span key={t} style={{ top: `${(600 - t + 0.5) / GRID_SIZE * 100}%` }}>{t}</span>)}</div>
      </div>
    </div></div>
    <p className="small muted map-help">빈 칸을 클릭하면 입력 좌표가 선택됩니다. 항목을 클릭하면 상세 정보를 확인할 수 있습니다.</p>
  </div>;
}

export default function PartyMap({ partyId, partyStatus }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadedAt, setLoadedAt] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [factionFilter, setFactionFilter] = useState('ALL');
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const action = useAction();
  const readOnly = partyStatus !== 'ACTIVE' || loading || !!loadError;
  const load = useCallback(async () => {
    const token = ++sequence.current;
    try {
      const records = await rpc('acres_map_list', { p_party: partyId });
      if (token === sequence.current) { setEntries(records); setLoadError(''); setLoadedAt(new Date()); }
      return records;
    } catch (error) {
      if (token === sequence.current) { setLoadError(errorMessage(error)); setEntries([]); }
      return null;
    } finally { if (token === sequence.current) setLoading(false); }
  }, [partyId]);
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState !== 'hidden') load(); };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    return () => { invalidate(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load, invalidate]);
  const set = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const reset = () => { setEditing(null); setSelected(null); setDraft(blank()); };
  const select = entry => { setEditing(entry); setSelected(entry.id); setDraft({ alias: entry.alias, x: String(entry.x), y: String(entry.y), faction: entry.faction, memo: entry.memo, is_dead: entry.is_dead }); };
  const point = { x: Number(draft.x), y: Number(draft.y), faction: draft.faction };
  const overlap = draft.x !== '' && draft.y !== '' && entries.some(e => e.id !== editing?.id && overlaps(point, e));
  const max = draft.faction === 'OTHER' ? 600 : 599;
  const shown = entries.filter(e => (factionFilter === 'ALL' || (factionFilter === 'DEAD' ? e.is_dead === 'Y' : e.faction === factionFilter)) && `${e.alias} ${e.memo}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const save = event => {
    event.preventDefault();
    action.run(async () => {
      try {
        const saved = await rpc('acres_map_save', { p_party: partyId, p_alias: draft.alias.trim(), p_x: Number(draft.x), p_y: Number(draft.y), p_memo: draft.memo.trim(), p_is_dead: draft.is_dead, p_faction: draft.faction, p_id: editing?.id || null, p_version: editing?.version || null });
        setEditing(null); setDraft(blank()); setSelected(saved.id);
      } finally { await load(); }
    });
  };
  const remove = entry => {
    if (!window.confirm(`“${entry.alias}” 항목을 삭제할까요? 점유한 칸이 해제됩니다.`)) return;
    action.run(async () => {
      try { await rpc('acres_map_delete', { p_party: partyId, p_id: entry.id, p_version: entry.version }); reset(); }
      finally { await load(); }
    }, '삭제했습니다.');
  };
  return <section className="panel party-map-panel"><div className="section-heading"><div><h2>맵 관리</h2><p className="small muted">600 × 600 좌표 맵 · 승인된 파티원 공동 관리</p></div><button disabled={loading || action.busy} onClick={load}>맵 새로고침</button></div>
    <div className="map-legend">{Object.entries(FACTIONS).map(([code, f]) => <span key={code}><i style={{ backgroundColor: f.color }} />{f.name} · {footprintSize(code)}×{footprintSize(code)}</span>)}<span><i style={{ backgroundColor: DEAD_COLOR }} />사망 (Y)</span></div>
    {action.notice}{loadError && <div className="alert" role="alert">{loadError} 수정 중인 입력은 유지됩니다. 새로고침 후 다시 확인해 주세요.</div>}
    {partyStatus !== 'ACTIVE' && <div className="alert">해체된 파티의 맵은 조회만 가능합니다.</div>}
    <div className="map-content-layout"><div className="map-main-column">{loading ? <p role="status">맵을 불러오고 있습니다…</p> : <MapCanvas entries={shown} selected={selected} onSelect={select} onCoordinate={p => { if (!readOnly && !action.busy) setDraft(prev => ({ ...prev, x: String(p.x), y: String(p.y) })); }} />}
      <div className="map-list-heading"><h3>등록된 항목 <span className="count">{shown.length} / {entries.length}</span></h3><span className="small muted">{loadedAt && `마지막 조회 ${dateTime(loadedAt.toISOString())}`}</span></div>
      <div className="form-grid"><Field label="별칭·메모 검색"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색어" /></Field><Field label="세력 필터"><select value={factionFilter} onChange={e => setFactionFilter(e.target.value)}><option value="ALL">전체</option>{Object.entries(FACTIONS).map(([code, f]) => <option value={code} key={code}>{f.name}</option>)}<option value="DEAD">사망 항목</option></select></Field></div>
      <div className="map-entry-list">{!loading && !loadError && !shown.length && <div className="empty">표시할 맵 항목이 없습니다.</div>}{shown.map(entry => <article className={`map-entry-row ${selected === entry.id ? 'selected' : ''}`} key={entry.id}><button className="map-entry-summary" onClick={() => select(entry)}><i style={{ backgroundColor: entryColor(entry) }} /><span><strong>{entry.alias}</strong><small>X {entry.x} · Y {entry.y} · {FACTIONS[entry.faction].name} · {footprintSize(entry.faction)}×{footprintSize(entry.faction)}칸{entry.is_dead === 'Y' ? ' · 사망' : ''}</small>{entry.memo && <small className="map-entry-memo">{entry.memo}</small>}</span></button><button className="danger-text" disabled={readOnly || action.busy} onClick={() => remove(entry)}>삭제</button></article>)}</div>
    </div><aside className="map-editor"><div className="section-heading"><h3>{editing ? '맵 항목 수정' : '맵 항목 등록'}</h3>{editing && <span className="tag">버전 {editing.version}</span>}</div><p className="small muted">{editing ? '승인된 파티원은 다른 회원이 등록한 항목도 수정할 수 있습니다.' : '지도의 빈 칸을 클릭하거나 좌표를 직접 입력하세요.'}</p>
      <form onSubmit={save}><fieldset disabled={readOnly || action.busy}><Field label="별칭"><input required maxLength={80} value={draft.alias} onChange={e => set('alias', e.target.value)} placeholder="예: 북문 전초기지" /></Field><div className="form-grid"><Field label="X 좌표"><input type="number" required step="1" min="0" max={max} value={draft.x} onChange={e => set('x', e.target.value)} /></Field><Field label="Y 좌표"><input type="number" required step="1" min="0" max={max} value={draft.y} onChange={e => set('y', e.target.value)} /></Field></div>
        <Field label="세력"><select value={draft.faction} onChange={e => set('faction', e.target.value)}>{Object.entries(FACTIONS).map(([code, f]) => <option value={code} key={code}>{f.name}</option>)}</select></Field><p className="small muted">{draft.faction === 'OTHER' ? '입력한 좌표 1칸을 점유합니다. 좌표 0~600.' : '입력 좌표와 오른쪽·위쪽의 총 4칸(2×2)을 점유합니다. 시작 좌표 0~599.'}</p>
        <label className="check"><input type="checkbox" checked={draft.is_dead === 'Y'} onChange={e => set('is_dead', e.target.checked ? 'Y' : 'N')} />사망 여부 Y · 회색으로 표시</label><Field label="메모 (선택)"><textarea rows={4} maxLength={2000} value={draft.memo} onChange={e => set('memo', e.target.value)} /></Field>
        {overlap && <div className="alert" role="alert">다른 항목이 점유한 칸과 겹칩니다. 좌표를 변경해 주세요.</div>}
        <div className="actions"><button type="submit" className="primary" disabled={overlap}>{action.busy ? '처리 중…' : editing ? '변경 저장' : '항목 등록'}</button><button type="button" onClick={reset}>새 항목 / 초기화</button></div>
      </fieldset></form>{editing && <div className="map-editor-meta"><p className="small muted">생성 {dateTime(editing.created_at)}<br />수정 {dateTime(editing.updated_at)}</p><button className="danger-text" disabled={readOnly || action.busy} onClick={() => remove(editing)}>선택 항목 삭제</button></div>}
    </aside></div><p className="small muted map-sharing-note">맵은 파티별로 저장되며 20초마다 최신 정보를 조회합니다. 다른 회원이 먼저 수정한 항목은 최신 버전을 확인한 뒤 저장·삭제해 주세요.</p>
  </section>;
}
