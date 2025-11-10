'use client';
import { useState, useCallback, useEffect, type ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { toast } from 'sonner';

type ImageTranslatorProps = {
  translateText: (text: string) => Promise<string>;
};

type TesseractLogger = {
  status: string;
  progress?: number;
};

export default function ImageTranslator({ translateText }: ImageTranslatorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [translated, setTranslated] = useState<string>('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const onSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(String(ev.target?.result || ''));
    reader.readAsDataURL(f);
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    setTranslated('');
    setResultImage(null);

    const Tesseract = (await import('tesseract.js')).default;
    const { data } = await Tesseract.recognize(file, 'rus+eng', {
      logger: (m: TesseractLogger) => {
        if (m.status === 'recognizing text' && m.progress) {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });
    const originalText = (data?.text || '').trim();
    if (!originalText) {
      setError('Не удалось распознать текст на изображении');
      return;
    }

    const translatedText = await translateText(originalText);
    setTranslated(translatedText);

    const img = new Image();
    img.onload = () => {
      const padding = 40;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const baseWidth = img.width;

      ctx.font = 'bold 20px Arial';
      const words = translatedText.split(' ');
      const maxWidth = baseWidth - padding * 2;
      const lineHeight = 28;
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth) {
          if (line) lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      const textBlockHeight = lines.length * lineHeight + padding * 2;
      canvas.width = baseWidth;
      canvas.height = img.height + textBlockHeight;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      ctx.fillStyle = 'white';
      ctx.fillRect(0, img.height, canvas.width, textBlockHeight);
      ctx.fillStyle = 'black';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((l, i) => {
        ctx.fillText(l, padding, img.height + padding + i * lineHeight);
      });

      setResultImage(canvas.toDataURL('image/png'));
    };
    img.onerror = () => setError('Ошибка загрузки изображения');
    if (preview) img.src = preview;
  }, [file, preview, translateText]);

  useEffect(() => {
    if (error) {
      toast.error('Ошибка', { description: error, duration: 4000 });
    }
  }, [error]);

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = 'translated.png';
    a.click();
  }, [resultImage]);

  return (
    <Card className='shadow-2xl bg-black/80 backdrop-blur-sm border-gray-800'>
      <CardHeader>
        <CardTitle className='text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent'>
          Перевод изображения (MVP)
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <input type='file' accept='image/*' onChange={onSelect} aria-label='Выберите изображение для распознавания' />
        {preview && <img src={preview} alt='preview' className='max-w-full rounded border' />}
        {progress > 0 && progress < 100 && <div className='text-sm text-gray-300'>OCR: {progress}%</div>}
        <div className='flex gap-2'>
          <Button onClick={run} disabled={!file} aria-label='Распознать и перевести изображение'>
            Распознать и перевести
          </Button>
        </div>
        {translated && (
          <div className='p-3 bg-gray-100 rounded'>
            <p className='text-sm font-medium'>Переведённый текст:</p>
            <p className='text-black'>{translated}</p>
          </div>
        )}
        {resultImage && (
          <div className='space-y-2'>
            <p className='text-sm font-medium'>Изображение с переведённым текстом (снизу):</p>
            <img src={resultImage} alt='result' className='max-w-full rounded border bg-white' />
            <Button variant='outline' onClick={handleDownload}>
              Скачать
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}



