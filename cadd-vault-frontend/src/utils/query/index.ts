import { Package, PackageSuggestion } from '../../types';
import { createQuery } from './supabaseQueryBuilder';

export * from './types';
export * from './supabaseQueryBuilder';

// Pre-configured queries for common tables
export const packageQuery = () => createQuery<Package>('packages');
export const suggestionQuery = () => createQuery<PackageSuggestion>('package_suggestions');
export const userQuery = () => createQuery<any>('users');