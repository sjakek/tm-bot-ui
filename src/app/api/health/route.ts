import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple health check - just return 200 OK
    return NextResponse.json(
      { 
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'assistants-chat-ui'
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Health check failed'
      },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  // Support HEAD requests for health checks
  return new NextResponse(null, { status: 200 });
}
