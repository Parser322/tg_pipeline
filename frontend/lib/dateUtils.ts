/**
 * Форматирует дату в формат dd.mm.yy, hh:mm
 * @param dateString - ISO строка даты
 * @returns Форматированная дата или null если дата невалидна
 */
export function formatPostDate(dateString?: string | null): string | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    
    // Проверка на валидность даты
    if (isNaN(date.getTime())) return null;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

