/**
 * Notification service for Web and PWA notifications.
 * Handles system notification permissions, background notifications, and click dispatch.
 */

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return 'denied';
  }
}

/**
 * Dispatches an OS/browser push notification if the window is in the background or hidden.
 *
 * @param {Object} options
 * @param {string} options.title - Notification title (e.g. sender name)
 * @param {string} options.body - Message preview text or call status
 * @param {string} [options.icon] - Icon or avatar URL
 * @param {string} [options.tag] - Grouping tag (e.g. chatId)
 * @param {any} [options.data] - Arbitrary payload
 * @param {() => void} [options.onClick] - Click handler (brings chat into focus)
 */
export function showIncomingNotification({
  title,
  body,
  icon = './favicon.ico',
  tag = 'coingram-notification',
  data = null,
  onClick = null
}) {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    // Only display notification when the tab is hidden or not actively focused
    const isTabActive = typeof document !== 'undefined' && !document.hidden && document.hasFocus();
    if (isTabActive) return null;

    const notification = new Notification(title || 'CoinGram', {
      body: body || 'Новое сообщение',
      icon: icon || './favicon.ico',
      tag,
      data,
      silent: false
    });

    notification.onclick = (event) => {
      event.preventDefault();
      try {
        if (typeof window !== 'undefined') {
          window.focus();
        }
      } catch {
        /* ignore focus errors */
      }
      if (typeof onClick === 'function') {
        onClick();
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn('Could not display push notification:', err);
    return null;
  }
}

export default {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showIncomingNotification
};
