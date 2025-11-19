'use client';

import { useState } from 'react';
import { TelegramCredentialsManager } from '@/components/TelegramCredentialsManager';
import { SocialIcon } from '@/components/ui/social-icons';
import { cn } from '@/lib/utils';

// Типы для будущих соц сетей
type SocialNetwork = 'telegram' | 'vk' | 'instagram' | 'facebook';

type SettingsSection = {
  id: SocialNetwork;
  label: string;
  description: string;
  component: React.ComponentType;
  enabled: boolean;
};

// Конфигурация секций настроек
const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    description: 'Настройка API credentials для парсинга Telegram каналов',
    component: TelegramCredentialsManager,
    enabled: true,
  },
  // Будущие соц сети (пока отключены)
  // {
  //   id: 'vk',
  //   label: 'ВКонтакте',
  //   description: 'Настройка API credentials для парсинга VK групп',
  //   component: VKCredentialsManager,
  //   enabled: false,
  // },
  // {
  //   id: 'instagram',
  //   label: 'Instagram',
  //   description: 'Настройка API credentials для парсинга Instagram',
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
    <div className='bg-background'>
      <div className='container max-w-6xl mx-auto px-4 py-6'>
        {/* Макет: Sidebar + Content */}
        <div className='grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8'>
          {/* Sidebar - Список соц сетей */}
          <aside className='space-y-6'>
            <nav className='space-y-1'>
              {enabledSections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors font-medium',
                    activeSection === section.id
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  <SocialIcon type={section.id} size={20} />
                  <span>{section.label}</span>
                </button>
              ))}
            </nav>

            {/* Placeholder для будущих соц сетей */}
            <div className='pt-4 border-t'>
              <p className='text-xs font-medium text-muted-foreground px-3 mb-3 uppercase tracking-wider'>Скоро</p>
              <div className='space-y-1'>
                <div className='flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground/40 cursor-not-allowed'>
                  <SocialIcon type='instagram' size={20} className='opacity-40' />
                  <span>Instagram</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content - Активная секция */}
          <main>
            {currentSection && (
              <div className='space-y-4'>
                {/* Описание секции */}
                <div className='mb-2'>
                  <p className='text-sm text-muted-foreground'>{currentSection.description}</p>
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

