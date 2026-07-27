/** Demo sticker packs used when Supabase is not configured. */
export const defaultMockPacks = [
  {
    id: 'pack-animals',
    name: 'AnimalsMock',
    title: 'Cute Animals 🦊',
    is_animated: false,
    is_video: false,
    stickers: [
      { id: 'st-cat', emoji: '🐱', filePath: 'https://img.icons8.com/color/180/cat.png' },
      { id: 'st-dog', emoji: '🐶', filePath: 'https://img.icons8.com/color/180/dog.png' },
      { id: 'st-rabbit', emoji: '🐰', filePath: 'https://img.icons8.com/color/180/rabbit.png' },
      { id: 'st-fox', emoji: '🦊', filePath: 'https://img.icons8.com/color/180/fox.png' },
      { id: 'st-panda', emoji: '🐼', filePath: 'https://img.icons8.com/color/180/panda.png' },
      { id: 'st-lion', emoji: '🦁', filePath: 'https://img.icons8.com/color/180/lion.png' },
      { id: 'st-koala', emoji: '🐨', filePath: 'https://img.icons8.com/color/180/koala-bear.png' }
    ]
  },
  {
    id: 'pack-animated',
    name: 'AnimatedMock',
    title: 'Animations ✨',
    is_animated: true,
    is_video: false,
    stickers: [
      { id: 'st-anim1', emoji: '🎉', filePath: 'https://assets5.lottiefiles.com/packages/lf20_u4yrau.json' },
      { id: 'st-anim2', emoji: '❤️', filePath: 'https://assets9.lottiefiles.com/packages/lf20_yg16kv9p.json' },
      { id: 'st-anim3', emoji: '🚀', filePath: 'https://assets1.lottiefiles.com/packages/lf20_yjrdpceb.json' }
    ]
  },
  {
    id: 'pack-video',
    name: 'VideoMock',
    title: 'Video Loops 🎬',
    is_animated: false,
    is_video: true,
    stickers: [
      { id: 'st-vid1', emoji: '🐱', filePath: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHY5b3h5a3VjMWoxeXU3dWthdjV2bnhmdzJjZTh1MGFhMG51N2x0ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/33OrjzUFwkwEg/giphy.webm' },
      { id: 'st-vid2', emoji: '🍔', filePath: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnp4NWN6YW44bnR0YmExMnBpeThmOWthNXh6d3p2azVxdG1qbjI3ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7bu3XilJ5BOiSGic/giphy.webm' }
    ]
  }
];

export const initialStories = [];
