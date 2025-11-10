import { useMutation } from '@tanstack/react-query';
import { translateText } from '@/services/api';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Неизвестная ошибка';
};

export const useTranslation = () => {
  const translationMutation = useMutation({
    mutationFn: ({ text, lang, prompt }: { text: string; lang: string; prompt: string | null }) =>
      translateText(text, lang, prompt),
  });

  const handleTranslate = async (text: string, lang: string, prompt: string | null) => {
    if (!text?.trim()) {
      throw new Error('Текст для перевода не может быть пустым.');
    }

    try {
      const response = await translationMutation.mutateAsync({ text, lang, prompt });

      if (response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maybeText = (response as any).translated_text as string | undefined;
        return maybeText || response.message || '';
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new Error((response as any).error || 'Failed to translate');
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  return {
    handleTranslate,
    isTranslating: translationMutation.isPending,
    translationError: translationMutation.error ? getErrorMessage(translationMutation.error) : null,
    translatedText: translationMutation.data
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((translationMutation.data as any).translated_text as string) ||
        translationMutation.data.message ||
        ''
      : '',
    reset: translationMutation.reset,
  };
};
