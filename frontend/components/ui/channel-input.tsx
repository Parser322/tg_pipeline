import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Check } from 'lucide-react';

type ChannelInputProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value?: string;
  onValueChange?: (value: string) => void;
  onSave?: (value: string) => void;
  onUnsave?: (value: string) => void;
  isSaved?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

const ChannelInput = React.forwardRef<HTMLDivElement, ChannelInputProps>(
  (
    {
      className,
      value,
      onValueChange,
      onSave,
      onUnsave,
      isSaved = false,
      disabled = false,
      placeholder = 'канал',
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState<string>(value || '');
    const [isModified, setIsModified] = React.useState<boolean>(false);

    React.useEffect(() => {
      setInputValue(value || '');
      setIsModified(false);
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setIsModified(newValue !== value);
      onValueChange?.(newValue);
    };

    const handleButtonClick = () => {
      if (!inputValue.trim()) {
        return;
      }

      if (isSaved && !isModified) {
        onUnsave?.(inputValue);
      } else {
        onSave?.(inputValue);
        setIsModified(false);
      }
    };

    const buttonVariant = (isSaved && !isModified ? 'secondary' : 'outline') as any;
    const isButtonDisabled = disabled || !inputValue.trim();
    const buttonLabel = isSaved && !isModified ? 'Удалить сохранённый канал' : 'Сохранить канал';

    return (
      <div className={cn('relative', className)} ref={ref} {...props}>
        <div className='flex w-full items-center rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:outline-none focus-within:ring-[3px] focus-within:ring-ring/30 focus-within:ring-offset-0'>
          <div className='flex items-center pl-3 text-sm text-muted-foreground'>@</div>
          <input
            type='text'
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            aria-label='Имя канала без @'
            className='flex h-8 flex-1 bg-transparent pl-1 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
          />
          <div className='flex items-center pr-1'>
            <Button
              type='button'
              variant={buttonVariant}
              size='sm'
              className='h-6 w-6 p-0 rounded-full'
              onClick={handleButtonClick}
              disabled={isButtonDisabled}
              aria-label={buttonLabel}
              title={buttonLabel}
            >
              <Check className='h-3 w-3' />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ChannelInput.displayName = 'ChannelInput';

export { ChannelInput };



