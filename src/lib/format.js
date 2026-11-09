export const labels = { PENDING: '승인 대기', APPROVED: '승인', REJECTED: '반려', CANCELED: '신청 취소', LEFT: '탈퇴', KICKED: '강퇴', ACTIVE: '활성', DISSOLVED: '해체', REMOVED_BY_USER: '본인 제외', EXCLUDED_BY_ADMIN: '관리자 제외', PENDING_REAPPROVAL: '재승인 대기', FULL: '전체 참여', PARTIAL: '부분 참여', ABSENT: '불참' };
export const kstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const dateTime = value => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
export const toInstant = value => new Date(`${value}:00+09:00`).toISOString();
export function daysFrom(start) {
  return Array.from({ length: 12 }, (_, index) => {
    const day = new Date(`${start}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}
