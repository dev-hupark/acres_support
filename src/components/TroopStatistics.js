import { useState } from 'react';
import { buildTroopStatistics } from '../lib/troopStatistics';
import './TroopStatistics.css';

export default function TroopStatistics({ members, characters, troops }) {
  const [selectedCode, setSelectedCode] = useState(null);
  const stats = buildTroopStatistics(members, characters, troops);
  const max = Math.max(1, ...stats.groups.map(g => g.total));
  const selected = stats.groups.flatMap(g => g.troops).find(t => t.code === selectedCode) || stats.groups.flatMap(g => g.troops)[0];
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  return <div className="troop-statistics"><div className="troop-stat-summary"><span>승인 회원 <strong>{stats.memberCount}명</strong></span><span>참여 캐릭터 <strong>{stats.characterCount}개</strong></span><span>병종 선택 <strong>{stats.totalSelections}건</strong></span><span>미선택 슬롯 <strong>{stats.emptySlots}개</strong></span></div>
    <p className="small muted">참여 중인 캐릭터의 병종 슬롯 하나를 1건으로 집계합니다. 같은 회원의 여러 캐릭터와 두 병종은 각각 집계하며, 병기·미지정·제외·재승인 대기는 집계하지 않습니다.</p>
    <figure className="troop-category-chart" aria-label="병종 구분별 선택 통계"><figcaption>병종 구분별 선택 수 <span className="small muted">단위: 건 · 막대와 병종명을 눌러 선택자를 확인하세요.</span></figcaption>
      <div className="troop-chart-axis" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ left: `${tick / max * 100}%` }}>{tick}</span>)}</div>
      {stats.groups.map(group => <div className="troop-category-row" key={group.code}><div className="troop-category-label"><strong>{group.name}</strong><span>{group.total}건</span></div><div className="troop-category-track"><div className="troop-category-stack" style={{ width: `${group.total / max * 100}%` }}>{group.troops.map(troop => <button type="button" key={troop.code} className={`troop-chart-segment ${selected?.code === troop.code ? 'selected' : ''}`} style={{ width: `${troop.count / group.total * 100}%`, backgroundColor: troop.color }} aria-label={`${group.name} ${troop.name} ${troop.count}건`} aria-pressed={selected?.code === troop.code} title={`${troop.name}: ${troop.count}건 (${troop.memberCount}명)`} onClick={() => setSelectedCode(troop.code)} />)}</div></div><div className="troop-category-legend">{group.troops.map(troop => <button type="button" key={troop.code} className={selected?.code === troop.code ? 'selected' : ''} onClick={() => setSelectedCode(troop.code)} aria-pressed={selected?.code === troop.code}><i style={{ backgroundColor: troop.color }} /><span>{troop.name}</span><strong>{troop.count}건</strong></button>)}{!group.total && <span className="small muted">선택 없음</span>}</div></div>)}
    </figure>
    {!stats.totalSelections && <div className="empty">선택된 병종이 없습니다. 목록보기에서 캐릭터의 병종을 선택하면 통계에 반영됩니다.</div>}
    {selected && <section className="troop-selection-detail" aria-label={`${selected.name} 선택자`}><div className="section-heading"><h3><i style={{ backgroundColor: selected.color }} />{selected.name} 선택 현황</h3><span className="tag">{selected.count}건 · {selected.memberCount}명</span></div>{selected.participants.map(p => <div className="troop-selection-person" key={`${p.characterId}:${p.slot}`}><strong>{p.memberName || '회원'}</strong><span>{p.characterName || '캐릭터'}{p.gameUid ? ` (${p.gameUid})` : ''}</span><span className="tag">병종{p.slot}</span></div>)}</section>}
  </div>;
}
