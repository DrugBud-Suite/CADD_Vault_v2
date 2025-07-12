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

export function useTags() {
  return useQuery({
    queryKey: queryKeys.metadata.tags(),
    queryFn: metadataApi.getTags,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useLicenses() {
  return useQuery({
    queryKey: queryKeys.metadata.licenses(),
    queryFn: metadataApi.getLicenses,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useFoldersAndCategories() {
  return useQuery({
    queryKey: queryKeys.metadata.folders(),
    queryFn: metadataApi.getFoldersAndCategories,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useDatasetStats() {
  return useQuery({
    queryKey: queryKeys.metadata.stats(),
    queryFn: metadataApi.getDatasetStats,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}