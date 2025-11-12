import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

type NumberInputProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  description?: string;
};

const NumberInput = React.forwardRef<HTMLDivElement, NumberInputProps>(
  (
    {
      className,
      value,
      onValueChange,
      min = 0,
      max = Infinity,
      step = 1,
      disabled = false,
      label,
      description,
      ...props
    },
    ref
  ) => {
    const handleIncrement = () => {
      const newValue = Math.min(max, (value || 0) + step);
      onValueChange?.(newValue);
    };

    const handleDecrement = () => {
      const newValue = Math.max(min, (value || 0) - step);
      onValueChange?.(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseInt(e.target.value) || 0;
      if (newValue >= min && newValue <= max) {
        onValueChange?.(newValue);
      }
    };

    return (
      <div className={cn('space-y-2', className)} ref={ref} {...props}>
        {label && (
          <div className='space-y-1'>
            <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
              {label}
            </label>
            {description && <p className='text-sm text-muted-foreground'>{description}</p>}
          </div>
        )}

        <div className='flex items-center gap-1'>
          <input
            type='number'
            value={value || ''}
            onChange={handleInputChange}
            min={min}
            max={max}
            disabled={disabled}
            className='flex h-8 w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-center shadow-xs transition-[color,box-shadow] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]'
          />

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-8 p-0'
            onClick={handleDecrement}
            disabled={disabled || value <= (min as number)}
          >
            −
          </Button>

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-8 p-0'
            onClick={handleIncrement}
            disabled={disabled || value >= (max as number)}
          >
            +
          </Button>
        </div>
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

export { NumberInput };



