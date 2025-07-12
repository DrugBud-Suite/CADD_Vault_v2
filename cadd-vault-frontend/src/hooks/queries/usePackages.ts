import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { queryKeys } from '../../lib/react-query/queryKeys';
import { packageApi, PackageFilters } from '../../lib/react-query/api/packages';
import { Package } from '../../types';

export function usePackages(filters: PackageFilters = {}) {
  return useQuery({
    queryKey: queryKeys.packages.list(filters),
    queryFn: () => packageApi.getPackages(filters),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });
}

export function usePackage(id: string) {
  return useQuery({
    queryKey: queryKeys.packages.detail(id),
    queryFn: () => packageApi.getPackageById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreatePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: packageApi.createPackage,
    onSuccess: (newPackage) => {
      // Invalidate all package lists
      queryClient.invalidateQueries({ queryKey: queryKeys.packages.lists() });
      
      // Set the new package in cache
      queryClient.setQueryData(queryKeys.packages.detail(newPackage.id), newPackage);
      
      // Invalidate metadata to refresh counts
      queryClient.invalidateQueries({ queryKey: queryKeys.metadata.all() });
      
      toast.success('Package created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create package: ${error.message}`);
    },
  });
}

export function useUpdatePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Package> }) =>
      packageApi.updatePackage(id, updates),
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.packages.detail(id) });

      // Snapshot previous value
      const previousPackage = queryClient.getQueryData<Package>(
        queryKeys.packages.detail(id)
      );

      // Optimistically update
      if (previousPackage) {
        queryClient.setQueryData(queryKeys.packages.detail(id), {
          ...previousPackage,
          ...updates,
        });
      }

      return { previousPackage };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousPackage) {
        queryClient.setQueryData(
          queryKeys.packages.detail(id),
          context.previousPackage
        );
      }
      toast.error('Failed to update package');
    },
    onSettled: (_data, _error, { id }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.packages.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.packages.lists() });
    },
    onSuccess: () => {
      toast.success('Package updated successfully');
    },
  });
}

export function useDeletePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: packageApi.deletePackage,
    onSuccess: (_, packageId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.packages.detail(packageId) });
      
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.packages.lists() });
      
      // Invalidate metadata to refresh counts
      queryClient.invalidateQueries({ queryKey: queryKeys.metadata.all() });
      
      toast.success('Package deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete package: ${error.message}`);
    },
  });
}