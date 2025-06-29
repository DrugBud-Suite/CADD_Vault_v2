import { describe, it, expect } from 'vitest';
import { 
  validateForm, 
  passwordValidators, 
  urlValidators, 
  emailValidators,
  genericValidators 
} from '../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('passwordValidators', () => {
    it('should validate minimum length', () => {
      const validator = passwordValidators.minLength(8);
      expect(validator.test('short')).toBe(false);
      expect(validator.test('longenoughpassword')).toBe(true);
    });
    
    it('should check for uppercase letters', () => {
      const validator = passwordValidators.hasUppercase();
      expect(validator.test('nocaps')).toBe(false);
      expect(validator.test('HasCaps')).toBe(true);
    });

    it('should check for lowercase letters', () => {
      const validator = passwordValidators.hasLowercase();
      expect(validator.test('NOCAPS')).toBe(false);
      expect(validator.test('HasCaps')).toBe(true);
    });

    it('should check for numbers', () => {
      const validator = passwordValidators.hasNumber();
      expect(validator.test('NoNumbers')).toBe(false);
      expect(validator.test('Has123')).toBe(true);
    });

    it('should check for special characters', () => {
      const validator = passwordValidators.hasSpecialChar();
      expect(validator.test('NoSpecial123')).toBe(false);
      expect(validator.test('Has!Special')).toBe(true);
    });
  });

  describe('urlValidators', () => {
    it('should validate URLs', () => {
      const validator = urlValidators.isValidUrl();
      expect(validator.test('not-a-url')).toBe(false);
      expect(validator.test('http://example.com')).toBe(true);
      expect(validator.test('https://github.com/user/repo')).toBe(true);
      expect(validator.test('ftp://files.example.com')).toBe(true);
    });

    it('should validate GitHub URLs', () => {
      const validator = urlValidators.isGitHubUrl();
      expect(validator.test('https://example.com')).toBe(false);
      expect(validator.test('https://github.com/user/repo')).toBe(true);
      expect(validator.test('https://github.com/org/project/tree/main')).toBe(true);
    });

    it('should validate HTTP/HTTPS URLs only', () => {
      const validator = urlValidators.isHttpUrl();
      expect(validator.test('ftp://files.example.com')).toBe(false);
      expect(validator.test('http://example.com')).toBe(true);
      expect(validator.test('https://secure.example.com')).toBe(true);
    });
  });

  describe('emailValidators', () => {
    it('should validate email addresses', () => {
      const validator = emailValidators.isValidEmail();
      expect(validator.test('invalid-email')).toBe(false);
      expect(validator.test('user@domain')).toBe(false);
      expect(validator.test('user@example.com')).toBe(true);
      expect(validator.test('test.user+tag@subdomain.example.org')).toBe(true);
    });
  });

  describe('genericValidators', () => {
    it('should validate minimum length', () => {
      const validator = genericValidators.minLength(5, 'Field');
      expect(validator.test('abc')).toBe(false);
      expect(validator.test('abcdef')).toBe(true);
      expect(validator.message).toBe('Field must be at least 5 characters long');
    });

    it('should validate maximum length', () => {
      const validator = genericValidators.maxLength(10, 'Field');
      expect(validator.test('very long text here')).toBe(false);
      expect(validator.test('short')).toBe(true);
      expect(validator.message).toBe('Field must be no more than 10 characters long');
    });

    it('should validate required fields', () => {
      const validator = genericValidators.required('Field');
      expect(validator.test('')).toBe(false);
      expect(validator.test('   ')).toBe(false);
      expect(validator.test('valid')).toBe(true);
      expect(validator.message).toBe('Field is required');
    });

    it('should validate patterns', () => {
      const validator = genericValidators.pattern(/^[A-Z][a-z]+$/, 'Must start with uppercase letter');
      expect(validator.test('lowercase')).toBe(false);
      expect(validator.test('UpperCase123')).toBe(false);
      expect(validator.test('Proper')).toBe(true);
    });
  });
  
  describe('validateForm', () => {
    it('should validate entire form with valid data', () => {
      const schema = {
        email: {
          required: true,
          rules: [emailValidators.isValidEmail()]
        },
        password: {
          required: true,
          rules: [
            passwordValidators.minLength(8),
            passwordValidators.hasUppercase()
          ]
        }
      };
      
      const result = validateForm({
        email: 'test@example.com',
        password: 'ValidPass123'
      }, schema);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should return errors for invalid data', () => {
      const schema = {
        email: {
          required: true,
          rules: [emailValidators.isValidEmail()]
        },
        password: {
          required: true,
          rules: [
            passwordValidators.minLength(8),
            passwordValidators.hasUppercase()
          ]
        }
      };
      
      const result = validateForm({
        email: 'invalid-email',
        password: 'short'
      }, schema);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
    });

    it('should handle missing required fields', () => {
      const schema = {
        name: {
          required: true,
          rules: [genericValidators.minLength(2, 'Name')]
        }
      };
      
      const result = validateForm({}, schema);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('name is required');
    });

    it('should skip validation for optional empty fields', () => {
      const schema = {
        optionalUrl: {
          required: false,
          rules: [urlValidators.isValidUrl()]
        },
        requiredName: {
          required: true,
          rules: [genericValidators.minLength(2, 'Name')]
        }
      };
      
      const result = validateForm({
        optionalUrl: '',
        requiredName: 'John'
      }, schema);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });
  });
});