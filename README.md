# 구만에이커 · ACRES

React + Supabase 기반 캐릭터/일반 파티 관리 서비스입니다.
Google 로그인 → 최초 캐릭터 등록 → 메뉴형 대시보드 순서로 진입합니다.

## 시작

1. `supabase/migrations/`의 SQL을 파일명 순서대로 Supabase SQL Editor에서 각각 한 번 실행합니다. 이미 적용한 마이그레이션은 재실행하지 마세요.
2. Supabase Google OAuth provider와 Redirect URL을 설정합니다.
3. `.env.local`에 공개 URL·공개 키를 설정합니다. 기존 VITE 형식의 공개 설정도 지원합니다.
4. `npm.cmd install` 후 `npm.cmd run dev`를 실행합니다.

서버 Secret 키와 DB 연결 문자열은 프런트엔드에서 사용하지 않습니다. 현재 개발용 Supabase에는 초기 테이블과 맵 마이그레이션이 적용되어 있으므로 중복 실행하지 마세요. 위 설치 순서는 새 프로젝트 구성 시 사용합니다.

## 검증

```powershell
npm.cmd test -- --watchAll=false --runInBand
npm.cmd run test:db
npm.cmd run build
```

구현 범위, 사용자 후속 확정 정책, SQL 적용 순서, 병종·ADMIN 설정과 남은 확인 사항은 [개발 설정 문서](doc/DEVELOPMENT_SETUP.md)에 정리했습니다.
