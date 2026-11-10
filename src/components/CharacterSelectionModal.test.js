import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CharacterSelectionModal from './CharacterSelectionModal';
import { rpc } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ rpc: jest.fn(), errorMessage: e => e.message }));
const characters = [{ id: 'c1', name: '첫 캐릭터', game_uid: '001' }, { id: 'c2', name: '둘째 캐릭터', game_uid: '002' }];
beforeEach(() => { jest.clearAllMocks(); rpc.mockResolvedValue(null); });

test('already participating characters start checked; replacement uses a single atomic RPC', async () => {
  const onSaved = jest.fn().mockResolvedValue(); const onClose = jest.fn();
  render(<CharacterSelectionModal partyId="party" characters={characters} participations={[{ character_id: 'c1', status: 'APPROVED' }]} onSaved={onSaved} onClose={onClose} />);
  expect(screen.getByRole('checkbox', { name: '첫 캐릭터 (001)' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '둘째 캐릭터 (002)' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '첫 캐릭터 (001)' }));
  fireEvent.click(screen.getByRole('checkbox', { name: '둘째 캐릭터 (002)' }));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('acres_participation_set', { p_party: 'party', p_characters: ['c2'] });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

test('pending selection is checked and errors keep the checkbox draft open', async () => {
  const onClose = jest.fn();
  render(<CharacterSelectionModal partyId="party" characters={characters} participations={[{ character_id: 'c1', status: 'PENDING_REAPPROVAL' }, { character_id: 'c2', status: 'EXCLUDED_BY_ADMIN' }]} onSaved={jest.fn()} onClose={onClose} />);
  expect(screen.getByRole('checkbox', { name: /첫 캐릭터.*재승인 대기/ })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: /첫 캐릭터/ }));
  rpc.mockRejectedValueOnce(new Error('생성자의 마지막 참여 캐릭터는 제외할 수 없습니다.'));
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('마지막 참여 캐릭터');
  expect(screen.getByRole('checkbox', { name: /첫 캐릭터/ })).not.toBeChecked();
  expect(onClose).not.toHaveBeenCalled();
});

test('modal traps focus, Escape closes, and cleanup restores focus and scrolling', () => {
  const opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
  const onClose = jest.fn();
  const { unmount } = render(<CharacterSelectionModal partyId="party" characters={characters} participations={[]} onSaved={jest.fn()} onClose={onClose} />);
  const close = screen.getByRole('button', { name: '참여 캐릭터 선택 닫기' });
  expect(close).toHaveFocus(); expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' }); expect(close).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalledTimes(1);
  unmount(); expect(opener).toHaveFocus(); expect(document.body.style.overflow).toBe(''); opener.remove();
});
