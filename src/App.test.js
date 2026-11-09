import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

test('party operation member names include game UID and handle absent UID', async () => {
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
  fireEvent.click(await screen.findByRole('button', { name: '운영 관리' }));
  expect(screen.getByText('대기용사 (000123)')).toBeInTheDocument();
  expect(screen.getByText('탈퇴한 회원')).toBeInTheDocument();
  expect(screen.queryByText(/\(null\)|\(undefined\)/)).not.toBeInTheDocument();
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
});
