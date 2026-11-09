# 개발 및 Supabase 설정

기준 문서: `ACRES_RANK_SYSTEM_DESIGN_V5.txt`, `ACRES_RANK_SYSTEM_DESIGN_V5_1.txt`, `ACRES_REACT_SUPABASE_REVIEW.txt`.
아래 후속 확정 사항이 기존 문서와 충돌하면 우선합니다.

## 이번에 반영한 범위

- 비로그인 상태에서는 로그인 화면만 표시. Supabase Google OAuth를 사용합니다.
- 최초 로그인 후 캐릭터명·게임 UID 등록을 완료해야 업무 메뉴를 이용합니다.
- 대시보드는 통계 대신 메뉴 목록을 표시합니다.
- 사용자 정보: 캐릭터 등록/수정/삭제, UID 중복 검증, 대표 지정. 마지막 대표를 삭제하면 남은 캐릭터를 대표로 지정하며, 보유 캐릭터가 없으면 대표는 없습니다.
- 일반 파티: 모집/내 목록, 검색/페이지 이동, 생성, 직접 링크, 신청/재신청/취소, 승인/반려, 탈퇴/강퇴/차단 해제, 추가 관리자 지정/해제, 참여 캐릭터 추가/교체/본인 제외/관리자 제외/재승인, 병종, 12일 일정, 공지 작성/수정/삭제/고정, 해체.
- 연맹·연맹 전용 파티·공통 랭크 달력은 후속 개발이며 메뉴에 준비 중으로 표시합니다. 이 기능의 테이블을 동작하지 않는 빈 기능으로 선생성하지 않았습니다.
- 병종은 운영자가 등록. 계정 탈퇴는 개인정보 보존·삭제 정책 확정 후 연결합니다.
- 시스템 ADMIN 전용 시스템 관리/병종 관리 메뉴를 추가했습니다. 병종명·구분·6개 능력치 등록과 활성/비활성 전환을 지원합니다. 공통코드 테이블과 5개 병종 구분은 [시스템 관리 설계](SYSTEM_MANAGEMENT.md)를 참고하세요. `202611090005_system_troops.sql` 적용이 필요하며 현재 개발용 Supabase에는 적용 완료했습니다.
- 파티 운영 관리 회원 목록은 현재 대표 캐릭터의 `닉네임 (게임 UID)`를 표시합니다. UID가 없으면 닉네임만 표시하며, UID는 운영 권한이 있는 조회자에게만 반환합니다. `202611090003_party_member_game_uid.sql`은 조회 함수를 갱신하며 개발용 Supabase에 적용했습니다. 기존 회원/캐릭터 데이터는 변경하지 않았습니다.
- 참여 현황 및 캐릭터 추가·교체 선택 항목은 `캐릭터명 (게임 UID)`를 표시합니다. 실제 참여 캐릭터의 UID를 사용하며, 승인된 파티원에게 조회를 허용합니다. `202611090004_party_character_game_uid.sql`을 개발용 Supabase에 적용했습니다. 운영 관리의 대표 캐릭터 UID는 계속 운영 권한으로 제한합니다.

## 2026-11-09 사용자 후속 확정

1. 예정 마감 일시가 지나도 신청/재신청을 허용합니다. 날짜를 이유로 자동 마감하지 않습니다. 과거 예정 마감 일시도 저장할 수 있습니다.
2. 파티 생성자가 직접 모집 마감하면 신청/재신청을 차단합니다. 추가 관리자는 모집 마감할 수 없습니다. 기존 대기 신청 승인/반려와 승인 회원의 참여 캐릭터·병종·일정 관리는 계속 가능합니다.
3. 탈퇴·강퇴한 회원은 파티 목록 수준의 기본 정보만 조회할 수 있습니다. 회원 목록·참여 캐릭터·일정·공지 조회는 차단합니다. 시스템 ADMIN의 예외 권한은 유지합니다.
4. 일반 파티 전체 기능 우선, 연맹 전용 파티는 연맹 개발 때 연결합니다.
5. 병종은 운영 등록, 계정 탈퇴는 정책 확정 후 연결합니다.

원문에서 그대로 유지한 규칙: 출발일이 지난 파티는 모집 목록에서 제외하지만 직접 링크 신청 가능, 생성자 최소 참여 캐릭터 1개, 출발 후 캐릭터 변경, 신청과 참여 캐릭터 분리, 관리자 제외와 본인 제외 구분, 마감 예정일 변경은 생성자만 가능.

구현 선택: 생성자·추가 관리자·ADMIN은 캐릭터 재승인/거절 가능하며, 거절하면 EXCLUDED_BY_ADMIN으로 되돌립니다. 신규 파티 출발일은 KST 오늘 이후입니다. 별도 모집 재개 기능은 아직 없으며, 마감 버튼 확인창에서 신청 차단을 안내합니다. 생성자/ADMIN만 파티 해체 가능. 입력 길이는 DB와 화면에 같은 제한을 적용했습니다.

## DDL 실행 가능 여부

현재 개발용 Supabase에는 초기 테이블과 맵 마이그레이션이 적용되어 있습니다. `.env.local`에 `SUPABASE_DB_URL`을 추가한 뒤 직접 DB 연결과 DDL 권한도 확인했습니다. 연결 문자열·비밀번호는 저장소에 포함하지 않습니다. 공개 API 키·서버 Secret 키와 DDL 실행용 DB 인증정보는 서로 다른 값입니다.

새 Supabase 프로젝트를 구성할 경우 아래 SQL 파일을 Supabase Dashboard의 **SQL Editor**에서 한 번 실행한 뒤 맵 마이그레이션을 순서대로 적용합니다. 이미 적용한 프로젝트에는 중복 실행하지 않습니다.

`supabase/migrations/202611090001_initial.sql`

이 파일에는 테이블뿐 아니라 FK/UNIQUE/CHECK, 인덱스, RLS, DB 함수(RPC), 실행 권한이 모두 포함됩니다. **빈 프로젝트의 신규 설치용**입니다. 기존에 같은 이름의 `acres_*` 객체가 있으면 그대로 덮어쓰지 말고 기존 스키마와 비교하세요. 실행 전체가 트랜잭션이므로 오류 발생 시 전체를 롤백합니다. 재실행용 DROP이나 데이터 초기화 구문은 포함하지 않았습니다.

생성 테이블 (초기 마이그레이션 기준):

| 테이블 | 용도 |
| --- | --- |
| acres_users | 업무 회원, 인증 사용자 연결, 대표 캐릭터, 시스템 역할 |
| acres_characters | 회원 소유 캐릭터와 게임 UID |
| acres_troops | 운영 등록 병종 코드 |
| acres_parties | 일반 파티와 수동 모집 마감 여부 |
| acres_party_members | 회원별 현재 신청/승인 상태, 관리자, 차단 여부 |
| acres_party_characters | 파티별 캐릭터 참여 상태와 병종 |
| acres_schedules | 캐릭터별 ABSENT/PARTIAL 예외 일정 |
| acres_notices | 텍스트 공지와 고정 여부 |

파티 맵이 추가되었습니다. 맵 테이블/RPC는 `supabase/migrations/202611090002_party_map.sql`을 초기 마이그레이션 다음에 적용합니다. 좌표·권한·동시 수정·점유 규칙은 [파티 맵 설계](PARTY_MAP.md)를 참고하세요.

회원과 캐릭터는 원형 참조를 가지므로 대표 캐릭터 소유 FK는 트랜잭션 종료 시 검사합니다. 모든 업무 변경은 RPC를 통하며, 브라우저의 직접 INSERT/UPDATE/DELETE는 허용하지 않습니다. 비로그인은 테이블/RPC에 접근할 수 없습니다. 조회는 본인 회원·본인 캐릭터·병종만 RLS로 직접 허용하고, 파티 정보는 호출자의 현재 권한을 검증한 RPC로 반환합니다. `acres_private`는 Data API의 exposed schemas에 추가하지 마세요.

## Google OAuth 설정

1. Google Cloud Console에서 웹 애플리케이션 OAuth Client ID를 준비합니다.
2. Supabase Authentication의 Google provider를 활성화하고 Client ID/Secret을 설정합니다.
3. Google OAuth의 Authorized redirect URI에는 Supabase가 표시하는 callback URL을 그대로 등록합니다. 일반적으로 `https://<project-ref>.supabase.co/auth/v1/callback` 형식입니다.
4. Supabase Auth URL Configuration에서 로컬 Redirect URL `http://localhost:3000/`과 실제 배포 URL을 허용합니다. Site URL도 실제 서비스 URL에 맞춥니다.
5. 앱의 Google 로그인 버튼으로 테스트합니다. 앱은 현재 origin/path를 callback 목적지로 보내며, 성공 후 대시보드로 이동합니다. 신규 회원은 먼저 캐릭터 등록을 완료합니다.

Google/Supabase 콘솔 설정은 코드로 자동 변경하지 않았습니다.

## 로컬 실행

기존 `.env.local`은 보존했습니다. 이 프로젝트는 Create React App입니다. 다음 두 방식 중 하나로 공개 설정을 지정할 수 있습니다.

```dotenv
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

기존 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`도 `scripts/react.js`가 위 두 이름으로만 매핑합니다. **SUPABASE_SECRET_KEY/service_role은 클라이언트에서 읽지 않으며 프런트용 접두사를 붙이면 안 됩니다.** 설정을 바꾸면 개발 서버를 다시 시작하세요.

```powershell
npm.cmd install
npm.cmd start
```

PowerShell 실행 정책 때문에 npm.ps1이 차단되는 경우를 고려해 `npm.cmd`를 표기했습니다. `http://localhost:3000`에서 확인합니다. 해시 라우팅을 사용하므로 정적 호스팅에서 별도의 SPA rewrite 없이 파티 직접 링크를 사용할 수 있습니다.

## 병종 및 ADMIN 운영 설정

실제 병종 목록은 임의로 추가하지 않았습니다. 시스템 ADMIN으로 로그인해 시스템 관리 → 병종 관리에서 구분과 능력치를 입력해 등록하세요. 병종이 없어도 미지정 저장과 일정 관리는 가능합니다. SQL Editor로 직접 등록해야 하는 경우에는 다음 형식을 사용할 수 있습니다.

```sql
-- 아래 값은 형식 설명용이므로 실제 코드/이름으로 교체해서 실행하세요.
insert into public.acres_troops(code, name, category, sort_order)
values ('실제_병종_코드', '실제 병종명', 'SHIELD', 1);
```

최초 ADMIN은 대상 사용자가 Google 로그인과 온보딩을 완료한 후 SQL Editor에서 지정합니다.

```sql
-- Authentication > Users에서 대상 UUID를 확인하고 교체하세요.
update public.acres_users set role = 'ADMIN'
where auth_id = '대상_인증_UUID'::uuid;
```

브라우저에서 ROLE을 수정하는 API는 제공하지 않습니다. FK가 연결된 병종 코드는 함부로 삭제하지 말고 이름/정렬을 수정하세요.

## 검증과 남은 실제 환경 확인

```powershell
npm.cmd test -- --watchAll=false --runInBand
npm.cmd run test:db
npm.cmd run build
```

`test:db`는 PGlite의 로컬 PostgreSQL 엔진에 `auth.users`/`auth.uid()`와 역할을 재현하여 실제 마이그레이션과 RPC를 실행합니다. 원격 Supabase에는 접근하지 않습니다. FK/RLS/권한·상태 전이·전체 롤백·캐릭터 교체·수동 마감 정책을 검증하며, 여러 원격 세션 간 잠금 부하 테스트나 Supabase Auth 내부 동작 검증을 대체하지는 않습니다.

실제 Supabase SQL 적용 후 Google OAuth 왕복, 신규 가입, 서로 다른 2개 계정의 승인/강퇴/권한 차단, 모바일 화면을 확인해야 합니다. 실제 원격 환경의 로그인 성공이나 DB 적용 성공은 아직 검증하지 않았습니다.

기술 근거:

- [Supabase React Auth](https://supabase.com/docs/guides/auth/quickstarts/react)
- [Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [DB functions and privileges](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
