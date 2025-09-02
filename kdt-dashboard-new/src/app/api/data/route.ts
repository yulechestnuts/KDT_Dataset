import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Remote raw CSV on GitHub (latest dataset)
    const remoteUrl =
      'https://raw.githubusercontent.com/yulechestnuts/KDT_Dataset/main/result_kdtdata_202507.csv';

    const res = await fetch(remoteUrl, {
      // Bypass Next.js fetch caching so the client-side revalidation logic in data-loader can manage its own cache.
      cache: 'no-store',
      headers: {
        Accept: 'text/csv',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download CSV from GitHub. Status: ${res.status}`);
    }

    const csv = await res.text();

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
      },
    });
  } catch (error) {
    console.error('[API /api/data] Error fetching remote CSV:', error);
    return new NextResponse('Error fetching data', { status: 500 });
  }
}

// 제발 되면 좋겠다.