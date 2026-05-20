import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../../src/utils/errorMessage';

describe('getErrorMessage', () => {
  it('returns the message of a native Error', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns a non-empty string value as-is', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
  });

  it('extracts the message from a Supabase-style error object', () => {
    expect(getErrorMessage({ message: 'Permission denied', code: '42501' })).toBe(
      'Permission denied',
    );
  });

  it('falls back when the object message is not a string', () => {
    expect(getErrorMessage({ message: 123 })).toBe('An unexpected error occurred');
  });

  it('falls back for null and undefined', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });

  it('falls back for an empty string', () => {
    expect(getErrorMessage('')).toBe('An unexpected error occurred');
  });

  it('uses a custom fallback when provided', () => {
    expect(getErrorMessage(null, 'custom fallback')).toBe('custom fallback');
  });
});
