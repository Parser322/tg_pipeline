export const queryKeys = {
  posts: ['posts'] as const,
  status: ['status'] as const,
  channel: {
    current: ['channel', 'current'] as const,
    check: (username: string) => ['channel', 'check', username] as const,
  },
} as const;


