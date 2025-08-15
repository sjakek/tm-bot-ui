import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import ChatInterface from '@/components/ChatInterface';

export default async function HomePage() {
  const authResult = await requireAuth();
  
  if (!authResult.authenticated) {
    redirect(authResult.redirect);
  }

  return <ChatInterface />;
}