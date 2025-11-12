import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; mediaId: string }> }
) {
  try {
    const { postId, mediaId } = await params;

    const response = await fetch(
      `${API_BASE_URL}/posts/${postId}/media/${mediaId}/load-large`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading large media:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to load large media' },
      { status: 500 }
    );
  }
}

