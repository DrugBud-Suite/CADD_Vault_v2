import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseQueryBuilder, createQuery } from '../../src/utils/query';


// Mock the supabase import
vi.mock('../../src/supabase', () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn()
  };

  return {
    supabase: {
      from: vi.fn().mockReturnValue(mockQuery)
    }
  };
});

describe('Query Builder Integration Tests', () => {
  let mockSupabase: any;
  let mockQuery: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked supabase instance
    const supabaseModule = await import('../../src/supabase');
    mockSupabase = supabaseModule.supabase;
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null, count: 0 }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null, count: 0 })
    };
    mockSupabase.from.mockReturnValue(mockQuery);
  });

  describe('SupabaseQueryBuilder', () => {
    it('should build basic query with select and table', async () => {
      const mockData = [{ id: 1, name: 'test' }];
      mockQuery.single.mockResolvedValue({ data: mockData, error: null, count: 1 });

      const builder = new SupabaseQueryBuilder('packages');
      const result = await builder
        .select('id, name')
        .execute();

      expect(mockSupabase.from).toHaveBeenCalledWith('packages');
      expect(mockQuery.select).toHaveBeenCalledWith('id, name');
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('should apply filters correctly', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .filter('name', 'eq', 'test-package')
        .filter('status', 'in', ['active', 'pending'])
        .execute();

      expect(mockQuery.eq).toHaveBeenCalledWith('name', 'test-package');
      expect(mockQuery.in).toHaveBeenCalledWith('status', ['active', 'pending']);
    });

    it('should handle different filter operators', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .filter('stars', 'gte', 100)
        .filter('name', 'ilike', '%test%')
        .filter('is_active', 'is', true)
        .execute();

      expect(mockQuery.gte).toHaveBeenCalledWith('stars', 100);
      expect(mockQuery.ilike).toHaveBeenCalledWith('name', '%test%');
      expect(mockQuery.is).toHaveBeenCalledWith('is_active', true);
    });

    it('should apply ordering', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .orderBy('created_at', 'desc')
        .orderBy('name', 'asc')
        .execute();

      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
    });

    it('should apply pagination', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .paginate(20, 10) // offset 20, limit 10
        .execute();

      expect(mockQuery.range).toHaveBeenCalledWith(20, 29); // Supabase uses inclusive end
    });

    it('should limit results', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .limit(5)
        .execute();

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should handle complex query building', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('id, name, tags, created_at')
        .filter('status', 'eq', 'active')
        .filter('stars', 'gte', 10)
        .orderBy('stars', 'desc')
        .orderBy('name', 'asc')
        .paginate(0, 20)
        .execute();

      expect(mockSupabase.from).toHaveBeenCalledWith('packages');
      expect(mockQuery.select).toHaveBeenCalledWith('id, name, tags, created_at');
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockQuery.gte).toHaveBeenCalledWith('stars', 10);
      expect(mockQuery.order).toHaveBeenCalledWith('stars', { ascending: false });
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(mockQuery.range).toHaveBeenCalledWith(0, 19);
    });

    it('should handle count queries', async () => {
      const mockCountData = { count: 42 };
      mockQuery.single.mockResolvedValue({ data: mockCountData, error: null, count: 42 });

      const builder = new SupabaseQueryBuilder('packages');
      const result = await builder
        .select('*', { count: 'exact' })
        .execute();

      expect(result.count).toBe(42);
    });

    it('should handle single result queries', async () => {
      const mockSingleData = { id: 1, name: 'test-package' };
      mockQuery.single.mockResolvedValue({ data: mockSingleData, error: null });

      const builder = new SupabaseQueryBuilder('packages');
      const result = await builder
        .select('*')
        .filter('id', 'eq', 1)
        .single()
        .execute();

      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(mockSingleData);
    });

    it('should handle maybeSingle result queries', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .filter('id', 'eq', 999)
        .maybeSingle()
        .execute();

      expect(mockQuery.maybeSingle).toHaveBeenCalled();
    });

    it('should handle query errors', async () => {
      const mockError = { message: 'Database connection failed', code: 'PGRST000' };
      mockQuery.single.mockResolvedValue({ data: null, error: mockError });

      const builder = new SupabaseQueryBuilder('packages');
      const result = await builder
        .select('*')
        .execute();

      expect(result.error).toEqual(mockError);
      expect(result.data).toBeNull();
    });

    it('should handle execution without select', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .filter('status', 'eq', 'active')
        .execute();

      // Should use default select('*')
      expect(mockQuery.select).toHaveBeenCalledWith('*');
    });
  });

  describe('createQuery helper function', () => {
    it('should create query builder instance', () => {
      const query = createQuery('packages');
      expect(query).toBeInstanceOf(SupabaseQueryBuilder);
    });

    it('should work with generic types', async () => {
      interface Package {
        id: string;
        name: string;
        tags: string[];
      }

      const mockPackageData = [
        { id: '1', name: 'test-package', tags: ['test'] }
      ];
      mockQuery.single.mockResolvedValue({ data: mockPackageData, error: null });

      const query = createQuery<Package>('packages');
      const result = await query
        .select('id, name, tags')
        .execute();

      expect(result.data).toEqual(mockPackageData);
    });
  });

  describe('Advanced query scenarios', () => {
    it('should handle OR conditions', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .or('status.eq.active,status.eq.pending')
        .execute();

      expect(mockQuery.or).toHaveBeenCalledWith('status.eq.active,status.eq.pending');
    });

    it('should handle NOT conditions', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .not('status', 'eq', 'archived')
        .execute();

      expect(mockQuery.not).toHaveBeenCalledWith('status', 'eq', 'archived');
    });

    it('should handle text search', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .textSearch('description', 'machine learning')
        .execute();

      expect(mockQuery.filter).toHaveBeenCalled();
    });

    it('should handle joins and relationships', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select(`
          *,
          package_tags!left(
            tag_id,
            tags!inner(id, name)
          )
        `)
        .execute();

      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('package_tags'));
    });

    it('should handle complex filtering scenarios', async () => {
      const builder = new SupabaseQueryBuilder('packages');
      await builder
        .select('*')
        .filter('stars', 'gte', 100)
        .filter('stars', 'lt', 1000)
        .filter('license', 'in', ['MIT', 'Apache-2.0'])
        .filter('description', 'ilike', '%machine%')
        .orderBy('stars', 'desc')
        .limit(50)
        .execute();

      expect(mockQuery.gte).toHaveBeenCalledWith('stars', 100);
      expect(mockQuery.lt).toHaveBeenCalledWith('stars', 1000);
      expect(mockQuery.in).toHaveBeenCalledWith('license', ['MIT', 'Apache-2.0']);
      expect(mockQuery.ilike).toHaveBeenCalledWith('description', '%machine%');
      expect(mockQuery.order).toHaveBeenCalledWith('stars', { ascending: false });
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('should handle empty results gracefully', async () => {
      mockQuery.single.mockResolvedValue({ data: [], error: null, count: 0 });

      const builder = new SupabaseQueryBuilder('packages');
      const result = await builder
        .select('*')
        .filter('name', 'eq', 'nonexistent-package')
        .execute();

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.error).toBeNull();
    });

    it('should handle null data response', async () => {
      mockQuery.single.mockResolvedValue({ data: null, error: null, count: 0 });

      const builder = new SupabaseQueryBuilder('packages');
      const result = await builder
        .select('*')
        .filter('id', 'eq', 'nonexistent-id')
        .single()
        .execute();

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should handle network errors', async () => {
      mockQuery.single.mockRejectedValue(new Error('Network error'));

      const builder = new SupabaseQueryBuilder('packages');
      
      await expect(builder.select('*').execute()).rejects.toThrow('Network error');
    });

    it('should maintain immutability during chaining', () => {
      const baseQuery = createQuery('packages').select('*');
      const query1 = baseQuery.filter('status', 'eq', 'active');
      const query2 = baseQuery.filter('status', 'eq', 'pending');

      // Both queries should be independent
      expect(query1).not.toBe(query2);
      expect(query1).not.toBe(baseQuery);
    });
  });

  describe('Performance considerations', () => {
    it('should handle large result sets efficiently', async () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `package-${i + 1}`,
        description: `Description for package ${i + 1}`
      }));

      mockQuery.single.mockResolvedValue({ 
        data: largeDataSet, 
        error: null, 
        count: 1000 
      });

      const builder = new SupabaseQueryBuilder('packages');
      const result = await builder
        .select('id, name, description')
        .execute();

      expect(result.data).toHaveLength(1000);
      expect(result.count).toBe(1000);
    });

    it('should handle concurrent queries', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        return createQuery('packages')
          .select('*')
          .filter('id', 'eq', i + 1)
          .execute();
      });

      await Promise.all(promises);

      expect(mockSupabase.from).toHaveBeenCalledTimes(5);
    });
  });
});