import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ParticipationSummaryRow from './ParticipationSummaryRow';
import { rpc } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ rpc: jest.fn(), errorMessage: e => e.message }));
beforeEach(() => { jest.clearAllMocks(); rpc.mockResolvedValue(null); });

const pc = { id: 'pc-1', name: '참여 캐릭터', game_uid: '000123', troop1: 'A', troop2: 'B' };
const troops = [{ code: 'A', name: '병종 하나' }, { code: 'B', name: '병종 둘' }];
test('full attendance is blue, and unrelated character schedules do not affect it', () => {
  const onSchedule = jest.fn();
  render(<ParticipationSummaryRow pc={pc} troops={troops} schedules={[{ participation_id: 'another', war_date: '2026-11-20', status: 'ABSENT' }]} departureDate="2026-11-20" onSchedule={onSchedule} />);
  expect(screen.getByText('참여 캐릭터 (000123)')).toBeInTheDocument();
  expect(screen.getByText('병종 하나 · 병종 둘')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '참여 캐릭터 UID 복사' })).toBeInTheDocument();
  const button = screen.getByRole('button', { name: /참여 캐릭터 일정확인/ });
  expect(button).toHaveClass('is-full');
  fireEvent.click(button);
  expect(onSchedule).toHaveBeenCalledWith(pc.id);
});

test.each(['PARTIAL', 'ABSENT'])('%s makes the schedule button use default styling', status => {
  render(<ParticipationSummaryRow pc={pc} troops={troops} schedules={[{ participation_id: pc.id, war_date: '2026-11-20', status }]} departureDate="2026-11-20" onSchedule={jest.fn()} />);
  expect(screen.getByRole('button', { name: /참여 캐릭터 일정확인/ })).not.toHaveClass('is-full');
});

test('editable row only shows selects after edit, saves both slots, and closes after refresh', async () => {
  const onSaved = jest.fn().mockResolvedValue();
  render(<ParticipationSummaryRow pc={pc} troops={troops} schedules={[]} departureDate="2026-11-20" editable onSaved={onSaved} onSchedule={jest.fn()} />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '참여 캐릭터 병종 수정' }));
  expect(screen.getByLabelText('참여 캐릭터 병종1')).toHaveValue('A');
  fireEvent.change(screen.getByLabelText('참여 캐릭터 병종2'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  expect(rpc).toHaveBeenCalledWith('acres_participation_save', { p_id: pc.id, p_troop1: 'A', p_troop2: '' });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('read-only row hides edit and a rejected save preserves the draft', async () => {
  const { rerender } = render(<ParticipationSummaryRow pc={pc} troops={troops} schedules={[]} departureDate="2026-11-20" onSchedule={jest.fn()} />);
  expect(screen.queryByRole('button', { name: /병종 수정/ })).not.toBeInTheDocument();
  rerender(<ParticipationSummaryRow pc={pc} troops={troops} schedules={[]} departureDate="2026-11-20" editable onSaved={jest.fn()} onSchedule={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '참여 캐릭터 병종 수정' }));
  fireEvent.change(screen.getByLabelText('참여 캐릭터 병종2'), { target: { value: 'A' } });
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('참여 캐릭터 병종2'), { target: { value: '' } });
  rpc.mockRejectedValueOnce(new Error('관리 권한이 변경되었습니다.'));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('관리 권한이 변경되었습니다.');
  expect(screen.getByLabelText('참여 캐릭터 병종2')).toHaveValue('');
});
