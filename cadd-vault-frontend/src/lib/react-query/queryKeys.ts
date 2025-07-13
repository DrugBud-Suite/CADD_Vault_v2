export const queryKeys = {
  all: ['cadd-vault'] as const,
  
  packages: {
    all: () => [...queryKeys.all, 'packages'] as const,
    lists: () => [...queryKeys.packages.all(), 'list'] as const,
    list: (filters?: Record<string, any>) => 
      [...queryKeys.packages.lists(), filters] as const,
    infinite: (filters?: Record<string, any>) => 
      [...queryKeys.packages.all(), 'infinite', filters] as const,
    details: () => [...queryKeys.packages.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.packages.details(), id] as const,
    search: (term: string) => [...queryKeys.packages.all(), 'search', term] as const,
    withTag: (tag: string) => [...queryKeys.packages.all(), 'tag', tag] as const,
  },
  
  ratings: {
    all: () => [...queryKeys.all, 'ratings'] as const,
    package: (packageId: string) => [...queryKeys.ratings.all(), packageId] as const,
    user: (packageId: string, userId: string) => 
      [...queryKeys.ratings.package(packageId), userId] as const,
  },
  
  suggestions: {
    all: () => [...queryKeys.all, 'suggestions'] as const,
    lists: () => [...queryKeys.suggestions.all(), 'list'] as const,
    list: (status?: string) => [...queryKeys.suggestions.lists(), status] as const,
    detail: (id: string) => [...queryKeys.suggestions.all(), id] as const,
    user: (userId: string) => [...queryKeys.suggestions.all(), 'user', userId] as const,
  },
  
  metadata: {
    all: () => [...queryKeys.all, 'metadata'] as const,
    tags: () => [...queryKeys.metadata.all(), 'tags'] as const,
    licenses: () => [...queryKeys.metadata.all(), 'licenses'] as const,
    folders: () => [...queryKeys.metadata.all(), 'folders'] as const,
    categories: () => [...queryKeys.metadata.all(), 'categories'] as const,
    stats: () => [...queryKeys.metadata.all(), 'stats'] as const,
  },
  
  admin: {
    all: () => [...queryKeys.all, 'admin'] as const,
    status: () => [...queryKeys.admin.all(), 'status'] as const,
  },
};