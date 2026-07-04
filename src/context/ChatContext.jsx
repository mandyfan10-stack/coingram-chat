import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

const ChatContext = createContext();

const playSound = (type = 'incoming') => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    if (type === 'incoming') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.07); // G5
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } else { // outgoing
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }
  } catch (e) {
    console.warn("AudioContext failed", e);
  }
};

const initialStories = [];

const initialChatsMock = [
  {
    id: 'chat-1',
    name: 'Алиса 🌸',
    type: 'personal',
    avatar: '🌸',
    avatarColor: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    isOnline: true,
    lastSeen: 'в сети',
    pinned: true,
    notifications: true,
    bio: 'Люблю дизайн, кофе и котиков ☕🐱. UI/UX Designer.',
    username: 'alice_design',
    messages: [
      { id: 'm1', senderId: 'alice', senderName: 'Алиса', text: 'Привет! Мы сегодня увидимся на обсуждении проекта?', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
      { id: 'm2', senderId: 'alice', senderName: 'Алиса', text: 'Я подготовила новые дизайн-макеты для профиля. Нам нужно обсудить цветовую гамму!', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 55) }
    ]
  },
  {
    id: 'chat-2',
    name: 'Antigravity Devs 💻',
    type: 'group',
    avatar: '👥',
    avatarColor: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
    pinned: true,
    notifications: true,
    bio: 'Группа разработки самого крутого CoinGram. Флуд разрешен!',
    username: 'antigravity_dev_group',
    members: [
      { id: 'alice', name: 'Алиса', avatar: '🌸' },
      { id: 'bob', name: 'Bob Dev', avatar: '💻' },
      { id: 'charlie', name: 'Charlie QA', avatar: '🕵️' },
      { id: 'current', name: 'Вы', avatar: '🪙' }
    ],
    messages: [
      { id: 'm3', senderId: 'alice', senderName: 'Алиса', text: 'Всем привет! Как продвигается разработка нашего CoinGram?', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
      { id: 'm4', senderId: 'bob', senderName: 'Bob Dev', text: 'Делаю суперплавные CSS-анимации. Выглядит космически! 🪐', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.8) },
      { id: 'm5', senderId: 'charlie', senderName: 'Charlie QA', text: 'Отлично. Я настроил автоматические тесты, пока всё зеленое 🟢. Буду тестить дальше.', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5) }
    ]
  },
  {
    id: 'chat-3',
    name: 'Echo Bot 🤖',
    type: 'bot',
    avatar: '🤖',
    avatarColor: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    isOnline: true,
    lastSeen: 'бот',
    pinned: false,
    notifications: true,
    bio: 'Я бот-повторюшка. Напиши мне что-нибудь, и я отвечу эхом, добавив немного юмора!',
    username: 'echo_luxury_bot',
    messages: [
      { id: 'm6', senderId: 'bot', senderName: 'Echo Bot', text: 'Привет! Я Echo Bot. Я буду повторять всё, что ты мне пришлешь, с небольшим творческим дополнением 📣.', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12) }
    ]
  },
  {
    id: 'chat-4',
    name: 'Quiz Master 🧠',
    type: 'bot',
    avatar: '🧠',
    avatarColor: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    isOnline: true,
    lastSeen: 'бот',
    pinned: false,
    notifications: true,
    bio: 'Официальный бот викторин. Набери максимальный балл!',
    username: 'quiz_master_bot',
    messages: [
      { id: 'm7', senderId: 'bot', senderName: 'Quiz Master', text: 'Привет! Хочешь сыграть в викторину и проверить свои знания? 🎯 Напиши /quiz, чтобы начать игру!', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) }
    ]
  },
  {
    id: 'chat-5',
    name: 'Weather Bot 🌤️',
    type: 'bot',
    avatar: '🌤️',
    avatarColor: 'linear-gradient(135deg, #a8ceff 0%, #ffebaa 100%)',
    isOnline: true,
    lastSeen: 'бот',
    pinned: false,
    notifications: false,
    bio: 'Самый точный прогноз погоды прямо в чате. Просто напиши название города.',
    username: 'weather_lux_bot',
    messages: [
      { id: 'm8', senderId: 'bot', senderName: 'Weather Bot', text: 'Привет! Напиши мне название любого города (например: Москва, Париж, Токио), и я пришлю тебе текущую погоду ☀️🌧️❄️.', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) }
    ]
  },
  {
    id: 'chat-6',
    name: 'Tech Waves 🌊',
    type: 'channel',
    avatar: '🌊',
    avatarColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    pinned: false,
    notifications: true,
    bio: 'Самые свежие новости из мира IT, гаджетов и искусственного интеллекта. Будь в волне!',
    username: 'tech_waves_channel',
    messages: [
      { id: 'm9', senderId: 'channel', senderName: 'Tech Waves', text: '🚀 Встречайте новую версию React 19! В ней полностью интегрированы React Server Components, действия (Actions) для работы с формами и новый хук use(). Разработка станет еще быстрее!', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8) },
      { id: 'm10', senderId: 'channel', senderName: 'Tech Waves', text: '🧠 Google представил новые экспериментальные модели Gemini 3.5, которые демонстрируют выдающиеся результаты в написании кода и логических рассуждениях. ИИ становится все более автономным.', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 30) }
    ]
  }
];

const quizQuestions = [
  { q: "Какой язык программирования используется для веб-страниц чаще всего?", a: "javascript" },
  { q: "Какая планета Солнечной системы самая большая?", a: "юпитер" },
  { q: "Как называется столица Франции?", a: "париж" },
  { q: "Как называется фреймворк, созданный Facebook, для реактивного UI?", a: "react" },
  { q: "Что означает аббревиатура HTML?", a: "hypertext markup language" }
];

export const ChatProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [stories, setStories] = useState(initialStories);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('coingram-dark-mode') !== 'false';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('theme-light');
      localStorage.setItem('coingram-dark-mode', 'true');
    } else {
      document.documentElement.classList.add('theme-light');
      localStorage.setItem('coingram-dark-mode', 'false');
    }
  }, [isDarkMode]);

  const [settingsTab, setSettingsTab] = useState('profile');
  const [newChatModalTab, setNewChatModalTab] = useState('personal');

  const renderAvatar = useCallback((avatar, fallback = '👤') => {
    const isUrl = avatar && (avatar.startsWith('http') || avatar.startsWith('data:image'));
    return isUrl ? (
      <img 
        src={avatar} 
        alt="avatar" 
        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} 
      />
    ) : (
      avatar || fallback
    );
  }, []);
  const [typingStatuses, setTypingStatuses] = useState({});
  
  const typingChannelRef = useRef(null);
  const typingTimeoutsRef = useRef({});
  
  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);
  
  // Theme and wallpaper settings
  const [theme, setTheme] = useState('telegram-blue');
  const [wallpaper, setWallpaper] = useState('classic');

  const quizStateRef = useRef({});

  // Sync settings with HTML tags/classes
  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-wallpaper', wallpaper);
  }, [wallpaper]);

  // Auth State Listener
  useEffect(() => {
    if (isSupabaseConfigured) {
      // 1. Live mode auth initialization
      const initAuth = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profile && !error) {
              setCurrentUser({
                id: profile.id,
                name: profile.display_name,
                username: profile.username,
                avatarColor: profile.avatar_color,
                bio: profile.bio,
                theme: profile.theme,
                wallpaper: profile.wallpaper,
                avatar: profile.avatar
              });
              setTheme(profile.theme || 'telegram-blue');
              setWallpaper(profile.wallpaper || 'classic');
            }
          }
        } catch (e) {
          console.error("Auth initialization failed", e);
        } finally {
          setAuthLoading(false);
        }
      };

      initAuth();

      // Listen for updates
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            setCurrentUser({
              id: profile.id,
              name: profile.display_name,
              username: profile.username,
              avatarColor: profile.avatar_color,
              bio: profile.bio,
              theme: profile.theme,
              wallpaper: profile.wallpaper,
              avatar: profile.avatar
            });
            setTheme(profile.theme || 'telegram-blue');
            setWallpaper(profile.wallpaper || 'classic');
          }
        } else {
          setCurrentUser(null);
          setChats([]);
          setActiveChatId(null);
        }
        setAuthLoading(false);
      });

      return () => {
        subscription?.unsubscribe();
      };
    } else {
      // 2. Fallback mock auth
      const savedUser = localStorage.getItem('tg-user-mock');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setCurrentUser(parsed);
          setTheme(parsed.theme || 'telegram-blue');
          setWallpaper(parsed.wallpaper || 'classic');
        } catch (e) {
          console.warn(e);
        }
      }
      setAuthLoading(false);
    }
  }, []);

  // Fetch chats and subscribe to real-time updates when logged in
  const fetchChats = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser) return;

    try {
      // Fetch user's chats
      const { data: memberships, error: memberErr } = await supabase
        .from('chat_members')
        .select('chat_id, notifications, pinned')
        .eq('profile_id', currentUser.id);

      if (memberErr) throw memberErr;

      if (!memberships || memberships.length === 0) {
        setChats([]);
        return;
      }

      const chatIds = memberships.map(m => m.chat_id);

      // Fetch chat metadata
      const { data: chatList, error: chatErr } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds);

      if (chatErr) throw chatErr;

      const formattedChats = await Promise.all((chatList || []).map(async (chat) => {
        // Fetch chat members profile details
        const { data: membersRaw } = await supabase
          .from('chat_members')
          .select('profile_id, profiles(display_name, username, avatar, avatar_color, bio)')
          .eq('chat_id', chat.id);

        // Fetch messages for this chat
        const { data: messagesRaw } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: true });

        const membership = memberships.find(m => m.chat_id === chat.id);

        const formattedMembers = (membersRaw || []).map(m => ({
          id: m.profile_id,
          name: m.profiles?.display_name || m.profiles?.username || 'Пользователь',
          username: m.profiles?.username || '',
          avatar: m.profiles?.avatar || '👤',
          avatarColor: m.profiles?.avatar_color || '#ccc',
          bio: m.profiles?.bio || ''
        }));

        const otherMember = chat.type === 'personal'
          ? formattedMembers.find(m => m.id !== currentUser.id)
          : null;

        return {
          id: chat.id,
          name: otherMember ? otherMember.name : chat.name,
          type: chat.type,
          avatar: otherMember ? otherMember.avatar : chat.avatar,
          avatarColor: otherMember ? otherMember.avatarColor : chat.avatar_color,
          bio: otherMember ? otherMember.bio : chat.bio,
          username: otherMember ? otherMember.username : chat.username,
          createdBy: chat.created_by,
          pinned: membership?.pinned || false,
          notifications: membership?.notifications ?? true,
          members: formattedMembers,
          messages: (messagesRaw || []).map(m => ({
            id: m.id,
            senderId: m.sender_id,
            senderName: formattedMembers.find(member => member.id === m.sender_id)?.name || 'Пользователь',
            text: m.text,
            media: m.media,
            replyTo: m.reply_to,
            read: m.read,
            timestamp: new Date(m.created_at)
          }))
        };
      }));

      setChats(formattedChats);

      // Auto-set first chat as active if none set
      setActiveChatId(prev => prev || (formattedChats.length > 0 ? formattedChats[0].id : null));
    } catch (e) {
      console.error("Failed to fetch chats from Supabase:", e);
    }
  }, [currentUser]);

  // Fetch stories from Supabase
  const fetchStories = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser) return;
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*, profiles(display_name, username, avatar, avatar_color)')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map(s => ({
        id: s.id,
        userId: s.user_id,
        userName: s.profiles?.display_name || s.profiles?.username || 'Пользователь',
        userAvatar: s.profiles?.avatar || '🪙',
        media: s.media,
        caption: s.caption,
        viewed: false,
        timestamp: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      setStories(formatted);
    } catch (e) {
      console.error("Failed to fetch stories from Supabase:", e);
    }
  }, [currentUser]);

  // Publish a new story
  const publishStory = useCallback(async (media, caption) => {
    if (!currentUser) return null;
    if (isSupabaseConfigured) {
      try {
        const { data: newStory, error } = await supabase
          .from('stories')
          .insert({
            user_id: currentUser.id,
            media,
            caption
          })
          .select()
          .single();

        if (error) throw error;
        await fetchStories();
        return newStory;
      } catch (e) {
        console.error("Failed to publish story in Supabase:", e);
        alert(e.message);
        return null;
      }
    } else {
      const mockStory = {
        id: `story-mock-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || '🪙',
        media,
        caption,
        viewed: false,
        timestamp: 'Только что'
      };
      setStories(prev => [...prev, mockStory]);
      return mockStory;
    }
  }, [currentUser, fetchStories]);

  // Mark messages in a chat as read
  const markMessagesAsRead = useCallback(async (chatId) => {
    if (!currentUser || !chatId) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('messages')
          .update({ read: true })
          .eq('chat_id', chatId)
          .neq('sender_id', currentUser.id)
          .eq('read', false);

        if (error) throw error;
      } catch (e) {
        console.error("Failed to mark messages as read in Supabase:", e);
      }
    } else {
      // Mock mark as read
      setChats(prevChats => {
        let changed = false;
        const nextChats = prevChats.map(c => {
          if (c.id === chatId) {
            const updatedMessages = c.messages.map(m => {
              if (m.senderId !== currentUser.id && m.senderId !== 'current' && !m.read) {
                changed = true;
                return { ...m, read: true };
              }
              return m;
            });
            if (changed) {
              return { ...c, messages: updatedMessages };
            }
          }
          return c;
        });
        return changed ? nextChats : prevChats;
      });
    }
  }, [currentUser]);

  // Bot response simulator
  const simulateBotReply = useCallback((botId, userMsg) => {
    const botName = botId === 'chat-3' || botId === 'echo_bot' 
      ? 'Echo Bot' 
      : botId === 'chat-4' || botId === 'quiz_bot' 
        ? 'Quiz Master' 
        : 'Weather Bot';

    if (isSupabaseConfigured && currentUser) {
      supabase
        .from('messages')
        .update({ read: true })
        .eq('chat_id', botId)
        .eq('sender_id', currentUser.id)
        .eq('read', false)
        .then(({ error }) => {
          if (error) console.error("Error marking messages read by bot:", error);
        });
    }

    setChats(prev => prev.map(c => {
      if (c.id === botId) {
        // Mark user's sent messages as read immediately when bot starts "typing" (reading them)
        const updatedMessages = c.messages.map(m => {
          if ((m.senderId === currentUser?.id || m.senderId === 'current') && !m.read) {
            return { ...m, read: true };
          }
          return m;
        });
        return {
          ...c,
          lastSeen: 'печатает...',
          messages: updatedMessages
        };
      }
      return c;
    }));
    
    // Add to typing statuses
    setTypingStatuses(prev => ({
      ...prev,
      [botId]: { ...prev[botId], [botId]: botName }
    }));

    const delay = 1000 + Math.random() * 1500;

    setTimeout(async () => {
      // Remove from typing statuses
      setTypingStatuses(prev => {
        const next = { ...prev[botId] };
        delete next[botId];
        return { ...prev, [botId]: next };
      });
      let botResponse = '';
      
      if (botId === 'chat-3' || botId === 'echo_bot') {
        const funnyEndings = [
          '🗣️... И вообще, отлично сказано!',
          '📢 (повторено трижды в моей голове)',
          '— мудрость дня, не так ли? 🤔',
          '🔥 Абсолютно согласен с этим!',
          '⚡ Бум! Слово не воробей, поймали!'
        ];
        const randomEnding = funnyEndings[Math.floor(Math.random() * funnyEndings.length)];
        botResponse = `Ты сказал: "${userMsg}". \n\n${randomEnding}`;
      } 
      else if (botId === 'chat-4' || botId === 'quiz_bot') {
        const normalized = userMsg.toLowerCase();
        const quizInfo = quizStateRef.current;
        
        if (normalized === '/quiz') {
          quizInfo.active = true;
          quizInfo.currentQuestion = 0;
          quizInfo.score = 0;
          botResponse = `🎯 Игра началась!\n\nВопрос 1: ${quizQuestions[0].q}`;
        } else if (quizInfo.active) {
          const curIndex = quizInfo.currentQuestion;
          const correctAnswer = quizQuestions[curIndex].a;
          
          let feedback = '';
          if (normalized.includes(correctAnswer)) {
            quizInfo.score += 1;
            feedback = '✅ Верно! Отличная работа.';
          } else {
            feedback = `❌ Неправильно. Правильный ответ: ${correctAnswer}.`;
          }

          const nextIndex = curIndex + 1;
          if (nextIndex < quizQuestions.length) {
            quizInfo.currentQuestion = nextIndex;
            botResponse = `${feedback}\n\nВопрос ${nextIndex + 1}: ${quizQuestions[nextIndex].q}`;
          } else {
            botResponse = `${feedback}\n\n🏆 Викторина завершена! Ваш результат: ${quizInfo.score} из ${quizQuestions.length}. Напишите /quiz для повторной игры.`;
            quizInfo.active = false;
          }
        } else {
          botResponse = 'Я не совсем понял. Напишите /quiz, чтобы запустить интеллектуальную викторину! 🎯';
        }
      } 
      else if (botId === 'chat-5' || botId === 'weather_bot') {
        const cities = {
          'москва': 'В Москве сейчас ☀️ +23°C, без осадков. Легкий ветерок.',
          'лондон': 'В Лондоне 🌧️ +14°C, моросит дождь. Типичная погода.',
          'токио': 'В Токио 🌤️ +28°C, переменная облачность, высокая влажность.',
          'париж': 'В Париже ☀️ +21°C, ясно и тепло. Отличное время для прогулок.',
          'пекин': 'В Пекине 🌫️ +26°C, небольшой смог, без осадков.'
        };
        const cleanCity = userMsg.toLowerCase().trim();
        botResponse = cities[cleanCity] || `🌤️ В городе "${userMsg}" сейчас около +18°C, облачно с прояснениями. К сожалению, точных датчиков у меня там пока нет, но погода отличная!`;
      }

      if (isSupabaseConfigured) {
        // Send as Bot in Supabase (simulate from Bot user ID)
        try {
          await supabase
            .from('messages')
            .insert({
              chat_id: botId,
              sender_id: botId, // Bot profiles should have id equal to botId
              text: botResponse
            });
        } catch (e) {
          console.warn("Failed to write bot message to Supabase", e);
        }
      } else {
        const newBotMsg = {
          id: `m-bot-${Date.now()}`,
          senderId: 'bot',
          senderName: botId === 'chat-3' ? 'Echo Bot' : botId === 'chat-4' ? 'Quiz Master' : 'Weather Bot',
          text: botResponse,
          timestamp: new Date(),
          read: activeChatIdRef.current === botId
        };

        setChats(prev => prev.map(c => {
          if (c.id === botId) {
            const updatedMessages = c.messages.map(m => {
              if ((m.senderId === currentUser?.id || m.senderId === 'current') && !m.read) {
                return { ...m, read: true };
              }
              return m;
            });
            return {
              ...c,
              lastSeen: 'бот',
              messages: [...updatedMessages, newBotMsg]
            };
          }
          return c;
        }));

        playSound('incoming');
      }
    }, delay);
  }, [currentUser]);

  // Load Chats Effect
  useEffect(() => {
    if (isSupabaseConfigured) {
      if (currentUser) {
        fetchChats();
        fetchStories();

        // 1. Subscribe to messages insert, delete, update
        const msgChannel = supabase
          .channel('db-messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
            const newMsg = payload.new;
            
            // Only update if it belongs to one of our loaded chats
            setChats(prevChats => {
              const chatExists = prevChats.some(c => c.id === newMsg.chat_id);
              if (!chatExists) return prevChats;

              // Avoid duplicate messages
              const chat = prevChats.find(c => c.id === newMsg.chat_id);
              if (chat.messages.some(m => m.id === newMsg.id)) return prevChats;

              const isMe = newMsg.sender_id === currentUser.id;
              if (!isMe) {
                playSound('incoming');
                // If this message belongs to the currently active chat, mark it as read immediately
                if (newMsg.chat_id === activeChatIdRef.current) {
                  setTimeout(() => {
                    markMessagesAsRead(newMsg.chat_id);
                  }, 50);
                }
              }

              const senderName = chat.members.find(m => m.id === newMsg.sender_id)?.name || 'Пользователь';

              const formattedMsg = {
                id: newMsg.id,
                senderId: newMsg.sender_id,
                senderName,
                text: newMsg.text,
                media: newMsg.media,
                replyTo: newMsg.reply_to,
                read: newMsg.read,
                timestamp: new Date(newMsg.created_at)
              };

              // Check if we can replace an optimistic message
              let replacedOptimistic = false;
              const nextMessages = chat.messages.map(m => {
                if (isMe && m.isOptimistic && (m.text === newMsg.text || (m.media && m.media === newMsg.media)) && !replacedOptimistic) {
                  replacedOptimistic = true;
                  return formattedMsg;
                }
                return m;
              });

              return prevChats.map(c => {
                if (c.id === newMsg.chat_id) {
                  // Simulate Bot response trigger
                  if (c.type === 'bot' && isMe) {
                    simulateBotReply(c.id, newMsg.text);
                  }
                  return {
                    ...c,
                    messages: replacedOptimistic ? nextMessages : [...c.messages, formattedMsg]
                  };
                }
                return c;
              });
            });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
            const deletedMsgId = payload.old.id;
            setChats(prevChats => {
              return prevChats.map(c => ({
                ...c,
                messages: c.messages.filter(m => m.id !== deletedMsgId)
              }));
            });
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            const updatedMsg = payload.new;
            setChats(prevChats => {
              return prevChats.map(c => {
                if (c.id === updatedMsg.chat_id) {
                  return {
                    ...c,
                    messages: c.messages.map(m => m.id === updatedMsg.id ? {
                      ...m,
                      read: updatedMsg.read
                    } : m)
                  };
                }
                return c;
              });
            });
          })
          .subscribe();

        // 2. Subscribe to chat member invitations
        const memberChannel = supabase
          .channel('db-members')
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_members', 
            filter: `profile_id=eq.${currentUser.id}` 
          }, () => {
            fetchChats();
          })
          .subscribe();

        // 3. Presence indicator sync
        const presenceChannel = supabase.channel('online-users');
        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            const onlineIds = Object.keys(state);
            
            setChats(prev => prev.map(chat => {
              if (chat.type === 'personal') {
                const other = chat.members.find(m => m.id !== currentUser.id);
                if (other) {
                  const isOnline = onlineIds.includes(other.id);
                  return {
                    ...chat,
                    isOnline,
                    lastSeen: isOnline ? 'в сети' : 'был(а) недавно'
                  };
                }
              }
              return chat;
            }));
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                id: currentUser.id,
                online_at: new Date().toISOString()
              });
            }
          });

        // 4. Subscribe to typing broadcast status
        const typingChannel = supabase.channel('typing-status');
        typingChannelRef.current = typingChannel;

        typingChannel
          .on('broadcast', { event: 'typing' }, (payload) => {
            const { userId, chatId, isTyping, userName } = payload.payload;
            
            if (typingTimeoutsRef.current[userId]) {
              clearTimeout(typingTimeoutsRef.current[userId]);
              delete typingTimeoutsRef.current[userId];
            }

            if (isTyping) {
              setTypingStatuses(prev => {
                const chatStatuses = { ...prev[chatId], [userId]: userName };
                return { ...prev, [chatId]: chatStatuses };
              });

              // Safety auto-clear timeout (6s)
              typingTimeoutsRef.current[userId] = setTimeout(() => {
                setTypingStatuses(prev => {
                  const chatStatuses = { ...prev[chatId] };
                  delete chatStatuses[userId];
                  return { ...prev, [chatId]: chatStatuses };
                });
                delete typingTimeoutsRef.current[userId];
              }, 6000);
            } else {
              setTypingStatuses(prev => {
                const chatStatuses = { ...prev[chatId] };
                delete chatStatuses[userId];
                return { ...prev, [chatId]: chatStatuses };
              });
            }
          })
          .subscribe();

        // 5. Subscribe to stories
        const storiesChannel = supabase
          .channel('db-stories')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
            fetchStories();
          })
          .subscribe();

        return () => {
          msgChannel.unsubscribe();
          memberChannel.unsubscribe();
          presenceChannel.unsubscribe();
          typingChannel.unsubscribe();
          storiesChannel.unsubscribe();
          typingChannelRef.current = null;
        };
      }
    } else {
      // Load mock chats from LocalStorage or preseed
      if (currentUser) {
        const saved = localStorage.getItem('tg-chats-mock');
        if (saved) {
          try {
            const parsed = JSON.parse(saved).map(chat => ({
              ...chat,
              messages: chat.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
            }));
            setChats(parsed);
            setActiveChatId(prev => prev || (parsed.length > 0 ? parsed[0].id : null));
          } catch (e) {
            setChats(initialChatsMock);
            setActiveChatId(prev => prev || initialChatsMock[0].id);
          }
        } else {
          setChats(initialChatsMock);
          setActiveChatId(prev => prev || initialChatsMock[0].id);
        }
      }
    }
  }, [currentUser, fetchChats, markMessagesAsRead, simulateBotReply]);

  // Save Mock Chats state to localStorage
  useEffect(() => {
    if (!isSupabaseConfigured && currentUser && chats.length > 0) {
      localStorage.setItem('tg-chats-mock', JSON.stringify(chats));
    }
  }, [chats, currentUser]);

  const activeChat = chats.find(c => c.id === activeChatId);

  // Authentication Logic: Sign Up
  const signUpWithUsername = async (username, password, displayName) => {
    if (isSupabaseConfigured) {
      const email = `${username}@tg-clone.com`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            display_name: displayName
          }
        }
      });
      if (error) return { error };

      // Double check if profile exists, if not trigger handle_new_user should have created it.
      return { data };
    } else {
      // Mock signup
      const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      if (mockUsers.some(u => u.username === username)) {
        return { error: new Error('Данное имя пользователя уже занято!') };
      }

      const newUser = {
        id: `user-mock-${Date.now()}`,
        username,
        name: displayName,
        avatarColor: 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
        bio: '',
        theme: 'telegram-blue',
        wallpaper: 'classic',
        avatar: '🪙'
      };

      mockUsers.push({ ...newUser, password });
      localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
      return { data: newUser };
    }
  };

  // Authentication Logic: Sign In
  const signInWithUsername = async (username, password) => {
    if (isSupabaseConfigured) {
      const email = `${username}@tg-clone.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) return { error };
      return { data };
    } else {
      // Mock Sign In
      const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      const user = mockUsers.find(u => u.username === username && u.password === password);
      
      if (!user) {
        return { error: new Error('Неправильный логин или пароль') };
      }

      const { password: _, ...cleanUser } = user;
      setCurrentUser(cleanUser);
      localStorage.setItem('tg-user-mock', JSON.stringify(cleanUser));
      return { data: cleanUser };
    }
  };

  // Sign Out
  const logOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      setCurrentUser(null);
      localStorage.removeItem('tg-user-mock');
    }
    setActiveChatId(null);
    setChats([]);
  };

  // Profile Customization Update
  const updateProfile = async (fields) => {
    if (!currentUser) return;

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: fields.name || currentUser.name,
          bio: fields.bio !== undefined ? fields.bio : currentUser.bio,
          avatar_color: fields.avatarColor || currentUser.avatarColor,
          theme: fields.theme || theme,
          wallpaper: fields.wallpaper || wallpaper,
          avatar: fields.avatar !== undefined ? fields.avatar : currentUser.avatar
        })
        .eq('id', currentUser.id);

      if (error) {
        console.error("Failed to update profile in database", error);
        return;
      }
    }

    // Update locally
    const updatedUser = { ...currentUser, ...fields };
    setCurrentUser(updatedUser);

    if (fields.theme) setTheme(fields.theme);
    if (fields.wallpaper) setWallpaper(fields.wallpaper);

    if (!isSupabaseConfigured) {
      localStorage.setItem('tg-user-mock', JSON.stringify(updatedUser));
      // Save in mock list as well
      const mockUsers = JSON.parse(localStorage.getItem('tg-mock-users') || '[]');
      const index = mockUsers.findIndex(u => u.username === currentUser.username);
      if (index !== -1) {
        mockUsers[index] = { ...mockUsers[index], ...fields };
        localStorage.setItem('tg-mock-users', JSON.stringify(mockUsers));
      }
    }
  };

  // Create Chat/Start dialog
  const createChat = useCallback(async (target, typeOrIsGroup = 'personal') => {
    if (!currentUser) return null;

    let type = 'personal';
    if (typeof typeOrIsGroup === 'boolean') {
      type = typeOrIsGroup ? 'group' : 'personal';
    } else {
      type = typeOrIsGroup;
    }

    if (isSupabaseConfigured) {
      try {
        if (type === 'personal') {
          const cleanTarget = target.trim().toLowerCase();
          
          // 1. Search for profile
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', cleanTarget)
            .single();

          if (error || !profile) {
            throw new Error(`Пользователь с никнеймом "${target}" не найден.`);
          }

          if (profile.id === currentUser.id) {
            throw new Error("Вы не можете создать чат с самим собой.");
          }

          // 2. Check if chat already exists
          const existing = chats.find(c => c.type === 'personal' && c.members.some(m => m.id === profile.id));
          if (existing) {
            setActiveChatId(existing.id);
            return existing;
          }

          // 3. Create chat entry
          const { data: newChat, error: chatErr } = await supabase
            .from('chats')
            .insert({
              name: profile.display_name || profile.username,
              type: 'personal',
              avatar: profile.avatar || '👤',
              avatar_color: profile.avatar_color,
              created_by: currentUser.id
            })
            .select()
            .single();

          if (chatErr) throw chatErr;

          // 4. Add members
          const { error: membersErr } = await supabase
            .from('chat_members')
            .insert([
              { chat_id: newChat.id, profile_id: currentUser.id },
              { chat_id: newChat.id, profile_id: profile.id }
            ]);

          if (membersErr) throw membersErr;

          await fetchChats();
          setActiveChatId(newChat.id);
          return newChat;
        } else {
          // Group or Channel Chat
          const { data: newChat, error: chatErr } = await supabase
            .from('chats')
            .insert({
              name: target,
              type: type,
              avatar: type === 'channel' ? '📢' : '👥',
              avatar_color: type === 'channel' ? 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' : 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
              created_by: currentUser.id
            })
            .select()
            .single();

          if (chatErr) throw chatErr;

          // Add creator as member
          const { error: memberErr } = await supabase
            .from('chat_members')
            .insert({ chat_id: newChat.id, profile_id: currentUser.id });

          if (memberErr) throw memberErr;

          await fetchChats();
          setActiveChatId(newChat.id);
          return newChat;
        }
      } catch (e) {
        alert(e.message);
        return null;
      }
    } else {
      // Mock Create Chat
      if (type === 'personal') {
        const name = target;
        const newChat = {
          id: `chat-mock-${Date.now()}`,
          name: `${name}`,
          type: 'personal',
          avatar: '👤',
          avatarColor: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
          pinned: false,
          notifications: true,
          bio: 'Новый контакт в Mock-режиме',
          username: target.toLowerCase(),
          members: [
            { id: 'current', name: currentUser.name, avatar: '🪙' },
            { id: `mock-${Date.now()}`, name, avatar: '👤' }
          ],
          messages: []
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
      } else {
        const newChat = {
          id: `chat-mock-${Date.now()}`,
          name: target,
          type: type,
          avatar: type === 'channel' ? '📢' : '👥',
          avatarColor: type === 'channel' ? 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' : 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
          pinned: false,
          notifications: true,
          bio: type === 'channel' ? 'Новый канал' : 'Новая группа',
          createdBy: currentUser.id,
          members: [
            { id: 'current', name: currentUser.name, avatar: '🪙' }
          ],
          messages: []
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
      }
    }
  }, [currentUser, chats, fetchChats]);

  // Send Message
  const sendMessage = useCallback(async (text, replyToId = null, media = null) => {
    if (!text.trim() && !media) return;
    if (!currentUser || !activeChatId) return;

    if (isSupabaseConfigured) {
      // 1. Create optimistic message
      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.name || 'Вы',
        text: text,
        media: media,
        replyTo: replyToId,
        read: false,
        timestamp: new Date(),
        isOptimistic: true
      };

      // 2. Add to local state immediately
      setChats(prevChats => prevChats.map(c => {
        if (c.id === activeChatId) {
          return {
            ...c,
            messages: [...c.messages, optimisticMsg]
          };
        }
        return c;
      }));

      playSound('outgoing');

      // 3. Send in background
      supabase
        .from('messages')
        .insert({
          chat_id: activeChatId,
          sender_id: currentUser.id,
          text: text,
          media: media,
          reply_to: replyToId
        })
        .then(({ error }) => {
          if (error) {
            console.error("Message send failed:", error);
            // Remove optimistic message on error
            setChats(prevChats => prevChats.map(c => {
              if (c.id === activeChatId) {
                return {
                  ...c,
                  messages: c.messages.filter(m => m.id !== optimisticMsg.id)
                };
              }
              return c;
            }));
            alert("Не удалось отправить сообщение: " + error.message);
          }
        });
    } else {
      // Mock Send message logic
      const newMessage = {
        id: `m-user-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: text,
        timestamp: new Date(),
        replyTo: replyToId,
        media: media,
        read: false
      };

      setChats(prevChats => {
        return prevChats.map(c => {
          if (c.id === activeChatId) {
            return {
              ...c,
              messages: [...c.messages, newMessage]
            };
          }
          return c;
        });
      });

      playSound('outgoing');

      if (activeChat?.type === 'bot') {
        simulateBotReply(activeChat.id, text.trim());
      } else if (activeChat?.type === 'personal' || activeChat?.type === 'group') {
        // Simulate recipient reading after 2 seconds in Mock Mode
        const chatToUpdate = activeChat.id;
        setTimeout(() => {
          setChats(prevChats => {
            return prevChats.map(c => {
              if (c.id === chatToUpdate) {
                return {
                  ...c,
                  messages: c.messages.map(m => {
                    if ((m.senderId === currentUser?.id || m.senderId === 'current') && !m.read) {
                      return { ...m, read: true };
                    }
                    return m;
                  })
                };
              }
              return c;
            });
          });
        }, 2000);
      }
    }
  }, [activeChatId, currentUser, activeChat, simulateBotReply]);

  // Delete message
  const deleteMessage = useCallback(async (chatId, messageId) => {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error("Failed to delete message", error);
        return;
      }
    }

    setChats(prevChats => {
      return prevChats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: c.messages.filter(m => m.id !== messageId)
          };
        }
        return c;
      });
    });
  }, []);

  const activeChatMessagesLength = activeChat?.messages?.length || 0;

  // Auto mark messages as read on active chat change or when messages are received
  useEffect(() => {
    if (activeChatId) {
      markMessagesAsRead(activeChatId);
    }
  }, [activeChatId, activeChatMessagesLength, markMessagesAsRead]);

  // Add reaction to a message
  const toggleReaction = useCallback((chatId, messageId, emoji) => {
    setChats(prevChats => {
      return prevChats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: c.messages.map(m => {
              if (m.id === messageId) {
                const reactions = m.reactions ? [...m.reactions] : [];
                const exist = reactions.find(r => r.emoji === emoji);
                if (exist) {
                  if (exist.users.includes('current')) {
                    exist.users = exist.users.filter(u => u !== 'current');
                    exist.count -= 1;
                  } else {
                    exist.users.push('current');
                    exist.count += 1;
                  }
                } else {
                  reactions.push({ emoji, count: 1, users: ['current'] });
                }
                return {
                  ...m,
                  reactions: reactions.filter(r => r.count > 0)
                };
              }
              return m;
            })
          };
        }
        return c;
      });
    });
  }, []);

  // Broadcast typing status function
  const sendTypingStatus = useCallback((chatId, isTyping) => {
    if (!currentUser) return;
    if (isSupabaseConfigured && typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: currentUser.id,
          chatId,
          isTyping,
          userName: currentUser.name || currentUser.username
        }
      });
    }
  }, [currentUser]);

  // Group Simulator: simulated conversations from Bob, Alice, Charlie in Dev Group (Mock Mode only)
  useEffect(() => {
    if (isSupabaseConfigured) return;

    const dialogs = [
      { senderId: 'bob', senderName: 'Bob Dev', text: 'Ребята, я только что добавил поддержку свайпов для истории! Зацените на мобилках.' },
      { senderId: 'alice', senderName: 'Алиса', text: 'Круто, Боб! Выглядит потрясающе. Сергей, а у тебя получается настроить стилизацию чатов?' },
      { senderId: 'charlie', senderName: 'Charlie QA', text: 'Пока тестирую отправку эмодзи. Всё работает просто летающе!' },
      { senderId: 'bob', senderName: 'Bob Dev', text: 'Кто-нибудь пробовал спросить Quiz Master бота? Он реально сложный 🧠' },
      { senderId: 'charlie', senderName: 'Charlie QA', text: 'Я набрал 5 из 5. Легкотня) 😎' }
    ];

    let timer;
    const scheduleNextSimulatedMessage = () => {
      const timeToWait = 25000 + Math.random() * 20000; // 25s - 45s
      timer = setTimeout(() => {
        const randomMsg = dialogs[Math.floor(Math.random() * dialogs.length)];
        const newMsgObj = {
          id: `m-sim-${Date.now()}`,
          senderId: randomMsg.senderId,
          senderName: randomMsg.senderName,
          text: randomMsg.text,
          timestamp: new Date(),
          read: activeChatIdRef.current === 'chat-2'
        };

        setChats(prev => prev.map(c => {
          if (c.id === 'chat-2') { // Dev Group
            const shouldAlert = activeChatId !== 'chat-2';
            if (shouldAlert) {
              playSound('incoming');
            }
            return {
              ...c,
              messages: [...c.messages, newMsgObj]
            };
          }
          return c;
        }));

        scheduleNextSimulatedMessage();
      }, timeToWait);
    };

    scheduleNextSimulatedMessage();

    return () => clearTimeout(timer);
  }, [activeChatId]);

  // Channel Simulator: periodical tech channel post (Mock Mode only)
  useEffect(() => {
    if (isSupabaseConfigured) return;

    const posts = [
      '🚀 Важное обновление: Вышел Vite 6! Скорость сборки увеличилась еще на 25%, а потребление памяти снизилось.',
      '🌐 Стандарт CSS Nesting теперь официально поддерживается во всех современных браузерах на 100%. Больше не нужны препроцессоры!',
      '🔐 CoinGram обновил политику безопасности: добавлена сквозная авторизация по биометрии на веб-клиентах.',
      '🎨 Тренд веб-дизайна 2026: интерактивная нео-морфическая глубина и кастомные HSL-палитры с полной поддержкой темного режима.'
    ];

    const timer = setInterval(() => {
      const randomPost = posts[Math.floor(Math.random() * posts.length)];
      const newPostObj = {
        id: `m-post-${Date.now()}`,
        senderId: 'channel',
        senderName: 'Tech Waves',
        text: randomPost,
        timestamp: new Date(),
        read: activeChatIdRef.current === 'chat-6'
      };

      setChats(prev => prev.map(c => {
        if (c.id === 'chat-6') { // Tech Waves
          const shouldAlert = activeChatId !== 'chat-6';
          if (shouldAlert) {
            playSound('incoming');
          }
          return {
            ...c,
            messages: [...c.messages, newPostObj]
          };
        }
        return c;
      }));
    }, 60000); // every 60s

    return () => clearInterval(timer);
  }, [activeChatId]);

  // Handle invite links (?invite=username)
  useEffect(() => {
    if (!currentUser) {
      // If not logged in, but there is an invite param, save it for later
      const params = new URLSearchParams(window.location.search);
      const inviteParam = params.get('invite');
      if (inviteParam) {
        sessionStorage.setItem('pending_invite_username', inviteParam.trim().toLowerCase());
        // Clean URL to not clutter it
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
      }
      return;
    }

    // If logged in, check both URL param and sessionStorage
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    const pendingInvite = sessionStorage.getItem('pending_invite_username');
    const targetUsername = (inviteParam || pendingInvite || '').trim().toLowerCase();

    if (targetUsername) {
      // Clear pending state and URL parameters
      sessionStorage.removeItem('pending_invite_username');
      if (inviteParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
      }

      if (targetUsername === currentUser.username.toLowerCase()) {
        console.log("Cannot invite self");
        return;
      }

      // Small delay to ensure chats are loaded and layout is ready
      const timer = setTimeout(async () => {
        try {
          await createChat(targetUsername, false);
        } catch (e) {
          console.error("Failed to process invite link:", e);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentUser, createChat]);

  // Watch stories viewing state
  const viewStory = (storyId) => {
    setStories(prev => prev.map(s => s.id === storyId ? { ...s, viewed: true } : s));
    setActiveStoryId(storyId);
  };

  // Delete or leave a chat
  const deleteChat = useCallback(async (chatId) => {
    if (!currentUser || !chatId) return false;
    
    const chatToDelete = chats.find(c => c.id === chatId);
    if (!chatToDelete) return false;

    if (isSupabaseConfigured) {
      try {
        const isCreator = chatToDelete.createdBy === currentUser.id;
        const isPersonal = chatToDelete.type === 'personal';

        if (isPersonal || isCreator) {
          // Delete the entire chat
          const { error } = await supabase
            .from('chats')
            .delete()
            .eq('id', chatId);
          if (error) throw error;
        } else {
          // Leave the group/channel
          const { error } = await supabase
            .from('chat_members')
            .delete()
            .eq('chat_id', chatId)
            .eq('profile_id', currentUser.id);
          if (error) throw error;
        }
        
        // Update local states
        setChats(prev => prev.filter(c => c.id !== chatId));
        if (activeChatId === chatId) {
          setActiveChatId(null);
        }
        return true;
      } catch (e) {
        console.error("Failed to delete/leave chat in Supabase:", e);
        alert("Не удалось удалить чат: " + e.message);
        return false;
      }
    } else {
      // Mock mode
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
      return true;
    }
  }, [currentUser, chats, activeChatId, setActiveChatId]);

  const clearChatMessages = useCallback(async (chatId) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('chat_id', chatId);

        if (error) throw error;
      } catch (e) {
        console.error("Failed to clear chat messages in Supabase:", e);
        alert("Не удалось очистить историю: " + e.message);
        return false;
      }
    }

    setChats(prevChats => {
      return prevChats.map(c => {
        if (c.id === chatId) {
          return {
            ...c,
            messages: []
          };
        }
        return c;
      });
    });
    return true;
  }, []);

  return (
    <ChatContext.Provider value={{
      currentUser,
      setCurrentUser,
      authLoading,
      signUpWithUsername,
      signInWithUsername,
      logOut,
      createChat,
      chats,
      activeChatId,
      setActiveChatId,
      activeChat,
      sendMessage,
      deleteMessage,
      toggleReaction,
      stories,
      activeStoryId,
      setActiveStoryId,
      viewStory,
      publishStory,
      searchQuery,
      setSearchQuery,
      activeFolder,
      setActiveFolder,
      isSettingsOpen,
      setIsSettingsOpen,
      isInfoOpen,
      setIsInfoOpen,
      isNewChatOpen,
      setIsNewChatOpen,
      isCreateStoryOpen,
      setIsCreateStoryOpen,
      isDrawerOpen,
      setIsDrawerOpen,
      isDarkMode,
      setIsDarkMode,
      settingsTab,
      setSettingsTab,
      newChatModalTab,
      setNewChatModalTab,
      renderAvatar,
      theme,
      setTheme,
      wallpaper,
      setWallpaper,
      updateProfile,
      typingStatuses,
      sendTypingStatus,
      markMessagesAsRead,
      deleteChat,
      clearChatMessages
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
