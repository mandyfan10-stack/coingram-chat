/**
 * Comprehensive Telegram-grade Unicode Emoji Catalog & Categories with Multilingual Search
 */

export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Смайлы и эмоции',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎',
      '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
      '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
      '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
      '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾'
    ]
  },
  {
    id: 'people',
    name: 'Жесты и люди',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
      '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶',
      '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️',
      '👅', '👄', '💋', '🩸', '👶', '👧', '🧒', '👦', '👩', '🧑',
      '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰', '👨‍🦰', '👱‍♀️', '👱‍♂️', '👩‍🦳', '👨‍🦳', '👩‍🦲',
      '👨‍🦲', '🧔', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳‍♂️', '🧕', '👮‍♀️',
      '👮‍♂️', '👷‍♀️', '👷‍♂️', '💂‍♀️', '💂‍♂️', '🕵️‍♀️', '🕵️‍♂️', '👩‍⚕️', '👨‍⚕️', '👩‍🌾'
    ]
  },
  {
    id: 'animals',
    name: 'Животные и природа',
    icon: '🐻',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
      '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙',
      '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈',
      '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏',
      '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖',
      '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐈‍⬛',
      '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨'
    ]
  },
  {
    id: 'food',
    name: 'Еда и напитки',
    icon: '🍔',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
      '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅',
      '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
      '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟',
      '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘',
      '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪',
      '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
      '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫',
      '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🫖',
      '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃'
    ]
  },
  {
    id: 'activities',
    name: 'Активности и спорт',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺',
      '⛹️', '🤾', '🧗', '🧘', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️',
      '🎫', '🎟️', '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼',
      '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯',
      '🎳', '🎮', '🎰', '🧩'
    ]
  },
  {
    id: 'travel',
    name: 'Путешествия и места',
    icon: '🚀',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🦯', '🛴', '🚲', '🛵', '🏍️', '🛺',
      '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋',
      '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉',
      '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶',
      '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦',
      '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡',
      '🎢', '🎠', '⛲', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🏕️',
      '⛺', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪'
    ]
  },
  {
    id: 'objects',
    name: 'Предметы',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🏮', '🪔', '🧱', '🪵', '🕯️', '💻', '🖥️', '🖨️',
      '⌨️', '🖱️', '🖲️', '💽', '💾', '💿', '📀', '📷', '📸', '📹',
      '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️',
      '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡',
      '🔋', '🪫', '🔌', '💵', '💴', '💶', '💷', '🪙', '💰', '💳',
      '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️',
      '🪚', '🔩', '⚙️', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪',
      '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🔮', '🧿', '💈',
      '🔭', '🔬', '🩹', '🩺', '💊', '💉', '🧬', '🧪', '🌡️', '🧹',
      '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🧼', '🪥', '🧽', '🧴',
      '🗝️', '🔑', '🔐', '🔏', '🔒', '🔓', '📦', '📫', '📪', '📬',
      '📮', '✉️', '📧', '📨', '📩', '📤', '📥', '🏷️', '📜', '📄'
    ]
  },
  {
    id: 'symbols',
    name: 'Символы и флаги',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '🆔', '☢️', '☣️', '📴', '📳', '✴️', '🆚', '💮', '🉐', '㊙️',
      '㊗️', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑',
      '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱',
      '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅',
      '🔆', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '❇️', '✳️',
      '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️',
      '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼',
      '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠',
      '🔢', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣',
      '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🇷🇺', '🇺🇸', '🇬🇧', '🇩🇪', '🇫🇷',
      '🇮🇹', '🇪🇸', '🇨🇳', '🇯🇵', '🇰🇷', '🇧🇾', '🇰🇿', '🇺🇦', '🇹🇷', '🇦🇪'
    ]
  }
];

// Multilingual search keywords map
export const EMOJI_KEYWORDS = {
  'огонь': ['🔥'],
  'fire': ['🔥'],
  'сердце': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💖', '💗', '💓', '💞', '💕', '❣️'],
  'heart': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💖', '💗', '💓', '💞', '💕', '❣️'],
  'любовь': ['❤️', '😍', '🥰', '😘', '💕', '💖', '💘'],
  'love': ['❤️', '😍', '🥰', '😘', '💕', '💖', '💘'],
  'лайк': ['👍', '👌', '❤️'],
  'like': ['👍', '👌', '❤️'],
  'дизлайк': ['👎'],
  'dislike': ['👎'],
  'смех': ['😂', '🤣', '😆', '😄', '😃'],
  'lol': ['😂', '🤣', '😆', '😄', '😃'],
  'laugh': ['😂', '🤣', '😆', '😄', '😃'],
  'улыбка': ['🙂', '😊', '😀', '😃', '😄', '😁'],
  'smile': ['🙂', '😊', '😀', '😃', '😄', '😁'],
  'грусть': ['😢', '😭', '😞', '😔', '🙁', '🥺'],
  'sad': ['😢', '😭', '😞', '😔', '🙁', '🥺'],
  'слезы': ['😢', '😭', '😿'],
  'cry': ['😢', '😭', '😿'],
  'кот': ['🐱', '🐈', '🐈‍⬛', '😹', '😻', '😼', '😽'],
  'cat': ['🐱', '🐈', '🐈‍⬛', '😹', '😻', '😼', '😽'],
  'собака': ['🐶', '🐕', '🐩', '🦮', '🐕‍🦺'],
  'dog': ['🐶', '🐕', '🐩', '🦮', '🐕‍🦺'],
  'деньги': ['💰', '💵', '💸', '🤑', '🪙', '💳'],
  'money': ['💰', '💵', '💸', '🤑', '🪙', '💳'],
  'ракета': ['🚀'],
  'rocket': ['🚀'],
  '100': ['💯'],
  'ок': ['👌', '👍', '🆗'],
  'ok': ['👌', '👍', '🆗'],
  'сон': ['😴', '🥱', '💤', '😪'],
  'sleep': ['😴', '🥱', '💤', '😪'],
  'звезда': ['⭐', '🌟', '✨', '💫', '🤩'],
  'star': ['⭐', '🌟', '✨', '💫', '🤩'],
  'праздник': ['🎉', '🥳', '🎊', '🎈', '🎂', '🍾'],
  'party': ['🎉', '🥳', '🎊', '🎈', '🎂', '🍾'],
  'еда': ['🍔', '🍕', '🍟', '🌭', '🥪', '🌮', '🍣', '🍝'],
  'food': ['🍔', '🍕', '🍟', '🌭', '🥪', '🌮', '🍣', '🍝'],
  'кофе': ['☕', '🧋'],
  'coffee': ['☕', '🧋'],
  'пиво': ['🍺', '🍻'],
  'beer': ['🍺', '🍻'],
  'вино': ['🍷', '🍾', '🥂', '🍸', '🍹'],
  'wine': ['🍷', '🍾', '🥂', '🍸', '🍹'],
  'привет': ['👋', '🙋‍♂️', '🙋‍♀️'],
  'hello': ['👋', '🙋‍♂️', '🙋‍♀️'],
  'пока': ['👋'],
  'bye': ['👋'],
  'аплодисменты': ['👏', '🙌'],
  'clap': ['👏', '🙌'],
  'шок': ['😱', '🤯', '😲', '😳'],
  'shock': ['😱', '🤯', '😲', '😳'],
  'думаю': ['🤔', '🧐'],
  'think': ['🤔', '🧐'],
  'круто': ['😎', '🤙', '🔥', '💯'],
  'cool': ['😎', '🤙', '🔥', '💯']
};

/**
 * Filter all emojis by search query
 */
export function searchEmojis(query) {
  if (!query || !query.trim()) return [];
  const clean = query.trim().toLowerCase();

  const results = new Set();

  // 1. Direct match with keyword dictionary
  for (const [key, list] of Object.entries(EMOJI_KEYWORDS)) {
    if (key.includes(clean) || clean.includes(key)) {
      list.forEach((emo) => results.add(emo));
    }
  }

  // 2. Direct character match (if user typed emoji itself)
  for (const cat of EMOJI_CATEGORIES) {
    for (const emo of cat.emojis) {
      if (emo.includes(clean)) {
        results.add(emo);
      }
    }
  }

  return Array.from(results);
}

/**
 * Trending & Categorized Curated GIFs with Comprehensive Multilingual Search Tags
 */
export const TRENDING_GIFS = [
  // --- TRENDING & POPULAR ---
  { id: 'g1', category: 'trending', title: 'Thumbs Up 👍', tags: ['лайк', 'like', 'thumbs up', 'класс', 'супер', 'ok', 'ок', 'добро', 'yes', 'да', 'good', 'agree', 'топ'], url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', preview: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: 'g2', category: 'trending', title: 'Cat Vibe 🐱', tags: ['кот', 'котик', 'кошка', 'cat', 'vibe', 'качает', 'музыка', 'music', 'dance', 'танец', 'животные', 'cute'], url: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif', preview: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif' },
  { id: 'g3', category: 'trending', title: 'Applause 👏', tags: ['аплодисменты', 'хлопает', 'clap', 'applause', 'браво', 'молодец', 'bravo', 'congrats', 'ура', 'cheers'], url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif', preview: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif' },
  { id: 'g4', category: 'trending', title: 'Mind Blown 🤯', tags: ['шок', 'взрыв мозга', 'mind blown', 'shock', 'ого', 'вау', 'crazy', 'omg', 'омг', 'wow'], url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', preview: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: 'g5', category: 'trending', title: 'Popcorn 🍿', tags: ['попкорн', 'popcorn', 'кино', 'наблюдаю', 'watching', 'драма', 'drama', 'жду', 'фильм', 'movie'], url: 'https://media.giphy.com/media/t3dLl0TGHCxTG/giphy.gif', preview: 'https://media.giphy.com/media/t3dLl0TGHCxTG/giphy.gif' },
  { id: 'g6', category: 'trending', title: 'Fire 🔥', tags: ['огонь', 'fire', 'hot', 'жара', 'пушка', 'топ', 'lit', 'круто'], url: 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif', preview: 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif' },
  { id: 'g7', category: 'trending', title: 'Pepe Cheers 🥂', tags: ['пепе', 'pepe', 'cheers', 'тост', 'праздник', 'мем', 'meme', 'ура'], url: 'https://media.giphy.com/media/BPJmthQ3YRwD6QqcVD/giphy.gif', preview: 'https://media.giphy.com/media/BPJmthQ3YRwD6QqcVD/giphy.gif' },
  { id: 'g8', category: 'trending', title: 'Pedro Raccoon 🦝', tags: ['педро', 'енот', 'pedro', 'raccoon', 'танцует', 'dance', 'мем', 'meme', 'кружится'], url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', preview: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif' },
  { id: 'g9', category: 'trending', title: 'Money Rain 💰', tags: ['деньги', 'money', 'cash', 'богатство', 'rich', 'монеты', 'доллары', 'крипта', 'crypto'], url: 'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif', preview: 'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif' },
  { id: 'g10', category: 'trending', title: 'Cool Shades 😎', tags: ['крутой', 'cool', 'очки', 'deal with it', 'стиль', 'boss', 'босс'], url: 'https://media.giphy.com/media/yA5Y3B4Ip13Xy/giphy.gif', preview: 'https://media.giphy.com/media/yA5Y3B4Ip13Xy/giphy.gif' },

  // --- REACTIONS ---
  { id: 'g11', category: 'reactions', title: 'Laughing 😂', tags: ['смех', 'ржу', 'lol', 'laugh', 'haha', 'хаха', 'ору', 'смешно', 'rofl', 'мем', 'funny', 'reactions'], url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif', preview: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' },
  { id: 'g12', category: 'reactions', title: 'Facepalm 🤦', tags: ['рукалицо', 'facepalm', 'кринж', 'стыд', 'fail', 'фейл', 'мда', 'cringe', 'боже', 'reactions'], url: 'https://media.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif', preview: 'https://media.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif' },
  { id: 'g13', category: 'reactions', title: 'Shocked 😱', tags: ['шок', 'испуг', 'shocked', 'scared', 'страх', 'ужас', 'омг', 'omg', 'what', 'что', 'reactions'], url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', preview: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' },
  { id: 'g14', category: 'reactions', title: 'Thinking 🤔', tags: ['думаю', 'thinking', 'мысли', 'хм', 'hmm', 'вопрос', 'idea', 'идея', 'reactions'], url: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif', preview: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif' },
  { id: 'g15', category: 'reactions', title: 'Bye Wave 👋', tags: ['пока', 'привет', 'bye', 'hello', 'wave', 'до свидания', 'увидимся', 'hi', 'хай', 'ку', 'reactions'], url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', preview: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif' },
  { id: 'g16', category: 'reactions', title: 'Confused Travolta 🤷', tags: ['траволта', 'не понял', 'где все', 'confused', 'travolta', 'где', 'what', 'wtf', 'reactions'], url: 'https://media.giphy.com/media/g01ZnwEHvCUOXEPKNL/giphy.gif', preview: 'https://media.giphy.com/media/g01ZnwEHvCUOXEPKNL/giphy.gif' },
  { id: 'g17', category: 'reactions', title: 'Yes Nod 👍', tags: ['да', 'согласен', 'yes', 'nod', 'agree', 'точно', 'верно', 'конечно', 'reactions'], url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
  { id: 'g18', category: 'reactions', title: 'No Shake 🙅', tags: ['нет', 'нельзя', 'no', 'shake', 'never', 'ни за что', 'отказ', 'nope', 'reactions'], url: 'https://media.giphy.com/media/6gLyE15StDmSc/giphy.gif', preview: 'https://media.giphy.com/media/6gLyE15StDmSc/giphy.gif' },
  { id: 'g19', category: 'reactions', title: 'Eye Roll 🙄', tags: ['закатил глаза', 'eyeroll', 'eye roll', 'скучно', 'ну да', 'хватит', 'reactions'], url: 'https://media.giphy.com/media/Rhhr8D5mKSXL9cXriV/giphy.gif', preview: 'https://media.giphy.com/media/Rhhr8D5mKSXL9cXriV/giphy.gif' },
  { id: 'g20', category: 'reactions', title: 'Shrug 🤷', tags: ['пожимаю плечами', 'хз', 'shrug', 'не знаю', 'idk', 'без понятия', 'reactions'], url: 'https://media.giphy.com/media/eLvhchyvNUPuU/giphy.gif', preview: 'https://media.giphy.com/media/eLvhchyvNUPuU/giphy.gif' },

  // --- MEMES ---
  { id: 'g21', category: 'memes', title: 'This Is Fine 🔥🐶', tags: ['в огне', 'this is fine', 'мем', 'meme', 'собака в огне', 'нормально', 'держимся', 'doge'], url: 'https://media.giphy.com/media/9M5jK4GXmD5o1irGrF/giphy.gif', preview: 'https://media.giphy.com/media/9M5jK4GXmD5o1irGrF/giphy.gif' },
  { id: 'g22', category: 'memes', title: 'Gigachad 💪', tags: ['гигачад', 'gigachad', 'база', 'сигма', 'sigma', 'chad', 'красавчик', 'мем', 'meme'], url: 'https://media.giphy.com/media/CAYVZA5NRb529kKQUc/giphy.gif', preview: 'https://media.giphy.com/media/CAYVZA5NRb529kKQUc/giphy.gif' },
  { id: 'g23', category: 'memes', title: 'Leonardo Cheers 🍷', tags: ['леонардо', 'дикаприо', 'бокал', 'cheers', 'тост', 'leonardo', 'dicaprio', 'мем', 'meme'], url: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/giphy.gif', preview: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/giphy.gif' },
  { id: 'g24', category: 'memes', title: 'Homer Bush 🌳', tags: ['гомер', 'кусты', 'ушел', 'homer', 'simpsons', 'bush', 'исчез', 'скрылся', 'мем', 'meme'], url: 'https://media.giphy.com/media/jUwpNzg9IcyrK/giphy.gif', preview: 'https://media.giphy.com/media/jUwpNzg9IcyrK/giphy.gif' },
  { id: 'g25', category: 'memes', title: 'Pikachu Shock ⚡', tags: ['пикачу', 'шок', 'pikachu', 'pokemon', 'покемон', 'surprised', 'удивление', 'мем', 'meme'], url: 'https://media.giphy.com/media/6nWhy3ulBL7GSCvKw6/giphy.gif', preview: 'https://media.giphy.com/media/6nWhy3ulBL7GSCvKw6/giphy.gif' },
  { id: 'g26', category: 'memes', title: 'Doge Wow 🐕', tags: ['доге', 'собака', 'doge', 'shiba', 'сиба', 'вау', 'wow', 'крипта', 'мем', 'meme'], url: 'https://media.giphy.com/media/oBQZIgNobc7EWQDNg0/giphy.gif', preview: 'https://media.giphy.com/media/oBQZIgNobc7EWQDNg0/giphy.gif' },
  { id: 'g27', category: 'memes', title: 'Drake Yes/No 🕺', tags: ['дрейк', 'drake', 'yes', 'no', 'выбор', 'мем', 'meme', 'одобрение'], url: 'https://media.giphy.com/media/fXnRObM8Q0RkOmR5nf/giphy.gif', preview: 'https://media.giphy.com/media/fXnRObM8Q0RkOmR5nf/giphy.gif' },
  { id: 'g28', category: 'memes', title: 'SpongeBob Mocking 🧽', tags: ['губка боб', 'spongebob', 'mocking', 'передразнивает', 'смех', 'мем', 'meme'], url: 'https://media.giphy.com/media/QUXYcgCwvCm4cKcrnU/giphy.gif', preview: 'https://media.giphy.com/media/QUXYcgCwvCm4cKcrnU/giphy.gif' },

  // --- CATS ---
  { id: 'g29', category: 'cats', title: 'Pop Cat 🐱', tags: ['поп кот', 'pop cat', 'открывает рот', 'котик', 'кот', 'cat', 'kitten', 'мем', 'cats'], url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif', preview: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif' },
  { id: 'g30', category: 'cats', title: 'Bongo Cat 🥁', tags: ['бонго кот', 'bongo cat', 'барабанит', 'лапки', 'музыка', 'кот', 'котик', 'cat', 'cats'], url: 'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif', preview: 'https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif' },
  { id: 'g31', category: 'cats', title: 'Dancing Cat 💃🐱', tags: ['танцующий кот', 'dancing cat', 'танец', 'кот', 'котик', 'dance', 'cat', 'cute', 'cats'], url: 'https://media.giphy.com/media/MWSRkVoNaC30A/giphy.gif', preview: 'https://media.giphy.com/media/MWSRkVoNaC30A/giphy.gif' },
  { id: 'g32', category: 'cats', title: 'Cute Sleeping Kitten 😴', tags: ['милый котик', 'спит', 'котенок', 'sleep', 'sleeping', 'kitten', 'cute', 'cat', 'cats'], url: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif', preview: 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif' },
  { id: 'g33', category: 'cats', title: 'Cat Typing 💻', tags: ['кот печатает', 'работает', 'typing', 'work', 'ноутбук', 'кот', 'котик', 'cat', 'cats'], url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', preview: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { id: 'g34', category: 'cats', title: 'Hugging Cats 🤗🐱', tags: ['котики обнимаются', 'обнимашки', 'hug', 'love', 'милота', 'кот', 'котик', 'cat', 'cats'], url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif', preview: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif' },
  { id: 'g35', category: 'cats', title: 'Surprised Cat 🙀', tags: ['удивленный кот', 'шок', 'глаза', 'surprised', 'cat', 'котик', 'кот', 'cats'], url: 'https://media.giphy.com/media/vFKqnCdLPNOKc/giphy.gif', preview: 'https://media.giphy.com/media/vFKqnCdLPNOKc/giphy.gif' },

  // --- ANIME ---
  { id: 'g36', category: 'anime', title: 'Anya Heh 😏', tags: ['аня', 'anya', 'spy x family', 'хех', 'heh', 'ухмылка', 'аниме', 'anime', 'мем'], url: 'https://media.giphy.com/media/FWAcpJsFT9mVRv0e7a/giphy.gif', preview: 'https://media.giphy.com/media/FWAcpJsFT9mVRv0e7a/giphy.gif' },
  { id: 'g37', category: 'anime', title: 'Chika Dance 💃', tags: ['чика', 'chika dance', 'танец', 'kaguya', 'кагуя', 'dance', 'аниме', 'anime', 'cute'], url: 'https://media.giphy.com/media/QvBoMEcQ7DQXK/giphy.gif', preview: 'https://media.giphy.com/media/QvBoMEcQ7DQXK/giphy.gif' },
  { id: 'g38', category: 'anime', title: 'Anime Wow ✨', tags: ['вау', 'звезды в глазах', 'блеск', 'wow', 'sparkle', 'eyes', 'аниме', 'anime'], url: 'https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif', preview: 'https://media.giphy.com/media/11ISwbgCxEzMyY/giphy.gif' },
  { id: 'g39', category: 'anime', title: 'Anime Hug 🤗', tags: ['обнимашки', 'обнял', 'hug', 'warmth', 'мило', 'любовь', 'аниме', 'anime'], url: 'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif', preview: 'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif' },
  { id: 'g40', category: 'anime', title: 'Sailor Moon Cry 🌙', tags: ['сейлор мун', 'слезы', 'плачет', 'sailor moon', 'cry', 'sad', 'грусть', 'аниме', 'anime'], url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif', preview: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif' },
  { id: 'g41', category: 'anime', title: 'Naruto Run 🏃', tags: ['наруто', 'бежит', 'naruto', 'run', 'ниндзя', 'ninja', 'аниме', 'anime', 'мем'], url: 'https://media.giphy.com/media/JRlqKEzTDKci5JPcaL/giphy.gif', preview: 'https://media.giphy.com/media/JRlqKEzTDKci5JPcaL/giphy.gif' },

  // --- LOVE ---
  { id: 'g42', category: 'love', title: 'Heart Love ❤️', tags: ['любовь', 'сердце', 'love', 'heart', 'обнимаю', 'мило', 'cute', 'kiss', 'поцелуй', 'hug'], url: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif', preview: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif' },
  { id: 'g43', category: 'love', title: 'Sweet Kiss 💋', tags: ['поцелуй', 'чмок', 'kiss', 'kisses', 'love', 'любовь', 'милота', 'романтика'], url: 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif', preview: 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif' },
  { id: 'g44', category: 'love', title: 'Bear Hug 🐻❤️', tags: ['медвежонок', 'обнимашки', 'hug', 'bear', 'cute', 'мило', 'love', 'любовь', 'тепло'], url: 'https://media.giphy.com/media/PHZ7vmgmgZcjC/giphy.gif', preview: 'https://media.giphy.com/media/PHZ7vmgmgZcjC/giphy.gif' },
  { id: 'g45', category: 'love', title: 'Sending Love 💌', tags: ['сердечки', 'летящие сердца', 'hearts', 'sending love', 'love you', 'люблю', 'мило'], url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif', preview: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif' },
  { id: 'g46', category: 'love', title: 'Couple Cuddle 💑', tags: ['пара', 'объятия', 'cuddle', 'together', 'вместе', 'love', 'любовь', 'нежность'], url: 'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif', preview: 'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif' },

  // --- DANCE ---
  { id: 'g47', category: 'dance', title: 'Dance Happy 💃', tags: ['танец', 'танцует', 'dance', 'happy', 'радость', 'праздник', 'веселье', 'disco', 'диско', 'music'], url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif', preview: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif' },
  { id: 'g48', category: 'dance', title: 'Party Time 🥳', tags: ['party', 'вечеринка', 'туса', 'тусовка', 'танцы', 'dance', 'club', 'праздник', 'музыка'], url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { id: 'g49', category: 'dance', title: 'Carlton Dance 🕺', tags: ['карлтон', 'carlton', 'dance', 'танец', 'веселье', 'радость', 'happy', 'classic'], url: 'https://media.giphy.com/media/pa37AAGzKXoek/giphy.gif', preview: 'https://media.giphy.com/media/pa37AAGzKXoek/giphy.gif' },
  { id: 'g50', category: 'dance', title: 'Dancing Puppy 🐶💃', tags: ['танцующая собака', 'щенок', 'dancing dog', 'puppy', 'dance', 'cute', 'мило', 'радость'], url: 'https://media.giphy.com/media/DhstvI3CH03yE/giphy.gif', preview: 'https://media.giphy.com/media/DhstvI3CH03yE/giphy.gif' },
  { id: 'g51', category: 'dance', title: 'Friday Groove 🎵', tags: ['пятница', 'friday', 'groove', 'танец', 'dance', 'музыка', 'party', 'ура'], url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', preview: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif' },

  // --- SAD ---
  { id: 'g52', category: 'sad', title: 'Sad Cat 🥺🐱', tags: ['грустный кот', 'слезы', 'sad cat', 'crying', 'мило', 'жалко', 'sad', 'грусть', 'слезы'], url: 'https://media.giphy.com/media/OPU6QgIsDXJcX65jRS/giphy.gif', preview: 'https://media.giphy.com/media/OPU6QgIsDXJcX65jRS/giphy.gif' },
  { id: 'g53', category: 'sad', title: 'Crying Rain 🌧️', tags: ['дождь', 'плачет', 'rain', 'cry', 'crying', 'слезы', 'печаль', 'sad', 'депрессия'], url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif', preview: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif' },
  { id: 'g54', category: 'sad', title: 'Lonely Puppet 🥺', tags: ['одиноко', 'грустно', 'lonely', 'sad', 'печаль', 'тоска', 'обними'], url: 'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif', preview: 'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif' },
  { id: 'g55', category: 'sad', title: 'Sad Pepe 🐸', tags: ['грустный пепе', 'пепе', 'pepe', 'sad', 'печаль', 'слезы', 'плачет', 'мем', 'meme'], url: 'https://media.giphy.com/media/7SF5scGB2AFrgsXP63/giphy.gif', preview: 'https://media.giphy.com/media/7SF5scGB2AFrgsXP63/giphy.gif' },
  { id: 'g56', category: 'sad', title: 'Heartbroken 💔', tags: ['разбитое сердце', 'heartbroken', 'боль', 'грусть', 'sad', 'слезы', 'печаль'], url: 'https://media.giphy.com/media/L95W4wv8nnb9K/giphy.gif', preview: 'https://media.giphy.com/media/L95W4wv8nnb9K/giphy.gif' }
];

export function searchGifs(query) {
  if (!query || !query.trim()) return TRENDING_GIFS;
  const clean = query.trim().toLowerCase();
  return TRENDING_GIFS.filter((g) => {
    if (g.title.toLowerCase().includes(clean)) return true;
    if (g.category && g.category.toLowerCase().includes(clean)) return true;
    if (g.tags && g.tags.some((t) => t.includes(clean) || clean.includes(t))) return true;
    return false;
  });
}

