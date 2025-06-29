import { supabase } from '../../supabase';
import { QueryResult, FilterConfig } from './types';

export class SupabaseQueryBuilder<T> {
  private query: any;
  private countQuery: any;
  private table: string;
  
  constructor(table: string) {
    this.table = table;
    this.query = supabase.from(table).select('*');
    this.countQuery = supabase.from(table).select('*', { count: 'exact', head: true });
  }
  
  select(columns: string): this {
    this.query = supabase.from(this.table).select(columns);
    return this;
  }
  
  filter(field: string, operator: string, value: any): this {
    this.query = this.query[operator](field, value);
    this.countQuery = this.countQuery[operator](field, value);
    return this;
  }
  
  filters(configs: FilterConfig[]): this {
    configs.forEach(({ field, operator, value }) => {
      this.filter(field, operator, value);
    });
    return this;
  }
  
  search(column: string, searchTerm: string): this {
    if (searchTerm) {
      this.query = this.query.ilike(column, `%${searchTerm}%`);
      this.countQuery = this.countQuery.ilike(column, `%${searchTerm}%`);
    }
    return this;
  }
  
  paginate(page: number, pageSize: number): this {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    this.query = this.query.range(from, to);
    return this;
  }
  
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.query = this.query.order(column, { ascending: direction === 'asc' });
    return this;
  }
  
  async execute(): Promise<QueryResult<T>> {
    try {
      const [{ data, error }, { count }] = await Promise.all([
        this.query,
        this.countQuery
      ]);
      
      if (error) throw error;
      
      return {
        data,
        count: count || 0,
        error: null
      };
    } catch (error) {
      console.error(`Query failed on table ${this.table}:`, error);
      return {
        data: null,
        count: 0,
        error: error as Error
      };
    }
  }
}

// Helper function for common queries
export const createQuery = <T>(table: string) => new SupabaseQueryBuilder<T>(table);