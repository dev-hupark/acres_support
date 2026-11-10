import { fireEvent, render, screen, within } from '@testing-library/react';
import ParticipationOverview from './ParticipationOverview';

jest.mock('../lib/supabase', () => ({ rpc: jest.fn(), errorMessage: e => e.message }));

const members = [{ id: 'm1', user_id: 'u1', status: 'APPROVED', display_name: '첫 회원' }];
const characters = [
  { id: 'c1', user_id: 'u1', name: '첫 캐릭터', game_uid: '001', status: 'APPROVED', troop1: 'S1', troop2: 'A' },
  { id: 'c2', user_id: 'u1', name: '둘째 캐릭터', game_uid: '002', status: 'APPROVED', troop1: 'S1', troop2: 'S2' },
];
const troops = [{ code: 'S1', name: '정예 방패', category: 'SHIELD' }, { code: 'S2', name: '일반 방패', category: 'SHIELD' }, { code: 'A', name: '장궁병', category: 'ARCHER' }];
const data = { party: { owner_id: 'u1', departure_date: '2026-11-20' }, members, characters, schedules: [] };

test('list stays the default, statistics tab shows stacked groups and lets users inspect selections', () => {
  render(<ParticipationOverview data={data} troops={troops} onSchedule={jest.fn()} />);
  expect(screen.getByRole('tab', { name: '목록보기' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: '첫 캐릭터 UID 복사' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '병종통계보기' }));
  expect(screen.getByRole('figure', { name: '병종 구분별 선택 통계' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '첫 캐릭터 UID 복사' })).not.toBeInTheDocument();
  const shield = screen.getByRole('button', { name: '방패병 정예 방패 2건' });
  expect(shield).toHaveStyle({ width: `${2 / 3 * 100}%` });
  fireEvent.click(shield);
  expect(screen.getByRole('region', { name: '정예 방패 선택자' })).toHaveTextContent('둘째 캐릭터 (002)');
  fireEvent.click(screen.getByRole('button', { name: '궁병 장궁병 1건' }));
  const selected = screen.getByRole('region', { name: '장궁병 선택자' });
  expect(within(selected).getByText('첫 캐릭터 (001)')).toBeInTheDocument();
  expect(within(selected).queryByText('둘째 캐릭터 (002)')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '목록보기' }));
  expect(screen.getByRole('button', { name: '첫 캐릭터 UID 복사' })).toBeInTheDocument();
});

test('view tabs support keyboard navigation', () => {
  render(<ParticipationOverview data={data} troops={troops} onSchedule={jest.fn()} />);
  fireEvent.keyDown(screen.getByRole('tab', { name: '목록보기' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: '병종통계보기' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: '병종통계보기' })).toHaveAttribute('aria-selected', 'true');
});

test('empty statistics remain visible without invalid bar widths', () => {
  render(<ParticipationOverview data={{ ...data, characters: [] }} troops={troops} onSchedule={jest.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: '병종통계보기' }));
  expect(screen.getByText(/선택된 병종이 없습니다/)).toBeInTheDocument();
  expect(document.querySelectorAll('.troop-chart-segment')).toHaveLength(0);
});

test.each([false, true])('only own characters are editable unless party manager = %s', canManage => {
  const own = { ...characters[0], id: 'own-pc', user_id: 'me', name: '내 캐릭터' };
  render(<ParticipationOverview data={{ ...data, party: { ...data.party, status: 'ACTIVE' }, can_manage: canManage, mine: { status: 'APPROVED' }, members: [...members, { id: 'my-member', user_id: 'me', display_name: '나', status: 'APPROVED' }], characters: [...characters, own] }} troops={troops} profile={{ id: 'me' }} onSchedule={jest.fn()} />);
  expect(screen.getByRole('button', { name: '내 캐릭터 병종 수정' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '첫 캐릭터 병종 수정' }) !== null).toBe(canManage);
  expect(screen.getAllByRole('button', { name: '캐릭터추가' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '캐릭터추가' }));
  expect(screen.getByRole('dialog', { name: '참여 캐릭터 선택' })).toBeInTheDocument();
});
