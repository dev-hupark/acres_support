import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { rpc, supabase } from './lib/supabase';

jest.mock('./lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signInWithOAuth: jest.fn(), signOut: jest.fn() }, from: jest.fn() },
  rpc: jest.fn(), errorMessage: e => e.message,
}));

const profile = { id: 'user-1', auth_id: 'auth-1', role: 'USER', main_character_id: 'character-1' };
const character = { id: 'character-1', name: '대표용사', game_uid: 'game-uid' };
const session = { user: { id: 'auth-1' } };
let authCallback;
let dbProfile;
let dbError;

beforeEach(() => {
  jest.clearAllMocks();
  window.location.hash = '/';
  dbProfile = profile; dbError = null;
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabase.auth.onAuthStateChange.mockImplementation(callback => { authCallback = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; });
  supabase.auth.signInWithOAuth.mockResolvedValue({ error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.from.mockImplementation(table => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: dbProfile, error: dbError }),
    order: async () => ({ data: table === 'acres_characters' ? [character] : [], error: null }),
  }), order: async () => ({ data: [], error: null }) }) }));
});

test('unauthenticated deep links show only login and use Google OAuth', async () => {
  window.location.hash = '/parties';
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Google 계정으로 로그인' }));
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google', options: expect.objectContaining({ redirectTo: expect.any(String) }) }));
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('authenticated member sees navigation dashboard', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  render(<App />);
  expect(await screen.findByRole('heading', { name: '대표용사님, 반갑습니다.' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '사용자 정보 관리' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '파티 관리' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '시스템 관리' })).not.toBeInTheDocument();
});

test('system ADMIN sees system menu and troop submenu', async () => {
  dbProfile = { ...profile, role: 'ADMIN' };
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  render(<App />);
  await screen.findByRole('heading', { name: '대표용사님, 반갑습니다.' });
  expect(screen.getByRole('link', { name: '시스템 관리' })).toHaveAttribute('href', '#/system');
  expect(screen.getByRole('link', { name: '병종 관리' })).toHaveAttribute('href', '#/system/troops');
});

test('ordinary user cannot open system management with a direct URL', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = '/system/troops';
  render(<App />);
  expect(await screen.findByRole('heading', { name: '접근 권한이 없습니다.' })).toBeInTheDocument();
  expect(rpc).not.toHaveBeenCalled();
});

test('first login requires character onboarding even on a party deep link', async () => {
  dbProfile = null;
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = '/parties';
  render(<App />);
  expect(await screen.findByRole('heading', { name: '첫 캐릭터를 등록해 주세요.' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('캐릭터명'), { target: { value: '새용사' } });
  fireEvent.change(screen.getByLabelText(/게임 UID/), { target: { value: 'uid-new' } });
  rpc.mockRejectedValueOnce(new Error('중복 UID입니다.'));
  fireEvent.click(screen.getByRole('button', { name: '등록하고 시작하기' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('중복 UID입니다.');
  expect(screen.getByLabelText('캐릭터명')).toHaveValue('새용사');
  expect(rpc).toHaveBeenCalledWith('acres_onboard', { p_name: '새용사', p_game_uid: 'uid-new' });
});

test('schema errors are not treated as first-time membership', async () => {
  dbError = new Error('테이블 설정이 필요합니다.');
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('테이블 설정이 필요합니다.');
  expect(screen.queryByRole('heading', { name: '첫 캐릭터를 등록해 주세요.' })).not.toBeInTheDocument();
});

test('sign-out immediately hides account contents', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = '/account';
  render(<App />);
  await screen.findByRole('heading', { name: '사용자 정보 관리' });
  expect(screen.getByText('UID game-uid')).toBeInTheDocument();
  await act(async () => authCallback('SIGNED_OUT', null));
  await screen.findByRole('button', { name: 'Google 계정으로 로그인' });
  expect(screen.queryByText('UID game-uid')).not.toBeInTheDocument();
});

test('passed planned deadline still presents application form; manual close removes it', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const detail = { party: { id, name: '마감 예정 경과 파티', status: 'ACTIVE', owner_id: 'another', departure_date: '2026-11-20', deadline_at: '2020-01-01T00:00:00Z', applications_closed: false }, mine: null, can_read: false, can_manage: false, can_own: false, members: [], characters: [], schedules: [], notices: [] };
  rpc.mockResolvedValue(detail);
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = `/parties/${id}`;
  render(<App />);
  expect(await screen.findByRole('button', { name: '파티 신청' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '참여 현황' })).not.toBeInTheDocument();
  rpc.mockResolvedValue({ ...detail, party: { ...detail.party, applications_closed: true } });
  fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
  await waitFor(() => expect(screen.getByText('생성자가 모집 마감')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '파티 신청' })).not.toBeInTheDocument();
});

test('approved party members get the map tab between notices and management', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const detail = { party: { id, name: '맵 파티', status: 'ACTIVE', owner_id: profile.id, departure_date: '2026-11-20', deadline_at: '2026-11-19T00:00:00Z' }, mine: { status: 'APPROVED' }, can_read: true, can_manage: true, can_own: true, members: [], characters: [], schedules: [], notices: [] };
  rpc.mockImplementation(async name => name === 'acres_map_list' ? [] : detail);
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = `/parties/${id}`;
  render(<App />);
  const map = await screen.findByRole('button', { name: '맵 관리' });
  const names = screen.getAllByRole('button').map(button => button.textContent);
  expect(names.indexOf('맵 관리')).toBe(names.indexOf('파티 공지') + 1);
  expect(names.indexOf('운영 관리')).toBe(names.indexOf('맵 관리') + 1);
  fireEvent.click(map);
  expect(await screen.findByRole('heading', { name: '맵 항목 등록' })).toBeInTheDocument();
});

test('party operation shows member UIDs and pending badge clears after approval', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const members = [
    { id: 'member-1', user_id: 'applicant', display_name: '대기용사', game_uid: '000123', status: 'PENDING' },
    { id: 'member-2', user_id: 'former-user', display_name: '탈퇴한 회원', game_uid: null, status: 'LEFT' },
  ];
  const detail = { party: { id, name: '운영 파티', status: 'ACTIVE', owner_id: profile.id, departure_date: '2026-11-20', deadline_at: '2026-11-19T00:00:00Z' }, mine: { status: 'APPROVED' }, can_read: true, can_manage: true, can_own: true, members, characters: [], schedules: [], notices: [] };
  rpc.mockResolvedValue(detail);
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = `/parties/${id}`;
  render(<App />);
  const management = await screen.findByRole('button', { name: '운영 관리 승인 대기 1명' });
  expect(within(management).getByLabelText('승인 대기 1명')).toHaveTextContent('1');
  fireEvent.click(management);
  expect(screen.getByText('대기용사 (000123)')).toBeInTheDocument();
  expect(screen.getByText('탈퇴한 회원')).toBeInTheDocument();
  expect(screen.queryByText(/\(null\)|\(undefined\)/)).not.toBeInTheDocument();
  rpc.mockImplementation(async name => {
    if (name === 'acres_member_action') { detail.members = members.map(m => m.status === 'PENDING' ? { ...m, status: 'APPROVED' } : m); return null; }
    return detail;
  });
  fireEvent.click(screen.getByRole('button', { name: '승인' }));
  await screen.findByRole('button', { name: '운영 관리' });
  expect(screen.queryByLabelText(/승인 대기 \d+명/)).not.toBeInTheDocument();
});

test('participation status displays the participating character UID beside its name', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const detail = {
    party: { id, name: '참여 파티', status: 'ACTIVE', owner_id: 'other-user', departure_date: '2026-11-20', deadline_at: '2026-11-19T00:00:00Z' },
    mine: { status: 'APPROVED' }, can_read: true, can_manage: false, can_own: false,
    members: [{ id: 'member-1', user_id: 'other-user', display_name: '대표 이름', status: 'APPROVED' }],
    characters: [{ id: 'pc-1', character_id: 'participating-character', user_id: 'other-user', name: '참여 부캐', game_uid: '000789', status: 'APPROVED' }],
    schedules: [], notices: [],
  };
  rpc.mockResolvedValue(detail);
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = `/parties/${id}`;
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '참여 현황' }));
  expect(screen.getByText('참여 부캐 (000789)')).toBeInTheDocument();
  expect(screen.getByText('대표 이름')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '참여 부캐 UID 복사' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('000789'));
  expect(await screen.findByText('복사됨')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /참여 부캐 일정확인/ }));
  const viewDialog = screen.getByRole('dialog', { name: '일정확인' });
  expect(within(viewDialog).queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
  fireEvent.click(within(viewDialog).getByRole('button', { name: '일정확인 닫기' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('merged participation list opens editable schedule modal and refreshes after saving', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const detail = {
    party: { id, name: '내 파티', status: 'ACTIVE', owner_id: profile.id, departure_date: '2026-11-20', deadline_at: '2026-11-19T00:00:00Z' },
    mine: { status: 'APPROVED' }, can_read: true, can_manage: true, can_own: true, members: [{ id: 'm1', user_id: profile.id, display_name: character.name, status: 'APPROVED' }],
    characters: [{ ...character, id: 'pc-1', character_id: character.id, user_id: profile.id, status: 'APPROVED' }], schedules: [], notices: [],
  };
  rpc.mockImplementation(async name => name === 'acres_schedule_replace' ? null : detail);
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = `/parties/${id}`;
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '참여 현황' }));
  expect(screen.queryByRole('button', { name: '캐릭터·일정' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('대표용사 병종1')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const open = screen.getByRole('button', { name: /대표용사 일정확인/ });
  fireEvent.click(open);
  const dialog = screen.getByRole('dialog', { name: '일정관리' });
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(rpc).toHaveBeenCalledWith('acres_schedule_replace', expect.objectContaining({ p_id: 'pc-1', p_schedules: expect.any(Array) }));
});

test.each([['ACTIVE', true], ['DISSOLVED', false]])('manager can edit other members only in an active party (%s)', async (status, editable) => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const detail = {
    party: { id, name: '운영 파티', status, owner_id: 'creator', departure_date: '2026-11-20', deadline_at: '2026-11-19T00:00:00Z' },
    mine: { status: 'APPROVED', is_manager: true }, can_read: true, can_manage: true, can_own: false,
    members: [{ id: 'm-other', user_id: 'other', display_name: '다른 회원', status: 'APPROVED' }],
    characters: [{ id: 'pc-other', user_id: 'other', name: '타인 캐릭터', status: 'APPROVED' }], schedules: [], notices: [],
  };
  rpc.mockResolvedValue(detail);
  supabase.auth.getSession.mockResolvedValue({ data: { session } });
  window.location.hash = `/parties/${id}`;
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: '참여 현황' }));
  expect(screen.queryByRole('button', { name: '타인 캐릭터 병종 수정' }) !== null).toBe(editable);
  fireEvent.click(screen.getByRole('button', { name: /타인 캐릭터 일정확인/ }));
  expect(screen.getByRole('dialog', { name: editable ? '일정관리' : '일정확인' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '저장' }) !== null).toBe(editable);
});
