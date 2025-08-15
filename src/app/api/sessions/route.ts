import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    console.warn('[SessionsAPI] Unauthorized GET');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDatabase();
    console.log('[SessionsAPI] Listing sessions');
    const sessions = db.getAllSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, assistant_id } = await request.json();

    if (!name || !assistant_id) {
      return NextResponse.json(
        { error: 'Name and assistant_id are required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const session = db.createSession(name, assistant_id);
    
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}