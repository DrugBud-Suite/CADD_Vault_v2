export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ValidationRule {
  test: (value: unknown) => boolean;
  message: string;
}

export interface FieldValidation {
  required?: boolean;
  rules?: ValidationRule[];
}

export interface FormValidationSchema {
  [fieldName: string]: FieldValidation;
}