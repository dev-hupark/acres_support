import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ScheduleModal from './ScheduleModal';
import { rpc } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ rpc: jest.fn(), errorMessage: e => e.message }));
const pc = { id: 'pc-1', name: '일정용사', game_uid: '000123' };
let onSaved; let onClose;
const existing = [{ participation_id: pc.id, war_date: '2026-11-20', status: 'PARTIAL', memo: '21시 이후' }];
const show = () => render(<ScheduleModal pc={pc} departureDate="2026-11-20" schedules={existing} onSaved={onSaved} onClose={onClose} />);
beforeEach(() => { jest.clearAllMocks(); rpc.mockResolvedValue(null); onSaved = jest.fn().mockResolvedValue(undefined); onClose = jest.fn(); });

test('12 date buttons show weekdays and status; full attendance saves all dates atomically', async () => {
  show();
  expect(screen.getByRole('dialog', { name: '일정관리' })).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: '출발일 포함 12일 일정' })).getAllByRole('button')).toHaveLength(12);
  expect(screen.getByRole('button', { name: /2026-11-20.*금.*부분 참여/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: '풀참' }));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(rpc).toHaveBeenCalledTimes(1);
  const [name, args] = rpc.mock.calls[0];
  expect(name).toBe('acres_schedule_replace');
  expect(args.p_id).toBe(pc.id);
  expect(args.p_schedules).toHaveLength(12);
  expect(args.p_schedules.every(day => day.status === 'FULL' && day.memo === '')).toBe(true);
  expect(args.p_schedules[11].date).toBe('2026-12-01');
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('per-day changes preserve untouched exceptions', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: /2026-11-21/ }));
  fireEvent.change(screen.getByLabelText('참여 여부'), { target: { value: 'ABSENT' } });
  fireEvent.change(screen.getByLabelText('메모 (선택)'), { target: { value: '출장' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(rpc).toHaveBeenCalled());
  expect(rpc.mock.calls[0][1].p_schedules.slice(0, 2)).toEqual([{ date: '2026-11-20', status: 'PARTIAL', memo: '21시 이후' }, { date: '2026-11-21', status: 'ABSENT', memo: '출장' }]);
});

test('missing PARTIAL memo and server failures keep the modal draft open', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: /2026-11-21/ }));
  fireEvent.change(screen.getByLabelText('참여 여부'), { target: { value: 'PARTIAL' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(screen.getByRole('alert')).toHaveTextContent('부분 참여 메모');
  expect(rpc).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('메모 (필수)'), { target: { value: '22시 이후' } });
  rpc.mockRejectedValueOnce(new Error('권한이 변경되었습니다.'));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('권한이 변경되었습니다.');
  expect(screen.getByLabelText('메모 (필수)')).toHaveValue('22시 이후');
  expect(onClose).not.toHaveBeenCalled();
});

test('Escape closes and focus returns to the opener on unmount', () => {
  const opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
  const { unmount } = show();
  expect(screen.getByRole('button', { name: '일정관리 닫기' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount(); expect(opener).toHaveFocus(); opener.remove();
});

test('read-only schedule modal shows exceptions and memos without editing or saving', () => {
  render(<ScheduleModal pc={pc} departureDate="2026-11-20" schedules={existing} readOnly onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: '일정확인' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /2026-11-20/ }));
  expect(screen.getByText('21시 이후')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  fireEvent.submit(document.querySelector('.schedule-modal form'));
  expect(rpc).not.toHaveBeenCalled();
});
