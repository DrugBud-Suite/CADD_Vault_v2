import { ValidationRule } from './types';

// Password Validators
export const passwordValidators = {
  minLength: (min: number = 8): ValidationRule => ({
    test: (value: unknown) => typeof value === 'string' && value.length >= min,
    message: `Password must be at least ${min} characters long`
  }),

  hasLowercase: (): ValidationRule => ({
    test: (value: unknown) => typeof value === 'string' && /[a-z]/.test(value),
    message: 'Password must contain at least one lowercase letter'
  }),

  hasUppercase: (): ValidationRule => ({
    test: (value: unknown) => typeof value === 'string' && /[A-Z]/.test(value),
    message: 'Password must contain at least one uppercase letter'
  }),

  hasDigit: (): ValidationRule => ({
    test: (value: unknown) => typeof value === 'string' && /\d/.test(value),
    message: 'Password must contain at least one digit'
  }),

  hasSpecialChar: (): ValidationRule => ({
    test: (value: unknown) => typeof value === 'string' && /[!@#$%^&*(),.?":{}|<>]/.test(value),
    message: 'Password must contain at least one special character'
  }),
};

// URL Validators
export const urlValidators = {
  isValidUrl: (): ValidationRule => ({
    test: (value: unknown) => {
      if (typeof value !== 'string' || !value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Please enter a valid URL'
  }),

  isGitHubRepo: (): ValidationRule => ({
    test: (value: unknown) => {
      if (typeof value !== 'string' || !value) return true;
      return /^https:\/\/github\.com\/[\w-]+\/[\w-]+/.test(value);
    },
    message: 'Must be a valid GitHub repository URL'
  }),
};

// Email Validators
export const emailValidators = {
  isValidEmail: (): ValidationRule => ({
    test: (value: unknown) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Please enter a valid email address'
  }),
};

// Generic Validators
export const genericValidators = {
  required: (fieldName: string = 'Field'): ValidationRule => ({
    test: (value: unknown) => {
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value != null;
    },
    message: `${fieldName} is required`
  }),

  minLength: (min: number, fieldName: string = 'Field'): ValidationRule => ({
    test: (value: unknown) => (typeof value === 'string' || Array.isArray(value)) && value.length >= min,
    message: `${fieldName} must be at least ${min} characters long`
  }),

  maxLength: (max: number, fieldName: string = 'Field'): ValidationRule => ({
    test: (value: unknown) => (typeof value === 'string' || Array.isArray(value)) && value.length <= max,
    message: `${fieldName} must not exceed ${max} characters`
  }),

  pattern: (pattern: RegExp, message: string): ValidationRule => ({
    test: (value: unknown) => typeof value === 'string' && pattern.test(value),
    message
  }),
};
