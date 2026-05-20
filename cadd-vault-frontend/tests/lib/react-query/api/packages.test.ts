/**
 * Tests for packageApi — filters, pagination, tag logic, user ratings, and export.
 *
 * Supabase's JS client returns a fluent query builder that is awaitable (thenable).
 * `makeChain` replicates this: every method returns `chain`, and awaiting `chain`
 * resolves with `{ data, error, count }`. This lets us assert both *which* methods
 * were called and *what* the API function returns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { packageApi } from '../../../../src/lib/react-query/api/packages';
import { supabase } from '../../../../src/supabase';

vi.mock('../../../../src/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  },
}));

const mockRow = {
  id: 'pkg-1',
  package_name: 'TestPkg',
  description: 'A test package',
  package_tags: [{ tags: { name: 'ml' } }],
  package_folder_categories: [{
    folder_categories: {
      folders: { name: 'Tools' },
      categories: { name: 'Visualization' },
    },
  }],
};

function makeChain(resolveWith: { data?: any; error?: any; count?: number } = {}) {
  const result = {
    data: resolveWith.data ?? null,
    error: resolveWith.error ?? null,
    count: resolveWith.count ?? 0,
  };
  const chain: Record<string, any> = {};
  [
    'select', 'or', 'in', 'gte', 'not', 'eq', 'neq', 'order',
    'range', 'like', 'insert', 'update', 'delete', 'filter', 'limit',
  ].forEach(m => { chain[m] = vi.fn().mockReturnValue(chain); });
  chain.single = vi.fn().mockResolvedValue({ data: result.data?.[0] ?? null, error: result.error });
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(result).catch(fn);
  return chain;
}

// ---------------------------------------------------------------------------
// Basic filter application
// ---------------------------------------------------------------------------

describe('getPackages — filter application', () => {
  let chain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    chain = makeChain({ data: [mockRow], count: 1 });
    vi.mocked(supabase.from).mockReturnValue(chain as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
  });

  it('resolves with packages array and totalCount', async () => {
    const result = await packageApi.getPackages({});
    expect(result.totalCount).toBe(1);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].package_name).toBe('TestPkg');
  });

  it('transforms nested package_tags into flat string array', async () => {
    const result = await packageApi.getPackages({});
    expect(result.packages[0].tags).toEqual(['ml']);
  });

  it('transforms folder and category from nested join', async () => {
    const result = await packageApi.getPackages({});
    expect(result.packages[0].folder).toBe('Tools');
    expect(result.packages[0].category).toBe('Visualization');
  });

  it('applies searchTerm via .or() with ilike patterns', async () => {
    await packageApi.getPackages({ searchTerm: 'dock' });
    expect(chain.or).toHaveBeenCalledWith(expect.stringMatching(/dock/));
  });

  it('skips .or() when searchTerm is empty string', async () => {
    await packageApi.getPackages({ searchTerm: '' });
    expect(chain.or).not.toHaveBeenCalled();
  });

  it('skips .or() when searchTerm is whitespace-only', async () => {
    await packageApi.getPackages({ searchTerm: '   ' });
    expect(chain.or).not.toHaveBeenCalled();
  });

  it('applies minStars with .gte("github_stars", N)', async () => {
    await packageApi.getPackages({ minStars: 500 });
    expect(chain.gte).toHaveBeenCalledWith('github_stars', 500);
  });

  it('skips .gte(github_stars) when minStars is null', async () => {
    await packageApi.getPackages({ minStars: null });
    expect(chain.gte).not.toHaveBeenCalledWith('github_stars', expect.anything());
  });

  it('applies hasGithub with .not("repo_link", "is", null)', async () => {
    await packageApi.getPackages({ hasGithub: true });
    expect(chain.not).toHaveBeenCalledWith('repo_link', 'is', null);
  });

  it('skips .not(repo_link) when hasGithub is false', async () => {
    await packageApi.getPackages({ hasGithub: false });
    expect(chain.not).not.toHaveBeenCalledWith('repo_link', 'is', null);
  });

  it('applies hasWebserver with .not("webserver", "is", null)', async () => {
    await packageApi.getPackages({ hasWebserver: true });
    expect(chain.not).toHaveBeenCalledWith('webserver', 'is', null);
  });

  it('applies hasPublication with .not("publication", "is", null)', async () => {
    await packageApi.getPackages({ hasPublication: true });
    expect(chain.not).toHaveBeenCalledWith('publication', 'is', null);
  });

  it('applies minCitations with .gte("citations", N)', async () => {
    await packageApi.getPackages({ minCitations: 100 });
    expect(chain.gte).toHaveBeenCalledWith('citations', 100);
  });

  it('skips .gte(citations) when minCitations is null', async () => {
    await packageApi.getPackages({ minCitations: null });
    expect(chain.gte).not.toHaveBeenCalledWith('citations', expect.anything());
  });

  it('applies minRating with .gte("average_rating", N)', async () => {
    await packageApi.getPackages({ minRating: 3.5 });
    expect(chain.gte).toHaveBeenCalledWith('average_rating', 3.5);
  });

  it('applies selectedLicenses with .in("license", [...])', async () => {
    await packageApi.getPackages({ selectedLicenses: ['MIT', 'GPL-3.0'] });
    expect(chain.in).toHaveBeenCalledWith('license', ['MIT', 'GPL-3.0']);
  });

  it('skips .in(license) when selectedLicenses is empty', async () => {
    await packageApi.getPackages({ selectedLicenses: [] });
    expect(chain.in).not.toHaveBeenCalledWith('license', expect.anything());
  });

  it('applies ascending sort via .order(field, {ascending: true})', async () => {
    await packageApi.getPackages({ sortBy: 'citations', sortDirection: 'asc' });
    expect(chain.order).toHaveBeenCalledWith('citations', { ascending: true });
  });

  it('applies descending sort via .order(field, {ascending: false})', async () => {
    await packageApi.getPackages({ sortBy: 'github_stars', sortDirection: 'desc' });
    expect(chain.order).toHaveBeenCalledWith('github_stars', { ascending: false });
  });

  it('always appends id tiebreaker for stable pagination', async () => {
    await packageApi.getPackages({ sortBy: 'citations' });
    expect(chain.order).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('throws when supabase returns an error object', async () => {
    const err = new Error('DB error');
    const errChain = makeChain({ error: err });
    vi.mocked(supabase.from).mockReturnValue(errChain as any);
    await expect(packageApi.getPackages({})).rejects.toThrow('DB error');
  });

  it('returns empty packages and zero totalCount for no results', async () => {
    const emptyChain = makeChain({ data: [], count: 0 });
    vi.mocked(supabase.from).mockReturnValue(emptyChain as any);
    const result = await packageApi.getPackages({});
    expect(result.packages).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pagination range calculations
// ---------------------------------------------------------------------------

describe('getPackages — pagination', () => {
  let chain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    chain = makeChain({ data: [], count: 0 });
    vi.mocked(supabase.from).mockReturnValue(chain as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
  });

  it('page=1, pageSize=50 → range(0, 49)', async () => {
    await packageApi.getPackages({ page: 1, pageSize: 50 });
    expect(chain.range).toHaveBeenCalledWith(0, 49);
  });

  it('page=2, pageSize=50 → range(50, 99)', async () => {
    await packageApi.getPackages({ page: 2, pageSize: 50 });
    expect(chain.range).toHaveBeenCalledWith(50, 99);
  });

  it('page=3, pageSize=25 → range(50, 74)', async () => {
    await packageApi.getPackages({ page: 3, pageSize: 25 });
    expect(chain.range).toHaveBeenCalledWith(50, 74);
  });

  it('page=1, pageSize=100 → range(0, 99)', async () => {
    await packageApi.getPackages({ page: 1, pageSize: 100 });
    expect(chain.range).toHaveBeenCalledWith(0, 99);
  });

  it('page=5, pageSize=10 → range(40, 49)', async () => {
    await packageApi.getPackages({ page: 5, pageSize: 10 });
    expect(chain.range).toHaveBeenCalledWith(40, 49);
  });
});

// ---------------------------------------------------------------------------
// Tag filtering — RPC path and client-side fallback
// ---------------------------------------------------------------------------

describe('getPackages — tag filtering', () => {
  beforeEach(() => {
    vi.mocked(supabase.from).mockReset();
    vi.mocked(supabase.rpc).mockReset();
  });

  it('RPC path: filters packages by IDs returned from get_packages_with_all_tags', async () => {
    const tagsChain = makeChain({ data: [{ id: 't1', name: 'ml' }] });
    const pkgsChain = makeChain({ data: [mockRow], count: 1 });
    vi.mocked(supabase.from).mockImplementation((t: string) =>
      (t === 'tags' ? tagsChain : pkgsChain) as any
    );
    vi.mocked(supabase.rpc).mockImplementation((fn: string) =>
      Promise.resolve(
        fn === 'get_packages_with_all_tags'
          ? { data: [{ package_id: 'pkg-1' }], error: null }
          : { data: null, error: null }
      ) as any
    );

    const result = await packageApi.getPackages({ selectedTags: ['ml'] });

    expect(pkgsChain.in).toHaveBeenCalledWith('id', ['pkg-1']);
    expect(result.packages).toHaveLength(1);
  });

  it('returns empty immediately when tag name not found in database', async () => {
    const tagsChain = makeChain({ data: [] });
    const pkgsChain = makeChain({ data: [mockRow], count: 1 });
    vi.mocked(supabase.from).mockImplementation((t: string) =>
      (t === 'tags' ? tagsChain : pkgsChain) as any
    );

    const result = await packageApi.getPackages({ selectedTags: ['nonexistent'] });

    expect(result).toEqual({ packages: [], totalCount: 0 });
    expect(pkgsChain.in).not.toHaveBeenCalled();
  });

  it('returns empty when RPC returns no matching package IDs', async () => {
    const tagsChain = makeChain({ data: [{ id: 't1', name: 'ml' }] });
    const pkgsChain = makeChain({ data: [mockRow], count: 1 });
    vi.mocked(supabase.from).mockImplementation((t: string) =>
      (t === 'tags' ? tagsChain : pkgsChain) as any
    );
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as any);

    const result = await packageApi.getPackages({ selectedTags: ['ml'] });

    expect(result).toEqual({ packages: [], totalCount: 0 });
  });

  it('fallback path: uses package_tags table when RPC returns error', async () => {
    const tagsChain = makeChain({ data: [{ id: 't1', name: 'ml' }] });
    const pkgTagsChain = makeChain({ data: [{ package_id: 'pkg-1', tag_id: 't1' }] });
    const pkgsChain = makeChain({ data: [mockRow], count: 1 });
    vi.mocked(supabase.from).mockImplementation((t: string) => {
      if (t === 'tags') return tagsChain as any;
      if (t === 'package_tags') return pkgTagsChain as any;
      return pkgsChain as any;
    });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'no rpc' } } as any);

    const result = await packageApi.getPackages({ selectedTags: ['ml'] });

    expect(pkgsChain.in).toHaveBeenCalledWith('id', ['pkg-1']);
    expect(result.packages).toHaveLength(1);
  });

  it('fallback returns empty when package_tags has no rows', async () => {
    const tagsChain = makeChain({ data: [{ id: 't1', name: 'ml' }] });
    const pkgTagsChain = makeChain({ data: [] });
    const pkgsChain = makeChain({ data: [mockRow], count: 1 });
    vi.mocked(supabase.from).mockImplementation((t: string) => {
      if (t === 'tags') return tagsChain as any;
      if (t === 'package_tags') return pkgTagsChain as any;
      return pkgsChain as any;
    });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'no rpc' } } as any);

    const result = await packageApi.getPackages({ selectedTags: ['ml'] });

    expect(result).toEqual({ packages: [], totalCount: 0 });
  });
});

// ---------------------------------------------------------------------------
// User ratings
// ---------------------------------------------------------------------------

describe('getPackages — user ratings', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches and maps ratings when includeUserRatings=true with userId', async () => {
    const pkgsChain = makeChain({
      data: [{ id: 'pkg-1', package_name: 'P', package_tags: [], package_folder_categories: [] }],
      count: 1,
    });
    const ratingsChain = makeChain({ data: [{ package_id: 'pkg-1', rating: 4, id: 'r1' }] });
    vi.mocked(supabase.from).mockImplementation((t: string) =>
      (t === 'ratings' ? ratingsChain : pkgsChain) as any
    );
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    const result = await packageApi.getPackages({ includeUserRatings: true, currentUserId: 'u1' });

    expect(result.userRatings).toBeDefined();
    expect(result.userRatings!.get('pkg-1')).toEqual({ rating: 4, rating_id: 'r1' });
  });

  it('does not fetch ratings when includeUserRatings=false', async () => {
    const pkgsChain = makeChain({ data: [], count: 0 });
    const ratingsChain = makeChain({ data: [] });
    vi.mocked(supabase.from).mockImplementation((t: string) =>
      (t === 'ratings' ? ratingsChain : pkgsChain) as any
    );
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    const result = await packageApi.getPackages({ includeUserRatings: false });

    expect(result.userRatings).toBeUndefined();
    expect(ratingsChain.select).not.toHaveBeenCalled();
  });

  it('does not fetch ratings when currentUserId is null even if includeUserRatings=true', async () => {
    const pkgsChain = makeChain({ data: [], count: 0 });
    const ratingsChain = makeChain({ data: [] });
    vi.mocked(supabase.from).mockImplementation((t: string) =>
      (t === 'ratings' ? ratingsChain : pkgsChain) as any
    );
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);

    const result = await packageApi.getPackages({ includeUserRatings: true, currentUserId: null });

    expect(result.userRatings).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAllPackagesForExport — pagination loop and truncation
// ---------------------------------------------------------------------------

describe('getAllPackagesForExport', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches multiple pages and concatenates results', async () => {
    let page = 0;
    vi.spyOn(packageApi, 'getPackages').mockImplementation(async () => {
      page++;
      return {
        packages: page === 1 ? Array(1000).fill(mockRow) : Array(200).fill(mockRow),
        totalCount: 1200,
      };
    });

    const result = await packageApi.getAllPackagesForExport({}, { chunkSize: 1000 });

    expect(result.packages).toHaveLength(1200);
    expect(result.totalCount).toBe(1200);
    expect(result.truncated).toBe(false);
  });

  it('marks truncated=true when totalCount exceeds hardCap', async () => {
    vi.spyOn(packageApi, 'getPackages').mockResolvedValue({
      packages: Array(500).fill(mockRow),
      totalCount: 50000,
    });

    const result = await packageApi.getAllPackagesForExport({}, { chunkSize: 500, hardCap: 500 });

    expect(result.truncated).toBe(true);
    expect(result.packages).toHaveLength(500);
  });

  it('stops fetching once hardCap packages are accumulated', async () => {
    let callCount = 0;
    vi.spyOn(packageApi, 'getPackages').mockImplementation(async () => {
      callCount++;
      return { packages: Array(1000).fill(mockRow), totalCount: 50000 };
    });

    const result = await packageApi.getAllPackagesForExport({}, { chunkSize: 1000, hardCap: 2000 });

    expect(callCount).toBe(2);
    expect(result.packages).toHaveLength(2000);
  });

  it('stops on a short page (fewer results than pageSize)', async () => {
    let call = 0;
    vi.spyOn(packageApi, 'getPackages').mockImplementation(async () => {
      call++;
      return {
        packages: call === 1 ? Array(1000).fill(mockRow) : Array(50).fill(mockRow),
        totalCount: 9999,
      };
    });

    const result = await packageApi.getAllPackagesForExport({}, { chunkSize: 1000 });

    expect(result.packages).toHaveLength(1050);
    expect(call).toBe(2);
  });
});
