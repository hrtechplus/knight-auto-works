// Form validation utilities for the frontend

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export const validators = {
  // Check if value exists and is not empty
  required: (value, fieldName = 'This field') => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return null;
  },

  // Check if email format is valid
  email: (value, fieldName = 'Email') => {
    if (!value) return null; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return `${fieldName} is not a valid email address`;
    }
    return null;
  },

  // Check if phone format is valid (flexible format)
  phone: (value, fieldName = 'Phone') => {
    if (!value) return null; // Optional field
    const phoneRegex = /^[\d\s\-+()]{7,20}$/;
    if (!phoneRegex.test(value)) {
      return `${fieldName} is not a valid phone number`;
    }
    return null;
  },

  // Check if value is a positive number
  positiveNumber: (value, fieldName = 'This field') => {
    if (value === undefined || value === null || value === '') return null; // Optional
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      return `${fieldName} must be a positive number`;
    }
    return null;
  },

  // Check minimum length
  minLength: (value, min, fieldName = 'This field') => {
    if (!value) return null; // Optional
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  // Check plate number format
  plateNumber: (value, fieldName = 'Plate number') => {
    if (!value) return null;
    if (value.trim().length < 2) {
      return `${fieldName} must be at least 2 characters`;
    }
    return null;
  }
};

// ============================================
// VALIDATE FORM HELPER
// ============================================

/**
 * Validate a form data object against a set of rules
 * @param {Object} data - Form data to validate
 * @param {Object} rules - Validation rules (field -> array of validator functions)
 * @returns {Object} - { isValid: boolean, errors: { field: string } }
 */
export function validateForm(data, rules) {
  const errors = {};
  
  for (const [field, validators] of Object.entries(rules)) {
    for (const validator of validators) {
      const error = validator(data[field]);
      if (error) {
        errors[field] = error;
        break; // Only report first error per field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// ============================================
// COMMON VALIDATION SCHEMAS
// ============================================

export const validationSchemas = {
  customer: {
    name: [v => validators.required(v, 'Name'), v => validators.minLength(v, 2, 'Name')],
    email: [v => validators.email(v)],
    phone: [v => validators.phone(v)]
  },
  
  vehicle: {
    customer_id: [v => validators.required(v, 'Customer')],
    plate_number: [v => validators.required(v, 'Plate number'), v => validators.plateNumber(v)],
    make: [v => validators.required(v, 'Make')],
    model: [v => validators.required(v, 'Model')]
  },
  
  job: {
    vehicle_id: [v => validators.required(v, 'Vehicle')]
  },
  
  expense: {
    category: [v => validators.required(v, 'Category')],
    amount: [v => validators.required(v, 'Amount'), v => validators.positiveNumber(v, 'Amount')]
  }
};
