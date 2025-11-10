import { useState, useCallback, useMemo } from 'react';

const validatePostLimit = (value: number): string => {
  if (!value || value < 1) {
    return 'Лимит должен быть больше 0';
  }
  if (value > 1000) {
    return 'Лимит не должен превышать 1000';
  }
  if (!Number.isInteger(value)) {
    return 'Лимит должен быть целым числом';
  }
  return '';
};

export const usePostLimit = () => {
  const [postLimit, setPostLimit] = useState<number>(3);
  const [validationError, setValidationError] = useState<string>('');

  const handlePostLimitChange = useCallback((event: { target: { value: string } }) => {
    const value = parseInt(event.target.value, 10) || 0;
    setPostLimit(value);
    const error = validatePostLimit(value);
    setValidationError(error);
  }, []);

  const setPostLimitValue = useCallback((value: number) => {
    const numeric = Number.isFinite(value) ? Math.trunc(value) : 0;
    setPostLimit(numeric);
    const error = validatePostLimit(numeric);
    setValidationError(error);
  }, []);

  return useMemo(
    () => ({
      postLimit,
      validationError,
      handlePostLimitChange,
      setPostLimitValue,
    }),
    [postLimit, validationError, handlePostLimitChange, setPostLimitValue]
  );
};



