import { fireEvent, render, screen } from '@testing-library/react';
import ParticipationSummaryRow from './ParticipationSummaryRow';

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
