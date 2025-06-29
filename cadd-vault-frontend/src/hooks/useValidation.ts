import { useState, useCallback } from 'react';
import { FormValidationSchema, validateForm } from '../utils/validation';

/**
 * Custom hook for form validation with React integration
 * @param schema Validation schema defining rules for form fields
 * @returns Object with validation state and control functions
 */
export const useValidation = (schema: FormValidationSchema) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  /**
   * Validates the entire form data against the schema
   * @param data Form data object to validate
   * @returns Boolean indicating if the form is valid
   */
  const validate = useCallback((data: Record<string, any>) => {
    const result = validateForm(data, schema);
    setErrors(result.errors);
    return result.isValid;
  }, [schema]);
  
  /**
   * Validates a single field and updates the errors state
   * @param fieldName Name of the field to validate
   * @param value Value of the field to validate
   * @returns Boolean indicating if the field is valid
   */
  const validateField = useCallback((fieldName: string, value: any) => {
    const fieldSchema = { [fieldName]: schema[fieldName] };
    const result = validateForm({ [fieldName]: value }, fieldSchema);
    
    setErrors(prev => ({
      ...prev,
      [fieldName]: result.errors[fieldName] || ''
    }));
    
    return !result.errors[fieldName];
  }, [schema]);
  
  /**
   * Clears all validation errors
   */
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