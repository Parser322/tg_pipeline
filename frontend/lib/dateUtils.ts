/**
 * Форматирует дату в удобочитаемый формат на русском языке
 * @param dateString - ISO строка даты
 * @returns Форматированная дата или null если дата невалидна
 */
export function formatPostDate(dateString?: string | null): string | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    
    // Проверка на валидность даты
    if (isNaN(date.getTime())) return null;
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    // Только что / минуты назад
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    
    // Часы назад
    if (diffHours < 24) return `${diffHours} ч. назад`;
    
    // Дни назад (до 7 дней)
    if (diffDays < 7) return `${diffDays} дн. назад`;
    
    // Полная дата для более старых постов
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

