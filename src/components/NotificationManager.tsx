import React, { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

export const NotificationManager: React.FC = () => {
  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Check if it's 9:40 PM (21:40)
      if (hours === 21 && minutes === 40) {
        // In-app toast notification
        toast.info('SmartStock Reminder', {
          description: "Don't forget to record your daily sales and check your inventory!",
          duration: 10000,
          icon: <Bell className="w-5 h-5 text-emerald-600" />
        });

        // Browser notification as fallback/background
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('SmartStock Reminder', {
            body: 'It is 9:40 PM. Don\'t forget to record your daily sales and check your inventory!',
            icon: '/favicon.ico'
          });
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkTime, 60000);
    
    // Also check immediately
    checkTime();

    return () => clearInterval(interval);
  }, []);

  return null;
};
