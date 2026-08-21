// Service Worker for Coingram Chat Web & Mobile Push Notifications

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Coiny';
    const options = {
      body: data.body || 'Новое сообщение',
      icon: data.icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'coingram-notification',
      data: data.data || {},
      renotify: true
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    event.waitUntil(
      self.registration.showNotification('Coiny', {
        body: event.data.text(),
        icon: '/favicon.svg',
        badge: '/favicon.svg'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
