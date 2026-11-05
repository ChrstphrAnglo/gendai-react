import { useState, useCallback } from 'react';

/**
 * Small controlled-form helper.
 *   initial:    { field: initialValue }
 *   validators: { field: (value, allValues) => 'error message' | '' }
 */
export default function useForm(initial, validators = {}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});

  const validateField = useCallback(
    (name, value, all) => (validators[name] ? validators[name](value, all) || '' : ''),
    [validators]
  );

  const setValue = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear the field's error as soon as the user edits it.
    setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
  };

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setValue(name, type === 'checkbox' ? checked : value);
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value, values) }));
  };

  // Validates every field; returns true when the form is valid.
  const validateAll = () => {
    const next = {};
    Object.keys(validators).forEach((name) => {
      const msg = validateField(name, values[name], values);
      if (msg) next[name] = msg;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const reset = (next = initial) => {
    setValues(next);
    setErrors({});
  };

  return { values, errors, setValue, setValues, setErrors, handleChange, handleBlur, validateAll, reset };
}
