# 🚀 Руководство по миграции на новую архитектуру

## 📊 Что изменилось

### До рефакторинга
```
components/
└── banner-generator.tsx  (1905 строк 😱)
```

### После рефакторинга
```
components/
├── banner-generator.tsx  (оригинал, ~1900 строк)
├── banner-generator-refactored-example.tsx  (пример, ~150 строк)
└── banner/
    ├── README.md
    ├── index.ts
    ├── types/
    │   └── index.ts
    ├── utils/
    │   └── imageDB.ts
    ├── hooks/
    │   ├── useImageDB.ts
    │   └── useLocalStorage.ts
    ├── top-bar/
    │   ├── TopBar.tsx
    │   ├── DeviceSelector.tsx
    │   └── ExportAllButton.tsx
    └── settings-panel/
        └── NumberInputWithSlider.tsx
```

## 🎯 Преимущества

- ✅ **Читаемость**: Каждый компонент < 100 строк
- ✅ **Переиспользование**: Компоненты можно использовать отдельно
- ✅ **Тестирование**: Легко писать unit-тесты
- ✅ **TypeScript**: Полная типизация
- ✅ **Масштабируемость**: Легко добавлять новые фичи
- ✅ **Командная работа**: Меньше конфликтов при merge

## 📝 Пошаговая миграция

### Шаг 1: Использование новых компонентов

Замените импорты в вашем коде:

```tsx
// Старый способ
import BannerGenerator from '@/components/banner-generator'

// Новый способ - импорт конкретных компонентов
import { TopBar, useImageDB } from '@/components/banner'
```

### Шаг 2: Постепенная миграция

Вы можете мигрировать по частям:

1. **Сначала TopBar**
   ```tsx
   import { TopBar } from '@/components/banner/top-bar'
   // Замените существующий топ-бар на TopBar компонент
   ```

2. **Потом хуки**
   ```tsx
   import { useImageDB, useLocalStorage } from '@/components/banner'
   // Замените useState + useEffect на кастомные хуки
   ```

3. **Затем остальное**
   - PreviewPanel
   - SettingsPanel
   - Dialogs

### Шаг 3: Обновление типов

```tsx
import type {
  PreviewItem,
  DeviceType,
  LocalizedContent
} from '@/components/banner'

// Теперь у вас есть типизация для всех данных
const [device, setDevice] = useState<DeviceType>('iphone')
```

## 🔧 Как работать с новой структурой

### Добавление нового компонента

1. Создайте файл в соответствующей папке:
   ```
   components/banner/top-bar/NewButton.tsx
   ```

2. Экспортируйте через index.ts:
   ```tsx
   // components/banner/top-bar/index.ts
   export { NewButton } from './NewButton'
   ```

3. Используйте:
   ```tsx
   import { NewButton } from '@/components/banner/top-bar'
   ```

### Добавление нового типа

```tsx
// components/banner/types/index.ts
export interface NewFeature {
  id: number
  name: string
}
```

### Добавление нового хука

```tsx
// components/banner/hooks/useNewFeature.ts
export function useNewFeature() {
  // ... логика
}

// Экспорт
// components/banner/index.ts
export { useNewFeature } from './hooks/useNewFeature'
```

## 🧪 Тестирование

### Тестирование компонента

```tsx
import { render, screen } from '@testing-library/react'
import { DeviceSelector } from '@/components/banner'

test('DeviceSelector renders iPhone and iPad buttons', () => {
  render(<DeviceSelector selectedDevice="iphone" onChange={() => {}} />)
  expect(screen.getByText('iPhone')).toBeInTheDocument()
  expect(screen.getByText('iPad')).toBeInTheDocument()
})
```

### Тестирование хука

```tsx
import { renderHook } from '@testing-library/react'
import { useLocalStorage } from '@/components/banner'

test('useLocalStorage saves to localStorage', () => {
  const { result } = renderHook(() => useLocalStorage('test', 'default'))
  expect(result.current[0]).toBe('default')
})
```

## 📚 Примеры

### Пример 1: Использование TopBar

```tsx
import { TopBar } from '@/components/banner'
import { LANGUAGES } from '@/lib/constants'

function MyApp() {
  const [device, setDevice] = useState('iphone')
  const [language, setLanguage] = useState('en')

  return (
    <TopBar
      selectedDevice={device}
      onDeviceChange={setDevice}
      languages={LANGUAGES}
      activeLanguage={language}
      onLanguageChange={setLanguage}
      isExporting={false}
      exportProgress={0}
      onExportAll={() => {}}
    />
  )
}
```

### Пример 2: Использование хуков

```tsx
import { useImageDB, useLocalStorage } from '@/components/banner'

function MyComponent() {
  const imageDB = useImageDB()
  const [settings, setSettings] = useLocalStorage('settings', {})

  const handleUpload = async (file: File) => {
    if (imageDB) {
      await imageDB.saveImage('my-image', file)
    }
  }

  return (...)
}
```

## 🎓 Best Practices

1. **Один компонент = одна ответственность**
   - TopBar только показывает топ-бар
   - DeviceSelector только переключает девайс

2. **Типизируйте все props**
   ```tsx
   interface MyComponentProps {
     value: string
     onChange: (value: string) => void
   }
   ```

3. **Используйте кастомные хуки для переиспользуемой логики**
   ```tsx
   const imageDB = useImageDB() // Вместо new ImageDB()
   ```

4. **Держите компоненты маленькими**
   - Цель: < 100 строк на файл
   - Если больше - разбейте на под-компоненты

## 🔄 Статус миграции

- ✅ ImageDB вынесен в utils
- ✅ Типы созданы
- ✅ Хуки созданы (useImageDB, useLocalStorage)
- ✅ TopBar компоненты созданы
- ✅ Базовые компоненты settings панели
- 🔄 TODO: PreviewPanel компоненты
- 🔄 TODO: SettingsPanel компоненты (полностью)
- 🔄 TODO: Dialog компоненты
- 🔄 TODO: Полная миграция BannerGenerator

## 💡 Советы

- Не спешите мигрировать все сразу
- Тестируйте каждый шаг
- Используйте TypeScript для проверки типов
- Пишите тесты для новых компонентов

## 🆘 Помощь

Если что-то не работает:

1. Проверьте импорты
2. Проверьте типы
3. Посмотрите примеры в `banner-generator-refactored-example.tsx`
4. Читайте `components/banner/README.md`

## 🎉 Результат

После полной миграции у вас будет:

- **Модульный код**: легко находить и редактировать
- **Типобезопасность**: меньше ошибок
- **Переиспользование**: компоненты можно использовать где угодно
- **Тестируемость**: легко писать тесты
- **Масштабируемость**: легко добавлять новые фичи
- **Документация**: каждый компонент документирован
