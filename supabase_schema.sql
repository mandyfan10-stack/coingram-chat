-- Скрипт создания структуры базы данных для Telegram Clone в Supabase
-- Скопируйте этот код и запустите его в разделе SQL Editor панели управления Supabase.

-- ==========================================
-- 1. Создание всех таблиц
-- ==========================================

-- 1.1 Таблица профилей пользователей
create table public.profiles (
  id uuid primary key, -- Для пользователей совпадает с auth.users.id, для ботов - фиксированные UUID
  username text unique not null,
  display_name text,
  avatar text default '⚡',
  avatar_color text default 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
  bio text default '',
  theme text default 'telegram-blue',
  wallpaper text default 'classic',
  last_seen timestamp with time zone default now(),
  public_key text,
  has_e2ee boolean default false
);

-- 1.2 Таблица чатов (диалоги, группы, каналы)
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('personal', 'group', 'channel')) not null,
  avatar text default '👥',
  avatar_color text default 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  bio text,
  username text unique,
  created_at timestamp with time zone default now(),
  created_by uuid references public.profiles(id) on delete set null,
  settings jsonb default '{"only_admins_can_post": false, "allow_media": true, "allow_add_members": true, "allow_pin_messages": true}'::jsonb
);

-- 1.3 Связующая таблица участников чата
create table public.chat_members (
  chat_id uuid references public.chats(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  notifications boolean default true,
  pinned boolean default false,
  role text default 'member' check (role in ('member', 'admin')),
  primary key (chat_id, profile_id)
);

-- 1.4 Таблица сообщений
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  text text not null,
  media text,
  reply_to uuid references public.messages(id) on delete set null,
  read boolean default false, -- Legacy read status for simple chats
  created_at timestamp with time zone default now(),
  reactions jsonb default '[]'::jsonb
);

-- 1.5 Таблица приватных ключей пользователей (E2EE резервные копии)
create table public.user_private_keys (
  id uuid primary key references public.profiles(id) on delete cascade,
  encrypted_private_key text not null,
  created_at timestamp with time zone default now()
);

-- 1.6 Таблица отслеживания прочтений сообщений
create table public.message_reads (
  message_id uuid references public.messages(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  read_at timestamp with time zone default now(),
  primary key (message_id, profile_id)
);

-- ==========================================
-- 2. Включение Row Level Security (RLS)
-- ==========================================
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.user_private_keys enable row level security;
alter table public.message_reads enable row level security;

-- ==========================================
-- 2.5 Хелпер-функции безопасности (для обхода рекурсии в политиках)
-- ==========================================

-- Проверяет, является ли пользователь участником чата
create or replace function public.is_chat_member(chat_id uuid, user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.chat_members
    where chat_members.chat_id = $1 and chat_members.profile_id = $2
  );
end;
$$;

-- Проверяет, является ли пользователь администратором чата
create or replace function public.is_chat_admin(chat_id uuid, user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.chat_members
    where chat_members.chat_id = $1 and chat_members.profile_id = $2 and chat_members.role = 'admin'
  );
end;
$$;

-- Валидация изменений в сообщении (позволяет изменять только реакции пользователям, отличным от автора)
create or replace function public.validate_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Автор сообщения может обновлять любые поля
  if auth.uid() = old.sender_id then
    return new;
  end if;

  -- Другие участники чата могут обновлять ТОЛЬКО реакции
  if new.id != old.id or
     new.chat_id != old.chat_id or
     new.sender_id != old.sender_id or
     new.text != old.text or
     coalesce(new.media, '') != coalesce(old.media, '') or
     coalesce(new.reply_to, '00000000-0000-0000-0000-000000000000'::uuid) != coalesce(old.reply_to, '00000000-0000-0000-0000-000000000000'::uuid) or
     new.created_at != old.created_at or
     new.read != old.read
  then
    raise exception 'У вас нет прав на редактирование контента этого сообщения';
  end if;

  return new;
end;
$$;

-- Навешивание триггера валидации изменений сообщений
drop trigger if exists on_message_updated on public.messages;
create trigger on_message_updated
  before update on public.messages
  for each row execute procedure public.validate_message_update();


-- ==========================================
-- 3. Политики безопасности (Policies)
-- ==========================================

-- 3.1 Политики для profiles
create policy "Профили видны всем авторизованным пользователям"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Пользователи могут обновлять свой собственный профиль"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- 3.2 Политики для user_private_keys (E2EE приватный ключ доступен только владельцу)
create policy "Пользователи могут видеть только свои приватные ключи"
  on public.user_private_keys for select
  to authenticated
  using (auth.uid() = id);

create policy "Пользователи могут добавлять свои приватные ключи"
  on public.user_private_keys for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Пользователи могут обновлять свои приватные ключи"
  on public.user_private_keys for update
  to authenticated
  using (auth.uid() = id);

-- 3.3 Политики для chats
create policy "Чаты видны их участникам"
  on public.chats for select
  to authenticated
  using (
    (created_by = auth.uid()) or
    public.is_chat_member(id, auth.uid()) or
    type = 'channel'
  );

create policy "Пользователи могут создавать только свои чаты"
  on public.chats for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Создатели, админы или участники личных переписок могут обновлять чаты"
  on public.chats for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_chat_admin(id, auth.uid())
    or (
      type = 'personal'
      and public.is_chat_member(id, auth.uid())
    )
  )
  with check (
    created_by = auth.uid()
    or public.is_chat_admin(id, auth.uid())
    or (
      type = 'personal'
      and public.is_chat_member(id, auth.uid())
    )
  );

create policy "Создатели или участники личных переписок могут удалять чаты"
  on public.chats for delete
  to authenticated
  using (
    created_by = auth.uid()
    or (
      type = 'personal'
      and public.is_chat_member(id, auth.uid())
    )
  );

-- 3.4 Политики для chat_members
create policy "Участники чатов видны только участникам тех же чатов"
  on public.chat_members for select
  to authenticated
  using (
    profile_id = auth.uid()
    or public.is_chat_member(chat_id, auth.uid())
    or exists (
      select 1 from public.chats
      where chats.id = chat_members.chat_id and (chats.type = 'group' or chats.type = 'channel')
    )
  );

create policy "Пользователи могут вступать в чаты или приглашать других"
  on public.chat_members for insert
  to authenticated
  with check (
    -- 1. Вступление в публичную группу или любой канал
    (profile_id = auth.uid() and exists (
      select 1 from public.chats
      where chats.id = chat_members.chat_id 
      and (chats.type = 'channel' or (chats.type = 'group' and chats.username is not null))
    ))
    -- 2. Добавление кого угодно создателем чата или его администратором
    or exists (
      select 1 from public.chats
      where chats.id = chat_members.chat_id 
      and (chats.created_by = auth.uid() or public.is_chat_admin(chat_members.chat_id, auth.uid()))
    )
    -- 3. Приглашение обычным участником, если настройки группы разрешают добавление
    or (
      public.is_chat_member(chat_id, auth.uid())
      and exists (
        select 1 from public.chats
        where chats.id = chat_members.chat_id
        and chats.type = 'group'
        and coalesce((chats.settings->>'allow_add_members')::boolean, true) = true
      )
    )
  );

create policy "Пользователи могут покидать чаты"
  on public.chat_members for delete
  to authenticated
  using (profile_id = auth.uid());

-- 3.5 Политики для messages
create policy "Сообщения видны участникам чата"
  on public.messages for select
  to authenticated
  using (
    public.is_chat_member(chat_id, auth.uid()) or exists (
      select 1 from public.chats
      where chats.id = messages.chat_id 
      and chats.type = 'channel' 
      and chats.username is not null
    )
  );

create policy "Участники чата могут отправлять сообщения"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id and (
      public.is_chat_member(chat_id, auth.uid()) or exists (
        select 1 from public.chats
        where chats.id = messages.chat_id 
        and chats.type = 'channel'
        -- Для каналов отправлять сообщения могут только админы/создатели
        and (chats.created_by = auth.uid() or public.is_chat_admin(chat_id, auth.uid()))
      )
    )
  );

create policy "Участники чата могут отмечать прочтение и реакции, авторы - редактировать"
  on public.messages for update
  to authenticated
  using (
    public.is_chat_member(chat_id, auth.uid())
  )
  with check (
    public.is_chat_member(chat_id, auth.uid())
  );

create policy "Пользователи могут удалять свои сообщения"
  on public.messages for delete
  to authenticated
  using (sender_id = auth.uid());

-- 3.6 Политики для message_reads
create policy "Пользователи могут видеть отметки о прочтении сообщений своих чатов"
  on public.message_reads for select
  to authenticated
  using (
    exists (
      select 1 from public.messages
      where messages.id = message_reads.message_id
      and public.is_chat_member(messages.chat_id, auth.uid())
    )
  );

create policy "Пользователи могут отмечать сообщения как прочитанные"
  on public.message_reads for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.messages
      where messages.id = message_reads.message_id
      and public.is_chat_member(messages.chat_id, auth.uid())
    )
  );

-- ==========================================
-- 4. Триггер для автоматического профиля
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  username_val text;
  display_name_val text;
begin
  username_val := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  display_name_val := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, username, display_name, avatar, avatar_color, bio)
  values (
    new.id,
    username_val,
    display_name_val,
    '🪙',
    'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)',
    ''
  );
  return new;
end;
$$ language plpgsql security definer;

-- Навешивание триггера на auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 5. Предварительно созданные боты (Seeding)
-- ==========================================
insert into public.profiles (id, username, display_name, avatar, avatar_color, bio)
values 
  ('00000000-0000-0000-0000-000000000003', 'echo_bot', 'Echo Bot 🤖', '🤖', 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', 'Я бот-повторюшка. Напиши мне что-нибудь, и я отвечу эхом, добавив немного юмора!'),
  ('00000000-0000-0000-0000-000000000004', 'quiz_bot', 'Quiz Master 🧠', '🧠', 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)', 'Официальный бот викторин. Набери максимальный балл!'),
  ('00000000-0000-0000-0000-000000000005', 'weather_bot', 'Weather Bot 🌤️', '🌤️', 'linear-gradient(135deg, #a8ceff 0%, #ffebaa 100%)', 'Самый точный прогноз погоды прямо в чате. Просто напиши название города.')
on conflict (id) do nothing;

-- ==========================================
-- 6. Настройка политик безопасности для Storage
-- ==========================================

-- Добавление бакета chat-attachments, если он еще не существует
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false) -- Сделать бакет приватным!
on conflict (id) do nothing;

-- Разрешить авторизованным пользователям загрузку файлов в бакет chat-attachments
create policy "Allow authenticated insert to chat-attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');

-- Разрешить авторизованным пользователям просмотр файлов из бакета
create policy "Allow authenticated select from chat-attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-attachments');
