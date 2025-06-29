import { ValidationResult, FormValidationSchema } from './types';

export * from './types';
export * from './validators';

/**
 * Validates a form against a schema
 * @param data Form data to validate
 * @param schema Validation schema defining rules for each field
 * @returns ValidationResult with isValid flag and errors object
 */
export const validateForm = (
  data: Record<string, any>,
  schema: FormValidationSchema
): ValidationResult => {
  const errors: Record<string, string> = {};
  
  for (const [fieldName, validation] of Object.entries(schema)) {
    const value = data[fieldName];
    
    // Check required
    if (validation.required && !value) {
      errors[fieldName] = `${fieldName} is required`;
      continue;
    }
    
    // Check rules
    if (validation.rules && value) {
      for (const rule of validation.rules) {
        if (!rule.test(value)) {
          errors[fieldName] = rule.message;
          break; // Stop at first error
        }
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * React hook for form validation
 */
import { useState, useCallback } from 'react';

export const useValidation = (schema: FormValidationSchema) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((data: Record<string, any>): boolean => {
    const result = validateForm(data, schema);
    setErrors(result.errors);
    return result.isValid;
  }, [schema]);

  const validateField = useCallback((fieldName: string, value: any): boolean => {
    const fieldSchema = schema[fieldName];
    if (!fieldSchema) return true;

    const fieldErrors = { ...errors };
    
    // Check required
    if (fieldSchema.required && !value) {
      fieldErrors[fieldName] = `${fieldName} is required`;
      setErrors(fieldErrors);
      return false;
    }
    
    // Check rules
    if (fieldSchema.rules && value) {
      for (const rule of fieldSchema.rules) {
        if (!rule.test(value)) {
          fieldErrors[fieldName] = rule.message;
          setErrors(fieldErrors);
          return false;
        }
      }
    }
    
    // Clear error if valid
    delete fieldErrors[fieldName];
    setErrors(fieldErrors);
    return true;
  }, [schema, errors]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validate,
    validateField,
    clearErrors
  };
};