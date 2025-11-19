import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';

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
    const [inputValue, setInputValue] = React.useState<string>(() => value || '');
    const [isModified, setIsModified] = React.useState<boolean>(false);
    
    // Используем ref для хранения последнего сохраненного значения
    const savedValueRef = React.useRef<string>(value || '');
    const prevIsSavedRef = React.useRef<boolean>(isSaved);

    // Обновляем inputValue при изменении value prop
    React.useEffect(() => {
      setInputValue(value || '');
    }, [value]);

    // Обновляем savedValue когда канал становится сохраненным
    React.useEffect(() => {
      // Если канал только что был сохранен (переход false -> true)
      if (isSaved && !prevIsSavedRef.current) {
        savedValueRef.current = value || '';
        setIsModified(false);
      }
      // Если канал был удален (переход true -> false) 
      if (!isSaved && prevIsSavedRef.current) {
        savedValueRef.current = '';
      }
      prevIsSavedRef.current = isSaved;
    }, [isSaved, value]);

    // Функция для нормализации username
    const normalizeUsername = (input: string): string => {
      let cleaned = input.trim();
      
      // Удаляем https://t.me/
      if (cleaned.startsWith('https://t.me/')) {
        cleaned = cleaned.replace('https://t.me/', '');
      }
      // Удаляем http://t.me/
      else if (cleaned.startsWith('http://t.me/')) {
        cleaned = cleaned.replace('http://t.me/', '');
      }
      // Удаляем t.me/
      else if (cleaned.startsWith('t.me/')) {
        cleaned = cleaned.replace('t.me/', '');
      }
      // Удаляем @
      else if (cleaned.startsWith('@')) {
        cleaned = cleaned.replace('@', '');
      }
      
      // Удаляем все после первого слеша (если есть дополнительные пути)
      const slashIndex = cleaned.indexOf('/');
      if (slashIndex !== -1) {
        cleaned = cleaned.substring(0, slashIndex);
      }
      
      return cleaned;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = normalizeUsername(e.target.value);
      setInputValue(newValue);
      // Сравниваем с последним сохраненным значением
      setIsModified(newValue !== savedValueRef.current);
      onValueChange?.(newValue);
    };

    const handleSave = () => {
      if (!inputValue.trim()) {
        return;
      }
      onSave?.(inputValue);
      setIsModified(false);
    };

    const handleUnsave = () => {
      if (!inputValue.trim()) {
        return;
      }
      onUnsave?.(inputValue);
    };

    const showSaveButton = !isSaved || isModified;
    const showSavedIndicator = isSaved && !isModified;

    return (
      <div className={cn('relative', className)} ref={ref} {...props}>
        <div className='flex gap-2 items-center'>
          <div className='flex-1 flex items-center h-10 rounded-md border border-input bg-background shadow-xs transition-colors focus-within:outline-none'>
            <div className='flex items-center pl-3 text-sm text-muted-foreground'>t.me/</div>
            <input
              type='text'
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              disabled={disabled}
              aria-label='Имя канала'
              className='flex h-full flex-1 bg-transparent pl-1 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
              suppressHydrationWarning
            />
          </div>

          {showSaveButton && (
            <Button
              type='button'
              variant='default'
              className='h-10 px-4 gap-2'
              onClick={handleSave}
              disabled={disabled || !inputValue.trim()}
            >
              <IconBookmark className='h-4 w-4' />
              <span>Сохранить</span>
            </Button>
          )}

          {showSavedIndicator && (
            <div className='flex items-center gap-2 px-4 h-10 rounded-md bg-secondary text-secondary-foreground'>
              <IconBookmarkFilled className='h-4 w-4 text-primary' />
              <span className='text-sm font-medium'>Сохранено</span>
              <button
                type='button'
                onClick={handleUnsave}
                disabled={disabled}
                className='ml-2 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors disabled:opacity-50'
              >
                Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChannelInput.displayName = 'ChannelInput';

export { ChannelInput };
