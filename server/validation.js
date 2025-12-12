// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validation helper functions for server-side input validation
 */

// Error codes for structured error responses
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BUSINESS_RULE: 'BUSINESS_RULE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// Create a structured error response
export function createError(code, message, details = null) {
  return {
    error: {
      code,
      message,
      ...(details && { details })
    }
  };
}

// Validation functions
export const validators = {
  // Check if value exists and is not empty
  required: (value, fieldName) => {
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
  positiveNumber: (value, fieldName) => {
    if (value === undefined || value === null || value === '') return null; // Optional
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      return `${fieldName} must be a positive number`;
    }
    return null;
  },

  // Check if value is a valid integer (handles string numbers from forms)
  integer: (value, fieldName) => {
    if (value === undefined || value === null || value === '') return null; // Optional
    const num = Number(value);
    if (isNaN(num) || !Number.isInteger(num)) {
      return `${fieldName} must be a whole number`;
    }
    return null;
  },

  // Check if value is within allowed values
  enum: (value, allowedValues, fieldName) => {
    if (!value) return null; // Optional
    if (!allowedValues.includes(value)) {
      return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
    }
    return null;
  },

  // Check minimum length
  minLength: (value, min, fieldName) => {
    if (!value) return null; // Optional
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  // Check if date is valid
  date: (value, fieldName = 'Date') => {
    if (!value) return null; // Optional
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return `${fieldName} is not a valid date`;
    }
    return null;
  }
};

// Validate an object against a schema
export function validate(data, schema) {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const error = rule(data[field], field);
      if (error) {
        errors.push(error);
        break; // Only report first error per field
      }
    }
  }
  
  return errors.length > 0 ? errors : null;
}

// Validation schemas for each entity
export const schemas = {
  customer: {
    name: [v => validators.required(v, 'Name'), v => validators.minLength(v, 2, 'Name')],
    email: [v => validators.email(v)],
    phone: [v => validators.phone(v)]
  },
  
  vehicle: {
    customer_id: [v => validators.required(v, 'Customer'), v => validators.integer(v, 'Customer ID')],
    plate_number: [v => validators.required(v, 'Plate number'), v => validators.minLength(v, 2, 'Plate number')],
    make: [v => validators.required(v, 'Make')],
    model: [v => validators.required(v, 'Model')],
    year: [v => validators.integer(v, 'Year')],
    odometer: [v => validators.positiveNumber(v, 'Odometer')]
  },
  
  job: {
    vehicle_id: [v => validators.required(v, 'Vehicle'), v => validators.integer(v, 'Vehicle ID')],
    priority: [v => validators.enum(v, ['low', 'normal', 'high', 'urgent'], 'Priority')],
    status: [v => validators.enum(v, ['pending', 'in_progress', 'completed', 'invoiced', 'cancelled'], 'Status')],
    labor_hours: [v => validators.positiveNumber(v, 'Labor hours')],
    labor_rate: [v => validators.positiveNumber(v, 'Labor rate')]
  },
  
  inventory: {
    name: [v => validators.required(v, 'Name')],
    quantity: [v => validators.integer(v, 'Quantity'), v => validators.positiveNumber(v, 'Quantity')],
    min_stock: [v => validators.integer(v, 'Minimum stock')],
    cost_price: [v => validators.positiveNumber(v, 'Cost price')],
    sell_price: [v => validators.positiveNumber(v, 'Sell price')]
  },
  
  supplier: {
    name: [v => validators.required(v, 'Name')],
    email: [v => validators.email(v)],
    phone: [v => validators.phone(v)]
  },
  
  invoice: {
    customer_id: [v => validators.required(v, 'Customer'), v => validators.integer(v, 'Customer ID')],
    subtotal: [v => validators.positiveNumber(v, 'Subtotal')],
    tax_rate: [v => validators.positiveNumber(v, 'Tax rate')],
    discount: [v => validators.positiveNumber(v, 'Discount')],
    due_date: [v => validators.date(v, 'Due date')]
  },
  
  payment: {
    amount: [v => validators.required(v, 'Amount'), v => validators.positiveNumber(v, 'Amount')],
    payment_method: [v => validators.enum(v, ['cash', 'card', 'bank_transfer', 'cheque', 'other'], 'Payment method')]
  },
  
  expense: {
    category: [v => validators.required(v, 'Category')],
    amount: [v => validators.required(v, 'Amount'), v => validators.positiveNumber(v, 'Amount')],
    expense_date: [v => validators.date(v, 'Expense date')]
  },
  
  serviceReminder: {
    vehicle_id: [v => validators.required(v, 'Vehicle'), v => validators.integer(v, 'Vehicle ID')],
    reminder_type: [v => validators.required(v, 'Reminder type'), v => validators.enum(v, ['mileage', 'time', 'custom'], 'Reminder type')],
    due_mileage: [v => validators.positiveNumber(v, 'Due mileage')],
    due_date: [v => validators.date(v, 'Due date')]
  },
  
  jobItem: {
    description: [v => validators.required(v, 'Description'), v => validators.minLength(v, 2, 'Description')],
    quantity: [v => validators.positiveNumber(v, 'Quantity')],
    unit_price: [v => validators.positiveNumber(v, 'Unit price')]
  },

  jobPart: {
    part_name: [v => validators.required(v, 'Part name')],
    quantity: [v => validators.positiveNumber(v, 'Quantity')],
    unit_price: [v => validators.positiveNumber(v, 'Unit price')],
    inventory_id: [v => validators.integer(v, 'Inventory ID')]
  }
};

// Job status transition rules
export const jobStatusTransitions = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['pending', 'completed', 'cancelled'],
  completed: ['in_progress', 'invoiced'],
  invoiced: [], // Cannot change once invoiced
  cancelled: ['pending']
};

export function canTransitionJobStatus(currentStatus, newStatus) {
  if (currentStatus === newStatus) return true;
  return jobStatusTransitions[currentStatus]?.includes(newStatus) || false;
}
