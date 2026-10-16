/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAFA',
        surface: '#FFFFFF',
        primary: '#3B82F6',
        ink: '#0A0A0B',
        sub1: '#52525B',
        sub2: '#71717A',
        sub3: '#A1A1AA',
        line: '#E4E4E7',
        pass: '#059669',
        reject: '#EF4444',
        warn: '#F59E0B',
        'warn-deep': '#D97706',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans SC',
          'system-ui',
          '-apple-system',
          'PingFang SC',
          'Microsoft YaHei',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
