import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null;

export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export function errorMessage(error) {
  if (error?.code === '23505') return '이미 사용 중인 게임 UID이거나 중복된 요청입니다.';
  if (['PGRST202', '42P01', '42883', 'PGRST205'].includes(error?.code)) {
    return '서비스 테이블이 준비되지 않았습니다. Supabase SQL 설정을 확인해 주세요.';
  }
  if (error?.code === '42501') return '이 작업을 수행할 권한이 없습니다. 새로고침 후 다시 확인해 주세요.';
  return error?.message || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
