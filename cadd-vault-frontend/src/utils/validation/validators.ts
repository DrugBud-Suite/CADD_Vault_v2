import { ValidationRule } from './types';

// Password Validators
export const passwordValidators = {
  minLength: (min: number = 8): ValidationRule => ({
    test: (value: string) => value.length >= min,
    message: `Password must be at least ${min} characters long`
  }),
  
  hasLowercase: (): ValidationRule => ({
    test: (value: string) => /[a-z]/.test(value),
    message: 'Password must contain at least one lowercase letter'
  }),
  
  hasUppercase: (): ValidationRule => ({
    test: (value: string) => /[A-Z]/.test(value),
    message: 'Password must contain at least one uppercase letter'
  }),
  
  hasDigit: (): ValidationRule => ({
    test: (value: string) => /\d/.test(value),
    message: 'Password must contain at least one digit'
  }),
  
  hasSpecialChar: (): ValidationRule => ({
    test: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value),
    message: 'Password must contain at least one special character'
  }),
};

// URL Validators
export const urlValidators = {
  isValidUrl: (): ValidationRule => ({
    test: (value: string) => {
      if (!value) return true; // Empty is valid
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: 'Please enter a valid URL'
  }),
  
  isHttps: (): ValidationRule => ({
    test: (value: string) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    message: 'URL must use HTTPS protocol'
  }),
  
  isGitHubRepo: (): ValidationRule => ({
    test: (value: string) => {
      if (!value) return true;
      return /^https:\/\/github\.com\/[\w-]+\/[\w-]+/.test(value);
    },
    message: 'Must be a valid GitHub repository URL'
  }),
};

// Email Validators
export const emailValidators = {
  isValidEmail: (): ValidationRule => ({
    test: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: 'Please enter a valid email address'
  }),
  
  isBusinessEmail: (): ValidationRule => ({
    test: (value: string) => {
      const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const domain = value.split('@')[1]?.toLowerCase();
      return !freeEmailDomains.includes(domain);
    },
    message: 'Please use a business email address'
  }),
};

// Generic Validators
export const genericValidators = {
  required: (fieldName: string = 'Field'): ValidationRule => ({
    test: (value: any) => {
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value != null;
    },
    message: `${fieldName} is required`
  }),
  
  minLength: (min: number, fieldName: string = 'Field'): ValidationRule => ({
    test: (value: string | any[]) => value.length >= min,
    message: `${fieldName} must be at least ${min} characters long`
  }),
  
  maxLength: (max: number, fieldName: string = 'Field'): ValidationRule => ({
    test: (value: string | any[]) => value.length <= max,
    message: `${fieldName} must not exceed ${max} characters`
  }),
  
  pattern: (pattern: RegExp, message: string): ValidationRule => ({
    test: (value: string) => pattern.test(value),
    message
  }),
};