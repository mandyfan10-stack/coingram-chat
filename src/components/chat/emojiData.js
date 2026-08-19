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
 * Trending Curated Reaction GIFs with Multilingual Search Tags
 */
export const TRENDING_GIFS = [
  { id: 'g1', title: 'Thumbs Up 👍', tags: ['лайк', 'like', 'thumbs up', 'класс', 'супер', 'ok', 'ок', 'добро', 'yes', 'да', 'good', 'agree', 'топ'], url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', preview: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: 'g2', title: 'Cat Vibe 🐱', tags: ['кот', 'котик', 'кошка', 'cat', 'vibe', 'качает', 'музыка', 'music', 'dance', 'танец', 'животные', 'cute'], url: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif', preview: 'https://media.giphy.com/media/BzyTuYCmvSORqs1ABM/giphy.gif' },
  { id: 'g3', title: 'Applause 👏', tags: ['аплодисменты', 'хлопает', 'clap', 'applause', 'браво', 'молодец', 'bravo', 'congrats', 'ура', 'cheers'], url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif', preview: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif' },
  { id: 'g4', title: 'Mind Blown 🤯', tags: ['шок', 'взрыв мозга', 'mind blown', 'shock', 'ого', 'вау', 'crazy', 'omg', 'омг', 'wow'], url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', preview: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: 'g5', title: 'Dance Happy 💃', tags: ['танец', 'танцует', 'dance', 'happy', 'радость', 'праздник', 'веселье', 'disco', 'диско', 'music'], url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif', preview: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif' },
  { id: 'g6', title: 'Love Heart ❤️', tags: ['любовь', 'сердце', 'love', 'heart', 'обнимаю', 'мило', 'cute', 'kiss', 'поцелуй', 'hug'], url: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif', preview: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif' },
  { id: 'g7', title: 'Popcorn 🍿', tags: ['попкорн', 'popcorn', 'кино', 'наблюдаю', 'watching', 'драма', 'drama', 'жду', 'фильм', 'movie'], url: 'https://media.giphy.com/media/t3dLl0TGHCxTG/giphy.gif', preview: 'https://media.giphy.com/media/t3dLl0TGHCxTG/giphy.gif' },
  { id: 'g8', title: 'Excited 🎉', tags: ['ура', 'радость', 'excited', 'party', 'праздник', 'восторг', 'yes', 'вечеринка', 'celebrate'], url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', preview: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif' },
  { id: 'g9', title: 'Facepalm 🤦', tags: ['рукалицо', 'facepalm', 'кринж', 'стыд', 'fail', 'фейл', 'мда', 'cringe', 'боже'], url: 'https://media.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif', preview: 'https://media.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif' },
  { id: 'g10', title: 'Laughing 😂', tags: ['смех', 'ржу', 'lol', 'laugh', 'haha', 'хаха', 'ору', 'смешно', 'rofl', 'мем', 'funny'], url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif', preview: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' },
  { id: 'g11', title: 'Shocked 😱', tags: ['шок', 'испуг', 'shocked', 'scared', 'страх', 'ужас', 'омг', 'omg', 'what', 'что'], url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif', preview: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' },
  { id: 'g12', title: 'Bye Wave 👋', tags: ['пока', 'привет', 'bye', 'hello', 'wave', 'до свидания', 'увидимся', 'hi', 'хай', 'ку'], url: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif', preview: 'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif' },
  { id: 'g13', title: 'Home Sweet Home 🏠', tags: ['home', 'дом', 'уют', 'relax', 'чилл', 'отдых', 'stay home', 'house', 'дома'], url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif', preview: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif' },
  { id: 'g14', title: 'Fire 🔥', tags: ['огонь', 'fire', 'hot', 'жара', 'пушка', 'топ', 'lit', 'круто'], url: 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif', preview: 'https://media.giphy.com/media/nrXif9YExO9EI/giphy.gif' },
  { id: 'g15', title: 'Money 💰', tags: ['деньги', 'money', 'cash', 'богатство', 'rich', 'монеты', 'доллары', 'крипта', 'crypto'], url: 'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif', preview: 'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.gif' },
  { id: 'g16', title: 'Pepe Cheers 🥂', tags: ['пепе', 'pepe', 'cheers', 'тост', 'праздник', 'мем', 'meme', 'ура'], url: 'https://media.giphy.com/media/BPJmthQ3YRwD6QqcVD/giphy.gif', preview: 'https://media.giphy.com/media/BPJmthQ3YRwD6QqcVD/giphy.gif' },
  { id: 'g17', title: 'Cool Shades 😎', tags: ['крутой', 'cool', 'очки', 'deal with it', 'стиль', 'boss', 'босс'], url: 'https://media.giphy.com/media/yA5Y3B4Ip13Xy/giphy.gif', preview: 'https://media.giphy.com/media/yA5Y3B4Ip13Xy/giphy.gif' },
  { id: 'g18', title: 'Thinking 🤔', tags: ['думаю', 'thinking', 'мысли', 'хм', 'hmm', 'вопрос', 'idea', 'идея'], url: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif', preview: 'https://media.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif' },
  { id: 'g19', title: 'Happy Dog 🐶', tags: ['собака', 'dog', 'пес', 'щенок', 'puppy', 'мило', 'cute', 'радость', 'happy', 'животные'], url: 'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif', preview: 'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif' },
  { id: 'g20', title: 'Party Time 🥳', tags: ['party', 'вечеринка', 'туса', 'тусовка', 'танцы', 'dance', 'club', 'праздник', 'музыка'], url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' }
];

export function searchGifs(query) {
  if (!query || !query.trim()) return TRENDING_GIFS;
  const clean = query.trim().toLowerCase();
  return TRENDING_GIFS.filter((g) => {
    if (g.title.toLowerCase().includes(clean)) return true;
    if (g.tags && g.tags.some((t) => t.includes(clean) || clean.includes(t))) return true;
    return false;
  });
}
