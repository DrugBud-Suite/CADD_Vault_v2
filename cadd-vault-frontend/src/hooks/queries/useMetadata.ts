import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/react-query/queryKeys';
import { metadataApi } from '../../lib/react-query/api/metadata';

export function useFilterMetadata() {
  return useQuery({
    queryKey: queryKeys.metadata.all(),
    queryFn: metadataApi.getFilterMetadata,
    staleTime: 1000 * 60 * 30, // 30 minutes - metadata doesn't change often
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}
