import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PartyMap, { MapCanvas } from './PartyMap';
import { rpc } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ rpc: jest.fn(), errorMessage: error => error.message }));
const entry = { id: 'map-1', alias: '전초기지', x: 0, y: 0, faction: 'FRIENDLY', memo: '공동 관리', is_dead: 'N', version: 3, created_at: '2026-11-09T00:00:00Z', updated_at: '2026-11-09T01:00:00Z' };
beforeEach(() => { jest.clearAllMocks(); rpc.mockResolvedValue([entry]); });

test('map draws exact footprints with inverted SVG Y and other at upper right', () => {
  render(<MapCanvas entries={[entry, { ...entry, id: 'corner', x: 600, y: 600, faction: 'OTHER', is_dead: 'Y' }]} onSelect={jest.fn()} onCoordinate={jest.fn()} />);
  const origin = screen.getByTestId('map-footprint-map-1');
  expect(origin).toHaveAttribute('y', '599');
  expect(origin).toHaveAttribute('width', '2');
  const corner = screen.getByTestId('map-footprint-corner');
  expect(corner).toHaveAttribute('x', '600');
  expect(corner).toHaveAttribute('y', '0');
  expect(corner).toHaveAttribute('width', '1');
  expect(corner).toHaveAttribute('fill', '#8a929b');
});

test('an ordinary approved member can edit a shared entry and sends the expected version', async () => {
  rpc.mockImplementation(async (name, args) => name === 'acres_map_save' ? { ...entry, ...args, version: 4 } : [entry]);
  render(<PartyMap partyId="party-1" partyStatus="ACTIVE" />);
  fireEvent.click(await screen.findByRole('button', { name: /전초기지, 아군/ }));
  fireEvent.change(screen.getByLabelText('별칭'), { target: { value: '새 별칭' } });
  fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('acres_map_save', expect.objectContaining({ p_party: 'party-1', p_id: 'map-1', p_version: 3, p_alias: '새 별칭', p_x: 0, p_y: 0 })));
});

test('stale edits keep input and show conflict instead of overwriting silently', async () => {
  rpc.mockImplementation(async name => { if (name === 'acres_map_save') throw new Error('다른 회원이 수정했습니다.'); return [entry]; });
  render(<PartyMap partyId="party-1" partyStatus="ACTIVE" />);
  fireEvent.click(await screen.findByRole('button', { name: /전초기지, 아군/ }));
  fireEvent.change(screen.getByLabelText('별칭'), { target: { value: '내 수정안' } });
  fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('다른 회원이 수정했습니다.');
  expect(screen.getByLabelText('별칭')).toHaveValue('내 수정안');
});

test('dissolved parties permit inspecting but disable edits and delete', async () => {
  render(<PartyMap partyId="party-1" partyStatus="DISSOLVED" />);
  fireEvent.click(await screen.findByRole('button', { name: /전초기지, 아군/ }));
  expect(screen.getByLabelText('별칭')).toBeDisabled();
  expect(screen.getByRole('button', { name: '변경 저장' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '선택 항목 삭제' })).toBeDisabled();
});

test('failed reads show an error and disable writes', async () => {
  rpc.mockRejectedValue(new Error('승인된 파티원만 조회할 수 있습니다.'));
  render(<PartyMap partyId="party-1" partyStatus="ACTIVE" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('승인된 파티원만');
  expect(screen.getByLabelText('별칭')).toBeDisabled();
});

test('OTHER uses boundary 600 and gets a single cell while other factions stop at 599', async () => {
  render(<PartyMap partyId="party-1" partyStatus="ACTIVE" />);
  await screen.findByRole('button', { name: /전초기지, 아군/ });
  expect(screen.getByLabelText('X 좌표')).toHaveAttribute('max', '599');
  fireEvent.change(screen.getByLabelText('세력'), { target: { value: 'OTHER' } });
  expect(screen.getByLabelText('X 좌표')).toHaveAttribute('max', '600');
});
