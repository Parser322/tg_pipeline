import { useState } from 'react';
import { translateText } from '@/services/api';
import type { OkResponse, TranslateResult } from '@/types/api';

export const useTranslation = () => {
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const handleTranslate = async (text: string, lang: string, prompt: string | null) => {
    if (!text || !text.trim()) {
      setTranslationError('Text for translation cannot be empty.');
      return;
    }
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const response = await translateText(text, lang, prompt);
      if (response.data.ok) {
        const maybeText = (response.data as any).translated_text as string | undefined;
        if (maybeText) {
          setTranslatedText(maybeText);
        } else {
          setTranslatedText(response.data.message || '');
        }
      } else {
        throw new Error((response.data as any).error || 'Failed to translate');
      }
    } catch (err: any) {
      const errorMsg = (err as Error).message || 'An unknown error occurred';
      setTranslationError(errorMsg);
      setTranslatedText('');
    } finally {
      setIsTranslating(false);
    }
  };

  return {
    translatedText,
    isTranslating,
    translationError,
    handleTranslate,
  };
};



