# 구만에이커 · ACRES

React + Supabase 기반 캐릭터/일반 파티 관리 서비스입니다.
Google 로그인 → 최초 캐릭터 등록 → 메뉴형 대시보드 순서로 진입합니다.

## 시작

1. 구성된 Supabase 프로젝트를 준비합니다. 새 DB 구성이 필요한 경우 별도로 요청해 주세요.
2. Supabase Google OAuth provider와 Redirect URL을 설정합니다.
3. `.env.local`에 공개 URL·공개 키를 설정합니다. 기존 VITE 형식의 공개 설정도 지원합니다.
4. `npm.cmd install` 후 `npm.cmd run dev`를 실행합니다.

서버 Secret 키와 DB 연결 문자열은 프런트엔드에서 사용하지 않습니다. 현재 Supabase에는 업무 테이블과 함수가 적용되어 있습니다. DB 변경은 직접 실행하며, SQL 파일은 별도 요청이 있을 때만 생성합니다.

## 검증

```powershell
npm.cmd test -- --watchAll=false --runInBand
npm.cmd run test:db
npm.cmd run build
```

DB 테스트는 `.env.local`의 `SUPABASE_DB_URL`로 현재 스키마와 공통코드만 읽어 로컬 테스트 메모리에 재현합니다. 실제 회원·파티 데이터는 복사하지 않으며 원격 DB를 변경하지 않습니다.

구현 범위, 사용자 후속 확정 정책, 병종·ADMIN 설정과 남은 확인 사항은 [개발 설정 문서](doc/DEVELOPMENT_SETUP.md)에 정리했습니다.
