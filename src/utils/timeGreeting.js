import { useEffect, useState } from 'react';

const INDIA_TIME_ZONE = 'Asia/Kolkata';

export function greetingForDate(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date));

  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

export function useTimeGreeting() {
  const [greeting, setGreeting] = useState(() => greetingForDate());

  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingForDate());
    const timer = window.setInterval(updateGreeting, 60_000);
    window.addEventListener('focus', updateGreeting);
    document.addEventListener('visibilitychange', updateGreeting);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', updateGreeting);
      document.removeEventListener('visibilitychange', updateGreeting);
    };
  }, []);

  return greeting;
}
