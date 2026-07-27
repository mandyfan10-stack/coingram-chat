export interface ThemeOption {
  id: string;
  name: string;
  color: string;
}

export interface WallpaperOption {
  id: string;
  name: string;
  style: string;
}

export const SETTINGS_THEMES: ThemeOption[] = [
  { id: 'telegram-blue', name: 'Синий', color: '#2481cc' },
  { id: 'emerald-green', name: 'Изумруд', color: '#0f9d58' },
  { id: 'sakura-pink', name: 'Сакура', color: '#e07a5f' },
  { id: 'electric-purple', name: 'Фиолет', color: '#8a2be2' },
  { id: 'sunset-amber', name: 'Янтарь', color: '#d97706' },
  { id: 'rainbow-pearl', name: 'Радуга', color: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #00ccff, #8a2be2, #ff00ff)' }
];

export const SETTINGS_WALLPAPERS: WallpaperOption[] = [
  { id: 'classic', name: 'Классик', style: 'radial-gradient(circle, #f3f4f6 0%, #e5e7eb 100%)' },
  { id: 'sunset', name: 'Закат', style: 'linear-gradient(135deg, #fce38a 0%, #f38181 100%)' },
  { id: 'space', name: 'Космос', style: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'mint', name: 'Мята', style: 'linear-gradient(135deg, #a8ff78 0%, #78ffd6 100%)' }
];
