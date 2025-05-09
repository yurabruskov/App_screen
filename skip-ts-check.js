// Скрипт для запуска Next.js без проверки типов
const { execSync } = require('child_process');

process.env.NEXT_TELEMETRY_DISABLED = 1;
process.env.NEXT_TYPESCRIPT_COMPILE_SKIP = 'true';
process.env.NODE_OPTIONS = '--no-warnings';

try {
  console.log('Запуск Next.js без проверки типов...');
  execSync('next dev', { stdio: 'inherit' });
} catch (error) {
  console.error('Ошибка при запуске:', error);
} 