import { lazy } from 'react';
import type { StudyModule } from '../types';

export const module: StudyModule = {
  id: 'money-amounts',
  track: 'cases',
  order: 47,
  title: '금액 계산과 표현 — 소수점 · 반올림 · 통화 단위',
  question: '화면 합계가 서버 금액과 1원씩 달라지는 건 왜일까요?',
  summary:
    'JavaScript Number는 0.1 같은 소수를 정확히 담지 못해서, 소수로 곱하고 나누면 작은 오차가 생겨요. 서버는 금액을 최소 단위 정수로 저장하고, 줄마다 반올림할지 합계 뒤에 한 번 반올림할지 정해 둬요. 이 글은 반올림 방식, 통화 자릿수, 1원 차이 처리, API 전달 형식을 다뤄요.',
  minutes: 18,
  tags: ['금액', '부동소수점', 'DB', 'API', '반올림'],
  checklist: [
    {
      id: 'float-binary',
      text: '0.1이 이진 부동소수점으로 정확히 담기지 않는다는 것을 예로 설명할 수 있어요.',
    },
    {
      id: 'minor-unit',
      text: '금액을 통화의 최소 단위 정수로 저장하는 이유를 설명할 수 있어요.',
    },
    {
      id: 'currency-digits',
      text: '통화 코드마다 소수 자릿수가 다르다는 것을 ISO 4217 목록에서 확인할 수 있어요.',
    },
    {
      id: 'rounding-mode',
      text: '0.5를 올리는 반올림, 내림, 올림, 은행가 반올림이 같은 값에서 서로 다른 결과를 낸다는 것을 말할 수 있어요.',
    },
    {
      id: 'rounding-order',
      text: '줄마다 반올림한 합계와 합계 뒤에 한 번 반올림한 합계가 1 최소 단위 달라질 수 있다는 것을 계산해 볼 수 있어요.',
    },
    {
      id: 'api-format',
      text: 'API에서 금액을 정수 최소 단위와 통화 코드로 주고받고, 화면 표시만 Intl.NumberFormat으로 할 수 있어요.',
    },
  ],
  sources: [
    {
      title: 'MDN — Number (안전한 정수 범위, MAX_SAFE_INTEGER)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number',
    },
    {
      title: 'MDN — Number.EPSILON (1과 다음 수의 차이, 큰 수의 절대 정밀도)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON',
    },
    {
      title: 'MDN — BigInt (Number와 섞어 연산할 수 없음)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt',
    },
    {
      title: 'MDN — 숫자와 날짜 가이드 (IEEE 754 배정도, BigInt 나눗셈)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Numbers_and_dates',
    },
    {
      title: 'MDN — Intl.NumberFormat (통화 형식과 소수 단위 없는 엔화 예제)',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat',
    },
    {
      title: 'ECMAScript 명세 — Number 타입 (IEEE 754-2019 binary64)',
      url: 'https://tc39.es/ecma262/',
    },
    {
      title: 'ECMA-402 Intl 명세 — roundingMode와 CurrencyDigits',
      url: 'https://tc39.es/ecma402/',
    },
    {
      title: 'Goldberg, What Every Computer Scientist Should Know About Floating-Point Arithmetic (0.1의 2진 표현)',
      url: 'https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html',
    },
    {
      title: 'PostgreSQL 문서 — 숫자 자료형 (numeric과 decimal)',
      url: 'https://www.postgresql.org/docs/current/datatype-numeric.html',
    },
    {
      title: 'PostgreSQL 문서 — 금액 자료형 (money)',
      url: 'https://www.postgresql.org/docs/current/datatype-money.html',
    },
    {
      title: 'Stripe 문서 — Currencies (API 금액은 통화의 최소 단위)',
      url: 'https://docs.stripe.com/currencies',
    },
    {
      title: 'ISO 4217 통화 목록 (SIX 공개 XML, 최소 단위 값)',
      url: 'https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml',
    },
  ],
  Article: lazy(() => import('./Article.mdx')),
  Simulator: lazy(() => import('./Simulator')),
};
