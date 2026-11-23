import { Link } from 'react-router';

export function NotFound() {
  return (
    <section>
      <h1>찾는 글이 없어요</h1>
      <p>
        <Link to="/">로드맵으로 돌아가기</Link>
      </p>
    </section>
  );
}
