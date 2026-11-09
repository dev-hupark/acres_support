import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SystemManagement from './SystemManagement';
import { rpc } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ rpc: jest.fn(), errorMessage: e => e.message }));
const categories = [{ code: 'SHIELD', name: '방패병' }, { code: 'ARCHER', name: '궁병' }, { code: 'SPEAR', name: '창병' }, { code: 'CAVALRY', name: '기병' }, { code: 'SIEGE', name: '병기' }];
const troop = { code: 'troop-1', name: '테스트 방패병', category: 'SHIELD', category_name: '방패병', health: 100, rage: 0, movement: 1.5, attack: null, attack_range: null, food_consumption: 2, status: 'ACTIVE', is_used: true };
const show = () => render(<SystemManagement route="/system/troops" profile={{ role: 'ADMIN' }} />);
beforeEach(() => { jest.clearAllMocks(); rpc.mockResolvedValue({ troops: [troop], categories }); });

test('admin adds troop with a common-code category and optional stats', async () => {
  show();
  await screen.findByRole('option', { name: '방패병' });
  fireEvent.change(screen.getByLabelText('병종명'), { target: { value: '새 병종' } });
  fireEvent.change(screen.getByLabelText('구분'), { target: { value: 'ARCHER' } });
  fireEvent.change(screen.getByLabelText('분노'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('이동거리'), { target: { value: '1.5' } });
  fireEvent.click(screen.getByRole('button', { name: '병종 추가' }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('acres_admin_troop_create', { p_name: '새 병종', p_category: 'ARCHER', p_health: null, p_rage: 0, p_movement: 1.5, p_attack: null, p_attack_range: null, p_food_consumption: null }));
});

test('troops are deactivated and reactivated without a delete action', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  let active = true;
  rpc.mockImplementation(async (name, args) => {
    if (name === 'acres_admin_troop_status') { active = args.p_status === 'ACTIVE'; return null; }
    return { troops: [{ ...troop, status: active ? 'ACTIVE' : 'INACTIVE' }], categories };
  });
  show();
  fireEvent.click(await screen.findByRole('button', { name: '테스트 방패병 비활성화' }));
  expect(await screen.findByRole('button', { name: '테스트 방패병 활성화' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '테스트 방패병 활성화' }));
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('acres_admin_troop_status', { p_code: 'troop-1', p_status: 'ACTIVE' }));
  expect(screen.queryByRole('button', { name: /삭제/ })).not.toBeInTheDocument();
  confirm.mockRestore();
});
