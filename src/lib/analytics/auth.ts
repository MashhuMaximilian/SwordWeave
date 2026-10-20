type Attempt = { status: string | null; createdSessionId: string | null; createdUserId?: string | null };
type Completion = { session?: { id: string } | null; user?: { id: string } | null; client?: { signUp?: Attempt; signIn?: Attempt } | null };
export function completedAuthAttempt({ client, session, user }: Completion) {
  if (!session || !user) return null;
  if (client?.signUp?.status === 'complete' && client.signUp.createdSessionId === session.id && client.signUp.createdUserId === user.id) return 'sign_up';
  if (client?.signIn?.status === 'complete' && client.signIn.createdSessionId === session.id) return 'login';
  return null;
}
