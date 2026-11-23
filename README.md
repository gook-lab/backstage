# backstage

FE 개발자가 알아야 할 BE 를 판단 기준 중심으로 정리한 스터디 웹앱입니다.

- 사이트: https://backstage-gook-lab.vercel.app

## 모듈 구성 — 질문 · 글 · 시뮬레이터 · 판단 기준

각 모듈은 FE 가 실제로 부딪히는 질문 하나에서 시작합니다. 블로그형 글로 서버 쪽 사정을 설명하고, 브라우저 안 시뮬레이터로 직접 돌려 본 뒤, 판단 기준 체크리스트로 마무리합니다. 진행률은 브라우저 localStorage 에만 저장합니다.

| 순서 | 모듈                           | 질문                                            |
| ---- | ------------------------------ | ----------------------------------------------- |
| 1    | 페이지네이션 — offset · cursor | 목록 API 가 offset 이면 무엇을 조심해야 하나요? |
| 2    | N+1 쿼리와 인덱스              | 목록 화면 하나 그리는데 왜 API 가 느릴까요?     |
| 3    | 트랜잭션 · 락 · 데드락         | 두 사람이 동시에 저장하면 무슨 일이 생기나요?   |

## 정확성 기준 — 공식 문서 출처 · 예시 수치 표기

글의 주장마다 공식 문서(PostgreSQL · MySQL · RFC · MDN 등)를 근거로 답니다. 지연 시간 같은 수치는 감을 잡기 위한 예시이며 화면에 그렇게 표시합니다. 시뮬레이터 로직은 `src/modules/<id>/model.ts` 순수 함수로 두고 테스트로 고정합니다.

## 개발 — pnpm · Vite · MDX

```sh
pnpm install
pnpm dev
pnpm verify   # lint · format · test · build
```

새 모듈은 `src/modules/<id>/` 폴더 하나(`index.ts` · `Article.mdx` · `Simulator.tsx` · `model.ts`)로 추가하고 `src/modules/index.ts` 에 등록합니다. UI 는 MODUL(`@gook-lab/ui` · `@gook-lab/tokens`)을 씁니다.
