import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconMinus, IconPlus } from '@tabler/icons-react';

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
      const newValue = Math.min(max, (value ?? 0) + step);
      onValueChange?.(newValue);
    };

    const handleDecrement = () => {
      const newValue = Math.max(min, (value ?? 0) - step);
      onValueChange?.(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
      if (!isNaN(newValue) && newValue >= min && newValue <= max) {
        onValueChange?.(newValue);
      }
    };

    return (
      <div className={cn('flex items-center justify-between gap-4', className)} ref={ref} {...props}>
        {/* Label and description on the left */}
        <div className='flex-1 space-y-1'>
          {label && (
            <div className='text-sm font-medium leading-none'>
              {label}
            </div>
          )}
          {description && <p className='text-xs text-muted-foreground'>{description}</p>}
        </div>

        {/* Button group with input and buttons */}
        <div className='flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative [&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none'>
          <input
            type='number'
            value={value ?? ''}
            onChange={handleInputChange}
            min={min}
            max={max}
            disabled={disabled}
            className='h-8 !w-14 font-mono rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield] text-center'
          />
          
          <button
            type='button'
            onClick={handleDecrement}
            disabled={disabled || value <= (min as number)}
            className='inline-flex items-center justify-center size-8 rounded-md border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
            aria-label='Decrement'
          >
            <IconMinus className='size-4' />
          </button>
          
          <button
            type='button'
            onClick={handleIncrement}
            disabled={disabled || value >= (max as number)}
            className='inline-flex items-center justify-center size-8 rounded-md border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
            aria-label='Increment'
          >
            <IconPlus className='size-4' />
          </button>
        </div>
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

export { NumberInput };
