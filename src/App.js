import { useCallback, useEffect, useState } from 'react';
import { supabase, errorMessage } from './lib/supabase';
import { Account, Onboarding } from './pages/Account';
import Parties from './pages/Parties';
import SystemManagement from './pages/SystemManagement';
import './App.css';

export function useRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const update = () => setRoute(window.location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}

export const menus = [
  { href: '/account', number: '01', title: '사용자 정보 관리', description: '내 캐릭터를 등록하고 대표 캐릭터를 관리하세요.', active: true },
  { href: '/parties', number: '02', title: '파티 관리', description: '파티 모집부터 참여 캐릭터와 전쟁 일정까지.', active: true },
  { href: '/alliances', number: '03', title: '연맹 관리', description: '연맹 가입과 운영을 위한 공간입니다.', active: false },
  { href: '/calendar', number: '04', title: '공통 랭크 달력', description: '공통 랭크 시작일을 확인하는 공간입니다.', active: false },
  { href: '/system', number: '05', title: '시스템 관리', description: '병종과 서비스 기준 정보를 관리하세요.', active: true, adminOnly: true },
];

export default function App() {
  const route = useRoute();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setAuthLoading(false); }
    });
    supabase.auth.getSession().then(({ data, error: authError }) => {
      if (active) { setSession(data.session); setAuthLoading(false); if (authError) setError(errorMessage(authError)); }
    }).catch(e => { if (active) { setError(errorMessage(e)); setAuthLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    let active = true;
    setProfile(null); setCharacters([]); setLoading(true);
    if (!userId) { setLoading(false); return; }
    setError('');
    (async () => {
      const { data, error: profileError } = await supabase.from('acres_users').select('*').eq('auth_id', userId).maybeSingle();
      if (profileError) throw profileError;
      let owned = [];
      if (data) {
        const result = await supabase.from('acres_characters').select('*').eq('user_id', data.id).order('created_at');
        if (result.error) throw result.error;
        owned = result.data;
      }
      if (active) { setProfile(data); setCharacters(owned); }
    })().catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, version]);

  const login = async () => {
    setLoginBusy(true); setError('');
    try {
      const { error: loginError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname}`, queryParams: { prompt: 'select_account' } } });
      if (loginError) throw loginError;
    } catch (e) { setError(errorMessage(e)); setLoginBusy(false); }
  };
  const logout = async () => {
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) setError(errorMessage(logoutError));
    else window.location.hash = '/';
  };
  if (authLoading) return <main className="center"><p role="status">로그인 상태를 확인하고 있습니다…</p></main>;
  if (!session || !supabase) return <main className="login-layout">
    <section className="login-story"><a className="brand" href="#/">ACRES<span>구만에이커</span></a><div><p className="eyebrow">함께 준비하는 다음 전쟁</p><h1>모이고, 준비하고,<br />함께 출발하세요.</h1><p>나의 캐릭터와 파티를 한곳에서.<br />더 편리한 파티 운영을 시작하세요.</p></div><span className="story-footer">PARTY · CHARACTERS · SCHEDULE</span></section>
    <section className="login-panel"><div className="login-card"><p className="eyebrow">WELCOME TO ACRES</p><h2>로그인</h2><p className="muted">구만에이커는 로그인 후 이용할 수 있습니다.</p>
      {!supabase && <div className="alert" role="alert">Supabase 공개 URL과 공개 키를 설정한 후 앱을 다시 시작해 주세요.</div>}
      {error && <div className="alert" role="alert">{error}</div>}
      <button className="google-button" disabled={!supabase || loginBusy} onClick={login}><span aria-hidden="true" className="google-g">G</span>{loginBusy ? 'Google로 이동 중…' : 'Google 계정으로 로그인'}</button>
      <p className="small muted">처음 방문하셨나요? 로그인 후 게임 캐릭터를 등록하면<br />서비스를 이용할 수 있습니다.</p>
    </div></section>
  </main>;
  const displayName = characters.find(c => c.id === profile?.main_character_id)?.name || '모험가';
  const visibleMenus = menus.filter(m => !m.adminOnly || profile?.role === 'ADMIN');
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#/">ACRES<span>구만에이커</span></a><p className="nav-label">WORKSPACE</p><nav aria-label="주 메뉴">
    <a href="#/" className={route === '/' ? 'selected' : ''}>대시보드</a>
    {visibleMenus.map(m => <a key={m.href} href={`#${m.href}`} className={route.startsWith(m.href) ? 'selected' : ''}>{m.title}{!m.active && <small>준비 중</small>}</a>)}
    {profile?.role === 'ADMIN' && <div className="system-submenu"><a href="#/system/troops" className={route === '/system/troops' ? 'selected' : ''}>병종 관리</a></div>}
    </nav><div className="sidebar-bottom"><span className="avatar">{displayName.slice(0, 1)}</span><div><strong>{displayName}</strong><span className="small muted">{profile?.role === 'ADMIN' ? '운영 관리자' : '나의 워크스페이스'}</span></div><button className="text-button" onClick={logout}>로그아웃</button></div></aside>
    <div className="workspace"><header className="topbar"><span>구만에이커 워크스페이스</span><span className="tag">한국시간 KST</span></header><main className="content">
      {loading ? <p role="status">회원 정보를 불러오고 있습니다…</p> : error ? <div className="panel"><div className="alert" role="alert">{error}</div><button onClick={refresh}>다시 시도</button></div> : !profile ? <Onboarding onDone={refresh} /> : route === '/' ? <>
        <p className="eyebrow">YOUR WORKSPACE</p><h1>{displayName}님, 반갑습니다.</h1><p className="muted intro">필요한 메뉴를 선택해 활동을 시작하세요.</p><div className="menu-grid">{visibleMenus.map(m => <a className="menu-card" href={`#${m.href}`} key={m.href}><span className="menu-number">{m.number}</span><span className="tag">{m.active ? '이용 가능' : '준비 중'}</span><h2>{m.title}</h2><p>{m.description}</p><span className="card-link">{m.active ? '메뉴로 이동' : '개발 예정 안내'} <span aria-hidden="true">↗</span></span></a>)}</div>
      </> : (route === '/system' || route.startsWith('/system/')) ? <SystemManagement key={route} route={route} profile={profile} /> : route === '/account' ? <Account profile={profile} characters={characters} onDone={refresh} /> : route.startsWith('/parties') ? <Parties key={route} route={route} profile={profile} characters={characters} /> : <section className="panel"><p className="eyebrow">COMING SOON</p><h1>{menus.find(m => m.href === route)?.title || '페이지를 찾을 수 없습니다'}</h1><p className="muted">사용자 정보 관리와 일반 파티 관리부터 제공하며, 이 메뉴는 이후 연결됩니다.</p><a className="button" href="#/">대시보드로</a></section>}
    </main></div></div>;
}
