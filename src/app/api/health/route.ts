import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Enhanced health check with more details
    return new Response(
      JSON.stringify({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'assistants-chat-ui',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'ERROR', 
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle HEAD requests for health checks
export async function HEAD() {
  return new Response(null, { status: 200 });
}

// Handle other methods that might be used for health checks
export async function POST() {
  return new Response('OK', { status: 200 });
}
