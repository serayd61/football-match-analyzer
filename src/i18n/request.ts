import { getRequestConfig } from 'next-intl/server';
import { routing, DEFAULT_TIME_ZONE, type Locale } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Server renders in Zurich time; <LocalTime> re-renders in the browser's zone.
    timeZone: DEFAULT_TIME_ZONE,
    formats: {
      number: {
        percent1: { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1 },
        percent0: { style: 'percent', maximumFractionDigits: 0 },
        fixed2: { maximumFractionDigits: 2, minimumFractionDigits: 2 },
      },
      dateTime: {
        kickoff: { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
        dayLong: { weekday: 'long', day: 'numeric', month: 'long' },
        dayShort: { day: 'numeric', month: 'short' },
        time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
        month: { month: 'short', year: 'numeric' },
      },
    },
  };
});
