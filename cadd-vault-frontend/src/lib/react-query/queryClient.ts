import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes (increased for performance)
      gcTime: 1000 * 60 * 20, // 20 minutes (reduced to save memory)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true, // Enable to refresh data on tab focus
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
});