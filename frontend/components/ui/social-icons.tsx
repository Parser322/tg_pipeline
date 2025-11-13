import React from 'react';
import {
  IconBrandTelegram,
  IconBrandVk,
  IconBrandInstagram,
  IconBrandFacebook,
} from '@tabler/icons-react';

interface IconProps extends Omit<React.ComponentProps<'svg'>, 'ref'> {
  size?: number;
  className?: string;
}

export const TelegramIcon: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
  <IconBrandTelegram width={size} height={size} className={className} {...props} />
);

export const VKIcon: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
  <IconBrandVk width={size} height={size} className={className} {...props} />
);

export const InstagramIcon: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
  <IconBrandInstagram width={size} height={size} className={className} {...props} />
);

export const FacebookIcon: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
  <IconBrandFacebook width={size} height={size} className={className} {...props} />
);

// Универсальный компонент для выбора иконки
interface SocialIconProps extends IconProps {
  type: 'telegram' | 'vk' | 'instagram' | 'facebook';
}

export const SocialIcon: React.FC<SocialIconProps> = ({ type, ...props }) => {
  switch (type) {
    case 'telegram':
      return <TelegramIcon {...props} />;
    case 'vk':
      return <VKIcon {...props} />;
    case 'instagram':
      return <InstagramIcon {...props} />;
    case 'facebook':
      return <FacebookIcon {...props} />;
    default:
      return null;
  }
};
