import { toast } from 'sonner';

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  static async showNotification(title: string, options?: NotificationOptions) {
    // Always show a toast as a fallback/companion for better UX in previews
    toast(title, {
      description: options?.body,
      icon: '🔔',
    });

    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registration.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });
      } else {
        new Notification(title, {
          icon: '/favicon.ico',
          ...options,
        });
      }
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  }

  static async notifyAppOpen(shopName: string) {
    await this.showNotification('SmartStock Opened', {
      body: `Welcome back to ${shopName}! Your inventory is ready.`,
      tag: 'app-open'
    });
  }

  static async notifyAppVisible(shopName: string) {
    await this.showNotification('SmartStock Active', {
      body: `You are back in ${shopName}.`,
      tag: 'app-visible'
    });
  }

  static async checkScheduledNotifications(shopName: string) {
    if (!('Notification' in window)) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Check for 9:00 AM
    if (hours === 9 && minutes === 0) {
      const key = `notif-9am-${dateStr}`;
      if (!localStorage.getItem(key)) {
        await this.showNotification('Morning Update', {
          body: `Good morning! Time to check your ${shopName} inventory.`,
          tag: 'morning-update'
        });
        localStorage.setItem(key, 'sent');
      }
    }

    // Check for 8:00 PM (20:00)
    if (hours === 20 && minutes === 0) {
      const key = `notif-8pm-${dateStr}`;
      if (!localStorage.getItem(key)) {
        await this.showNotification('Evening Summary', {
          body: `Good evening! Don't forget to review today's sales in ${shopName}.`,
          tag: 'evening-update'
        });
        localStorage.setItem(key, 'sent');
      }
    }
  }
}
