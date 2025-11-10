import { useMutation } from '@tanstack/react-query';
import { translateText } from '@/services/api';
import { getErrorMessage } from '@/lib/errorUtils';
import type { OkResponse } from '@/types/api';

type TranslateTextParams = {
  text: string;
  lang: string;
  prompt: string | null;
};

export const useTranslation = () => {
  const translationMutation = useMutation<OkResponse, Error, TranslateTextParams>({
    mutationFn: ({ text, lang, prompt }) => translateText(text, lang, prompt),
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
