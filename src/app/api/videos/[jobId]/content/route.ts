import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchOpenRouterVideoContent } from '@/infrastructure/openrouter/openrouter-video-content';
import { toErrorResponse } from '../../../_lib/http';

const JOB_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MOCK_CLIP_PATH = path.join(
  process.cwd(),
  'public',
  'fixtures',
  'sample-clip.mp4',
);

interface VideoContentRouteContext {
  params: Promise<{ jobId: string }>;
}

async function serveMockClip(
  download: boolean,
  jobId: string,
): Promise<Response> {
  try {
    const clip = await readFile(MOCK_CLIP_PATH);
    const headers = new Headers({
      'Content-Type': 'video/mp4',
      'Content-Length': String(clip.byteLength),
      'Cache-Control': 'private, max-age=3600',
    });

    if (download) {
      headers.set(
        'Content-Disposition',
        `attachment; filename="driftzero-${jobId}.mp4"`,
      );
    }

    return new Response(new Uint8Array(clip), {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'MOCK_CLIP_MISSING',
          message: 'The mock sample clip is not available on this server.',
          details: {},
        },
      },
      { status: 404 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: VideoContentRouteContext,
) {
  try {
    const { jobId } = await context.params;
    const normalizedJobId = jobId.trim();
    const download = request.nextUrl.searchParams.get('download') === '1';

    if (!JOB_ID_PATTERN.test(normalizedJobId) || normalizedJobId.includes('..')) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_JOB_ID',
            message:
              'The video job ID must contain only letters, numbers, dots, underscores, or hyphens.',
            details: {},
          },
        },
        { status: 400 },
      );
    }

    if (normalizedJobId.startsWith('mock-')) {
      return await serveMockClip(download, normalizedJobId);
    }

    const upstream = await fetchOpenRouterVideoContent(
      normalizedJobId,
      download ? undefined : (request.headers.get('range') ?? undefined),
    );

    const headers = new Headers({
      'Content-Type': upstream.contentType,
      'Cache-Control': 'private, max-age=3600',
    });

    if (download) {
      headers.set(
        'Content-Disposition',
        `attachment; filename="driftzero-${normalizedJobId}.mp4"`,
      );
    }

    if (upstream.contentLength !== null) {
      headers.set('Content-Length', upstream.contentLength);
    }
    if (upstream.contentRange !== null) {
      headers.set('Content-Range', upstream.contentRange);
    }
    if (upstream.acceptRanges !== null) {
      headers.set('Accept-Ranges', upstream.acceptRanges);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
