'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';
import { Badge } from './ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { toast } from 'sonner';
import {
  getUserTelegramCredentials,
  deleteUserTelegramCredentials,
  validateTelegramCredentials,
  sendTelegramCode,
  verifyTelegramCode,
  verifyTelegramPassword,
} from '@/services/api';
import type {
  UserTelegramCredentialsResponse,
  OkResponse,
  ValidateCredentialsResponse,
  SendCodeResponse,
  VerifyCodeResponse,
  VerifyPasswordResponse,
} from '@/types/api';

type Step = 'view' | 'input' | 'code' | 'password' | 'success';

export function TelegramCredentialsManager() {
  const queryClient = useQueryClient();

  // Step management
  const [step, setStep] = useState<Step>('view');

  // Form state - Step 1 (input)
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 2 (code)
  const [code, setCode] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>(0);

  // Step 3 (password)
  const [password, setPassword] = useState('');

  // Countdown timer
  const [countdown, setCountdown] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Загружаем текущие credentials
  const credentialsQuery = useQuery<UserTelegramCredentialsResponse, Error>({
    queryKey: ['user-telegram-credentials'],
    queryFn: ({ signal }) => getUserTelegramCredentials(signal),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Countdown timer для истечения кода
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Countdown для повторной отправки
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Мутация для отправки кода
  const sendCodeMutation = useMutation<SendCodeResponse, Error, void>({
    mutationFn: async () => {
      if (!apiId || !apiHash || !phoneNumber) {
        throw new Error('Заполните все обязательные поля');
      }

      // Валидация номера телефона
      if (!phoneNumber.startsWith('+')) {
        throw new Error('Номер должен начинаться с "+"');
      }

      if (!/^\+\d{10,15}$/.test(phoneNumber)) {
        throw new Error('Неверный формат номера. Используйте международный формат (+7...)');
      }

      return sendTelegramCode({
        telegram_api_id: parseInt(apiId),
        telegram_api_hash: apiHash,
        phone_number: phoneNumber,
      });
    },
    onSuccess: (data) => {
      if (data.ok && data.code_sent) {
        setSessionKey(data.session_key);
        setPhoneCodeHash(data.phone_code_hash);
        setCountdown(data.expires_in || 300);
        setResendCooldown(60); // Cooldown 60 секунд перед повторной отправкой
        setStep('code');
        toast.success('Код отправлен!', {
          description: `Проверьте Telegram на номере ${phoneNumber}`,
        });
      } else {
        throw new Error(data.error || 'Не удалось отправить код');
      }
    },
    onError: (error: any) => {
      const retryAfter = error.response?.data?.retry_after;
      if (retryAfter) {
        toast.error('Слишком много попыток', {
          description: `Подождите ${retryAfter} секунд`,
        });
        setResendCooldown(retryAfter);
      } else {
        toast.error('Ошибка отправки кода', {
          description: error.message || 'Проверьте введенные данные',
        });
      }
    },
  });

  // Мутация для проверки кода
  const verifyCodeMutation = useMutation<VerifyCodeResponse, Error, void>({
    mutationFn: async () => {
      if (!code) {
        throw new Error('Введите код подтверждения');
      }

      return verifyTelegramCode({
        telegram_api_id: parseInt(apiId),
        telegram_api_hash: apiHash,
        phone_number: phoneNumber,
        code: code,
        phone_code_hash: phoneCodeHash,
        session_key: sessionKey,
      });
    },
    onSuccess: (data) => {
      if (data.ok && data.authorized) {
        // Успешная авторизация!
        setStep('success');
        toast.success('Успешно!', {
          description: 'Telegram аккаунт подключен',
        });
        setTimeout(() => {
          resetForm();
          void queryClient.invalidateQueries({ queryKey: ['user-telegram-credentials'] });
        }, 2000);
      } else if (data.ok && data.needs_password) {
        // Требуется 2FA пароль
        setStep('password');
        toast.info('Требуется пароль', {
          description: 'Ваш аккаунт защищен двухфакторной аутентификацией',
        });
      } else {
        throw new Error(data.error || 'Ошибка авторизации');
      }
    },
    onError: (error: any) => {
      const retryAfter = error.response?.data?.retry_after;
      if (retryAfter) {
        toast.error('Слишком много попыток', {
          description: `Подождите ${retryAfter} секунд`,
        });
      } else {
        toast.error('Ошибка проверки кода', {
          description: error.message || 'Неверный код подтверждения',
        });
      }
      // Не сбрасываем код, чтобы пользователь мог попробовать еще раз
    },
  });

  // Мутация для проверки 2FA пароля
  const verifyPasswordMutation = useMutation<VerifyPasswordResponse, Error, void>({
    mutationFn: async () => {
      if (!password) {
        throw new Error('Введите пароль');
      }

      return verifyTelegramPassword({
        password: password,
        session_key: sessionKey,
      });
    },
    onSuccess: (data) => {
      if (data.ok && data.authorized) {
        setStep('success');
        toast.success('Успешно!', {
          description: 'Авторизация с 2FA завершена',
        });
        setTimeout(() => {
          resetForm();
          void queryClient.invalidateQueries({ queryKey: ['user-telegram-credentials'] });
        }, 2000);
      } else {
        throw new Error(data.error || 'Ошибка авторизации');
      }
    },
    onError: (error: any) => {
      toast.error('Ошибка проверки пароля', {
        description: error.message || 'Неверный пароль двухфакторной аутентификации',
      });
    },
  });

  // Мутация для удаления
  const deleteMutation = useMutation<OkResponse, Error, void>({
    mutationFn: deleteUserTelegramCredentials,
    onSuccess: () => {
      toast.success('Credentials удалены');
      void queryClient.invalidateQueries({ queryKey: ['user-telegram-credentials'] });
    },
    onError: (error) => {
      toast.error('Ошибка удаления', {
        description: error.message,
      });
    },
  });

  // Мутация для валидации
  const validateMutation = useMutation<ValidateCredentialsResponse, Error, void>({
    mutationFn: validateTelegramCredentials,
    onSuccess: (data) => {
      if (data.valid) {
        toast.success('Credentials валидны!', {
          description: data.message,
        });
      } else {
        toast.error('Credentials невалидны', {
          description: data.message,
        });
      }
    },
    onError: (error) => {
      toast.error('Ошибка валидации', {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setStep('view');
    setApiId('');
    setApiHash('');
    setPhoneNumber('');
    setCode('');
    setPassword('');
    setSessionKey('');
    setPhoneCodeHash('');
    setCountdown(0);
    setResendCooldown(0);
  };

  const handleStartAuth = () => {
    setStep('input');
  };

  const handleSendCode = () => {
    sendCodeMutation.mutate();
  };

  const handleResendCode = () => {
    setCode('');
    sendCodeMutation.mutate();
  };

  const handleVerifyCode = () => {
    verifyCodeMutation.mutate();
  };

  const handleVerifyPassword = () => {
    verifyPasswordMutation.mutate();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  const handleValidate = () => {
    validateMutation.mutate();
  };

  const handleCancel = () => {
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = () => {
    resetForm();
    setCancelDialogOpen(false);
  };

  const hasCredentials = credentialsQuery.data?.has_credentials ?? false;
  const isCredsLoaded = credentialsQuery.isSuccess;
  const isLoading =
    credentialsQuery.isLoading ||
    sendCodeMutation.isPending ||
    verifyCodeMutation.isPending ||
    verifyPasswordMutation.isPending ||
    deleteMutation.isPending;

  return (
    <Card className='shadow-sm rounded-lg'>
      <CardContent className='p-4 space-y-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-semibold'>Telegram API Credentials</h3>
            <p className='text-sm text-gray-600 mt-1'>
              {step === 'view' && 'Настройте свои credentials для работы с Telegram API'}
              {step === 'input' && 'Шаг 1: Введите API данные и номер телефона'}
              {step === 'code' && 'Шаг 2: Введите код из Telegram'}
              {step === 'password' && 'Шаг 3: Введите пароль 2FA'}
              {step === 'success' && 'Авторизация завершена!'}
            </p>
          </div>
          {isCredsLoaded && hasCredentials && step === 'view' && (
            <Badge variant='default' className='bg-green-600'>
              ✓ Сохранено
            </Badge>
          )}
        </div>

        {/* VIEW MODE - Показ существующих credentials */}
        {isCredsLoaded && step === 'view' && hasCredentials && (
          <div className='space-y-3'>
            <Alert>
              <div className='space-y-2'>
                <p className='text-sm'>
                  <strong>API ID:</strong> {credentialsQuery.data?.telegram_api_id}
                </p>
                {credentialsQuery.data?.phone_number && (
                  <p className='text-sm'>
                    <strong>Телефон:</strong> {credentialsQuery.data.phone_number}
                  </p>
                )}
                {credentialsQuery.data?.created_at && (
                  <p className='text-sm text-gray-500' suppressHydrationWarning>
                    Добавлено: {new Date(credentialsQuery.data.created_at).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
            </Alert>

            <div className='flex gap-2'>
              <Button
                onClick={handleValidate}
                disabled={validateMutation.isPending}
                variant='outline'
                size='sm'
              >
                {validateMutation.isPending ? 'Проверка...' : 'Проверить валидность'}
              </Button>
              <Button onClick={handleStartAuth} variant='outline' size='sm'>
                Переавторизоваться
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                variant='destructive'
                size='sm'
              >
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        )}

        {isCredsLoaded && step === 'view' && !hasCredentials && (
          <div className='space-y-3'>
            <Alert>
              <p className='text-sm'>
                У вас нет сохраненных Telegram credentials. Добавьте их, чтобы использовать функции
                парсинга.
              </p>
            </Alert>
            <Button onClick={handleStartAuth} size='sm'>
              Добавить Credentials
            </Button>
          </div>
        )}

        {/* STEP 1: INPUT - Ввод API ID, Hash и телефона */}
        {step === 'input' && (
          <div className='space-y-3'>
            <Alert>
              <p className='text-sm mb-2'>
                Получите API credentials на{' '}
                <a
                  href='https://my.telegram.org/apps'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline font-medium'
                >
                  my.telegram.org/apps
                </a>
              </p>
              <p className='text-xs text-gray-600'>
                ℹ️ После ввода данных вы получите код подтверждения в Telegram
              </p>
            </Alert>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                API ID <span className='text-red-500'>*</span>
              </label>
              <Input
                type='number'
                placeholder='12345678'
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                API Hash <span className='text-red-500'>*</span>
              </label>
              <Input
                type='text'
                placeholder='abcdef1234567890abcdef1234567890'
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                disabled={isLoading}
                maxLength={32}
              />
              <p className='text-xs text-gray-500'>Должно быть 32 символа</p>
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                Номер телефона <span className='text-red-500'>*</span>
              </label>
              <Input
                type='tel'
                placeholder='+79001234567'
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isLoading}
              />
              <p className='text-xs text-gray-500'>Международный формат (начинается с +)</p>
            </div>

            <div className='flex gap-2 pt-2'>
              <Button
                onClick={handleSendCode}
                disabled={isLoading || !apiId || !apiHash || !phoneNumber || apiHash.length !== 32}
              >
                {sendCodeMutation.isPending ? 'Отправка...' : 'Получить код'}
              </Button>
              <Button onClick={handleCancel} variant='outline' disabled={isLoading}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: CODE - Ввод кода подтверждения */}
        {step === 'code' && (
          <div className='space-y-3'>
            <Alert>
              <div className='space-y-2'>
                <p className='text-sm'>
                  📱 Код отправлен в Telegram на номер <strong>{phoneNumber}</strong>
                </p>
                {countdown > 0 && (
                  <p className='text-xs text-gray-600'>
                    Код действителен еще {Math.floor(countdown / 60)}:
                    {String(countdown % 60).padStart(2, '0')}
                  </p>
                )}
                {countdown === 0 && (
                  <p className='text-xs text-red-600'>Код истек. Запросите новый.</p>
                )}
              </div>
            </Alert>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                Код подтверждения <span className='text-red-500'>*</span>
              </label>
              <Input
                type='text'
                placeholder='12345'
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={isLoading}
                maxLength={6}
                autoFocus
                className='text-center text-2xl tracking-widest'
              />
              <p className='text-xs text-gray-500'>Введите 5-6 цифр из Telegram</p>
            </div>

            <div className='flex gap-2 pt-2'>
              <Button
                onClick={handleVerifyCode}
                disabled={isLoading || !code || code.length < 5 || countdown === 0}
              >
                {verifyCodeMutation.isPending ? 'Проверка...' : 'Подтвердить'}
              </Button>
              <Button
                onClick={handleResendCode}
                variant='outline'
                disabled={isLoading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Повтор через ${resendCooldown}с` : 'Отправить повторно'}
              </Button>
              <Button onClick={handleCancel} variant='ghost' disabled={isLoading}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: PASSWORD - Ввод 2FA пароля */}
        {step === 'password' && (
          <div className='space-y-3'>
            <Alert>
              <div className='space-y-2'>
                <p className='text-sm'>🔒 Ваш аккаунт защищен двухфакторной аутентификацией</p>
                <p className='text-xs text-gray-600'>
                  Введите пароль, который вы установили в настройках Telegram
                </p>
              </div>
            </Alert>

            <div className='space-y-2'>
              <label className='block text-sm font-medium'>
                Пароль 2FA <span className='text-red-500'>*</span>
              </label>
              <Input
                type='password'
                placeholder='Введите пароль от Telegram'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className='flex gap-2 pt-2'>
              <Button onClick={handleVerifyPassword} disabled={isLoading || !password}>
                {verifyPasswordMutation.isPending ? 'Проверка...' : 'Подтвердить'}
              </Button>
              <Button onClick={handleCancel} variant='outline' disabled={isLoading}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS - Успешная авторизация */}
        {step === 'success' && (
          <div className='space-y-3'>
            <Alert className='bg-green-50 border-green-200'>
              <div className='space-y-2'>
                <p className='text-sm font-semibold text-green-800'>
                  ✅ Telegram аккаунт успешно подключен!
                </p>
                <p className='text-xs text-green-700'>
                  Теперь вы можете использовать функции парсинга каналов
                </p>
              </div>
            </Alert>
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить Telegram credentials?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите удалить свои Telegram credentials? Это действие нельзя
                отменить.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>Удалить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Отменить авторизацию?</AlertDialogTitle>
              <AlertDialogDescription>
                Весь прогресс авторизации будет потерян. Вы уверены, что хотите отменить?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Продолжить авторизацию</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelConfirm}>Отменить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
