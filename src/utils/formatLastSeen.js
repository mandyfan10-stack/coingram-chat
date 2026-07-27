/**
 * Human-readable last-seen string (Russian).
 * @param {string|null|undefined} lastSeenStr
 * @param {boolean} isOnline
 * @returns {string}
 */
export function formatLastSeen(lastSeenStr, isOnline) {
  if (isOnline) return 'в сети';
  if (!lastSeenStr) return 'был(а) недавно';
  try {
    const date = new Date(lastSeenStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'был(а) в сети только что';
    if (diffMins < 60) {
      const lastDigit = diffMins % 10;
      const lastTwoDigits = diffMins % 100;
      let minWord = 'минут';
      if (lastDigit === 1 && lastTwoDigits !== 11) {
        minWord = 'минуту';
      } else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
        minWord = 'минуты';
      }
      return `был(а) в сети ${diffMins} ${minWord} назад`;
    }

    const formatTime = (d) => {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    };

    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
    if (isToday) return `был(а) в сети сегодня в ${formatTime(date)}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
                        date.getMonth() === yesterday.getMonth() &&
                        date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return `был(а) в сети вчера в ${formatTime(date)}`;

    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) {
      const days = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
      const dayOfWeek = days[date.getDay()];
      const prep = dayOfWeek === 'вторник' ? 'во' : 'в';
      return `был(а) в сети ${prep} ${dayOfWeek} в ${formatTime(date)}`;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `был(а) в сети ${day}.${month}.${year} в ${formatTime(date)}`;
  } catch {
    return 'был(а) недавно';
  }
}
