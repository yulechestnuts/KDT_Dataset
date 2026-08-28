// 압축된 JSON 응답 헬퍼
//
// Next.js 의 `compress: true` 는 Route Handler 응답에 걸리지 않는다.
// (chunked 스트리밍으로 나가면서 압축 미들웨어를 우회한다 — 실측으로 확인)
// 이 API 들은 응답이 수 MB 라 압축 유무가 체감 속도를 좌우하므로 직접 압축한다.
// 실측: course-analysis 9.75MB -> gzip 1.07MB (약 9배).

import { NextResponse } from 'next/server';
import { gzipSync } from 'zlib';

/** 이보다 작으면 압축 이득보다 CPU 비용이 크다. */
const MIN_COMPRESS_BYTES = 4096;

/**
 * Vercel 엣지(CDN) 공유 캐시 수명(초).
 *
 * 프로세스 메모리 캐시(cacheManager)는 콜드스타트로 날아가고 인스턴스끼리 공유되지 않아
 * 사용자 대부분이 매번 전체 재계산을 맞았다. 엣지에 짧게 얹어 그 MISS 를 흡수한다.
 *
 * 주의: 이 캐시는 cacheManager.deletePattern / ?flush_cache=1 로 비울 수 없다.
 * CSV 업로드 직후 최대 이 시간만큼 옛 값이 보인다(기존 메모리 캐시 1시간보다는 짧다).
 * 즉시 확인해야 하면 ?no_cache=1 을 붙인다 — 아래에서 캐시 대상에서 제외된다.
 */
const EDGE_CACHE_SECONDS = 60;

/** 캐시 우회 의도가 담긴 요청인지. 이런 요청은 엣지에도 남기지 않는다. */
function isCacheBypass(request: Request): boolean {
  let params: URLSearchParams;
  try {
    params = new URL(request.url).searchParams;
  } catch {
    return true; // URL 파싱 실패 시 캐시하지 않는 쪽이 안전
  }

  return ['no_cache', 'flush_cache'].some((key) => {
    const v = params.get(key);
    return v === '1' || v === 'true';
  });
}

function cacheControlFor(request: Request): string {
  if (request.method !== 'GET' || isCacheBypass(request)) {
    return 'private, no-store';
  }
  // 브라우저는 캐시하지 않고(max-age=0) 공유 캐시만 짧게 — 사용자가 새로고침하면
  // 엣지 히트라 즉시 응답되면서도 TTL 이 지나면 자동으로 갱신된다.
  return `public, max-age=0, s-maxage=${EDGE_CACHE_SECONDS}, stale-while-revalidate=${EDGE_CACHE_SECONDS}`;
}

export function jsonResponse(request: Request, payload: unknown, init?: ResponseInit): Response {
  const body = JSON.stringify(payload);
  const acceptsGzip = /\bgzip\b/i.test(request.headers.get('accept-encoding') ?? '');
  const cacheControl = cacheControlFor(request);

  if (!acceptsGzip || Buffer.byteLength(body, 'utf8') < MIN_COMPRESS_BYTES) {
    return NextResponse.json(payload, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        'Cache-Control': cacheControl,
      },
    });
  }

  const compressed = gzipSync(Buffer.from(body, 'utf8'), { level: 6 });
  return new Response(compressed, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Content-Length': String(compressed.byteLength),
      'Cache-Control': cacheControl,
      Vary: 'Accept-Encoding',
    },
  });
}
