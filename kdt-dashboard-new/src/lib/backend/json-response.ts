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

export function jsonResponse(request: Request, payload: unknown, init?: ResponseInit): Response {
  const body = JSON.stringify(payload);
  const acceptsGzip = /\bgzip\b/i.test(request.headers.get('accept-encoding') ?? '');

  if (!acceptsGzip || Buffer.byteLength(body, 'utf8') < MIN_COMPRESS_BYTES) {
    return NextResponse.json(payload, init);
  }

  const compressed = gzipSync(Buffer.from(body, 'utf8'), { level: 6 });
  return new Response(compressed, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Content-Length': String(compressed.byteLength),
      Vary: 'Accept-Encoding',
    },
  });
}
