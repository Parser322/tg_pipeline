'use client';
import { useState, useCallback, useEffect, type ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { translationService } from '@/services/translation';
import type { ImageTranslateResult } from '@/types/api';

type TranslateImageParams = {
  imageBase64: string;
  targetLanguage: string;
  size: string;
};

export default function ImageGptRewriter() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const translateImageMutation = useMutation<ImageTranslateResult, Error, TranslateImageParams>({
    mutationFn: ({ imageBase64, targetLanguage, size }) =>
      translationService.translateImageWithGpt(imageBase64, { targetLanguage, size }),
    onSuccess: (data) => {
      setResultImage(`data:image/png;base64,${data.imageBase64}`);
    },
  });

  const onSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(String(ev.target?.result || ''));
    reader.readAsDataURL(f);
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setResultImage(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = String(ev.target?.result || '').split(',')[1] || '';
      translateImageMutation.mutate({
        imageBase64: base64,
        targetLanguage: 'English',
        size: '1024x1024',
      });
    };
    reader.readAsDataURL(file);
  }, [file, translateImageMutation]);

  const clearAll = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResultImage(null);
    translateImageMutation.reset();
  }, [translateImageMutation]);

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = 'gpt-translated.png';
    a.click();
  }, [resultImage]);

  useEffect(() => {
    if (translateImageMutation.error) {
      toast.error('Ошибка', {
        description: translateImageMutation.error.message,
        duration: 4000,
      });
    }
  }, [translateImageMutation.error]);

  return (
    <Card className='shadow-2xl bg-black/80 backdrop-blur-sm border-gray-800'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent'>
          GPT визуальный перевод (эксперимент)
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <input
          type='file'
          accept='image/*'
          onChange={onSelect}
          aria-label='Выберите изображение для GPT-перевода'
        />
        {preview && (
          <div className='space-y-2'>
            <p className='text-sm text-gray-300'>Оригинал:</p>
            <img src={preview} alt='preview' className='max-w-full rounded border' />
          </div>
        )}

        <div className='flex gap-2'>
          <Button
            onClick={run}
            disabled={!file || translateImageMutation.isPending}
            aria-label='Перевести изображение с помощью GPT'
          >
            {translateImageMutation.isPending ? 'Processing...' : 'Translate with GPT'}
          </Button>
          <Button onClick={clearAll} variant='outline' aria-label='Очистить форму'>
            Очистить
          </Button>
        </div>

        {resultImage && (
          <div className='space-y-2'>
            <p className='text-sm text-gray-300'>Результат (может немного отличаться):</p>
            <img src={resultImage} alt='result' className='max-w-full rounded border bg-white' />
            <Button variant='outline' onClick={handleDownload} size='sm'>
              Скачать
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
