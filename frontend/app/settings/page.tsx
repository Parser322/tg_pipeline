'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TelegramCredentialsManager } from '@/components/TelegramCredentialsManager';
import { cn } from '@/lib/utils';

// Типы для будущих соц сетей
type SocialNetwork = 'telegram' | 'vk' | 'instagram' | 'facebook';

type SettingsSection = {
  id: SocialNetwork;
  label: string;
  description: string;
  icon: string;
  component: React.ComponentType;
  enabled: boolean;
};

// Конфигурация секций настроек
const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    description: 'Настройка API credentials для парсинга Telegram каналов',
    icon: '📱',
    component: TelegramCredentialsManager,
    enabled: true,
  },
  // Будущие соц сети (пока отключены)
  // {
  //   id: 'vk',
  //   label: 'ВКонтакте',
  //   description: 'Настройка API credentials для парсинга VK групп',
  //   icon: '🔵',
  //   component: VKCredentialsManager,
  //   enabled: false,
  // },
  // {
  //   id: 'instagram',
  //   label: 'Instagram',
  //   description: 'Настройка API credentials для парсинга Instagram',
  //   icon: '📷',
  //   component: InstagramCredentialsManager,
  //   enabled: false,
  // },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SocialNetwork>('telegram');

  const enabledSections = SETTINGS_SECTIONS.filter(s => s.enabled);
  const currentSection = enabledSections.find(s => s.id === activeSection);
  const SectionComponent = currentSection?.component;

  return (
    <div className='min-h-screen bg-background'>
      <div className='container max-w-6xl mx-auto px-4 py-6'>
        {/* Заголовок */}
        <div className='mb-6'>
          <h1 className='text-2xl md:text-3xl font-bold mb-2'>Настройки</h1>
          <p className='text-muted-foreground'>
            Управление API credentials для различных социальных сетей
          </p>
        </div>

        {/* Макет: Sidebar + Content */}
        <div className='grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6'>
          {/* Sidebar - Список соц сетей */}
          <aside className='space-y-2'>
            <Card className='shadow-sm'>
              <CardContent className='p-3'>
                <nav className='space-y-1'>
                  {enabledSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                        activeSection === section.id
                          ? 'bg-accent text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                    >
                      <span className='text-xl'>{section.icon}</span>
                      <span>{section.label}</span>
                    </button>
                  ))}
                </nav>

                {/* Placeholder для будущих соц сетей */}
                <div className='mt-4 pt-4 border-t'>
                  <p className='text-xs text-muted-foreground px-3 mb-2'>
                    Скоро появится
                  </p>
                  <div className='space-y-1'>
                    <div className='flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground/50'>
                      <span className='text-xl'>🔵</span>
                      <span>ВКонтакте</span>
                    </div>
                    <div className='flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground/50'>
                      <span className='text-xl'>📷</span>
                      <span>Instagram</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content - Активная секция */}
          <main>
            {currentSection && (
              <div className='space-y-4'>
                {/* Описание секции */}
                <div className='mb-4'>
                  <h2 className='text-xl font-semibold flex items-center gap-2'>
                    <span className='text-2xl'>{currentSection.icon}</span>
                    {currentSection.label}
                  </h2>
                  <p className='text-sm text-muted-foreground mt-1'>
                    {currentSection.description}
                  </p>
                </div>

                {/* Компонент настроек */}
                {SectionComponent && <SectionComponent />}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

