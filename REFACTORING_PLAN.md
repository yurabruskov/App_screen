# 📋 План рефакторинга Banner Generator

## 🎯 Текущая ситуация

- **Файл**: `components/banner-generator.tsx`
- **Размер**: 1905 строк, 69KB
- **Проблема**: Огромный монолитный компонент, сложно поддерживать и изменять

## 📊 Анализ структуры

### Текущая структура файла:

```
banner-generator.tsx (1905 строк)
├── ImageDB класс (~160 строк)
└── BannerGenerator компонент (~1710 строк)
    ├── 13+ useState hooks
    ├── 3+ useRef hooks
    ├── 5+ useEffect hooks
    ├── 15+ handler functions
    ├── 2 render functions
    └── Огромный JSX return (~500 строк)
```

### Что нужно извлечь:

**1. Утилиты и классы:**
- ImageDB → `utils/imageDB.ts` ✅ (уже есть в `components/banner/utils/imageDB.ts`)
- Константы → `lib/constants.ts` ✅ (уже есть)
- Типы → `types/index.ts` ✅ (уже есть в `components/banner/types/index.ts`)

**2. Custom Hooks:**
- useImageDB → `hooks/useImageDB.ts` ✅ (уже есть в `components/banner/hooks/useImageDB.ts`)
- useLocalStorage → `hooks/useLocalStorage.ts` ✅ (уже есть)
- useBannerSettings (новый) - для всех useState связанных с настройками
- usePreviewItems (новый) - для управления preview items
- useLocalizedContent (новый) - для мультиязычного контента

**3. Под-компоненты:**

```
components/banner/
├── BannerGenerator.tsx (главный, будет ~300 строк)
├── top-bar/
│   ├── TopBar.tsx ✅ (уже есть)
│   ├── DeviceSelector.tsx ✅ (уже есть)
│   ├── LanguageSelector.tsx (нужно создать)
│   ├── ExportAllButton.tsx ✅ (уже есть)
│   └── ImportButton.tsx (нужно создать)
├── preview-panel/
│   ├── PreviewPanel.tsx (новый)
│   ├── PreviewCard.tsx (новый)
│   ├── PreviewCarousel.tsx (новый)
│   └── BannerRenderer.tsx (новый) - renderBanner функция
├── settings-panel/
│   ├── SettingsPanel.tsx (новый) - renderSettingsPanel функция
│   ├── BannerSettings.tsx (новый)
│   ├── TitleSettings.tsx (новый)
│   ├── DescriptionSettings.tsx (новый)
│   ├── DeviceSettings.tsx (новый)
│   └── NumberInputWithSlider.tsx ✅ (уже есть)
└── json-manager/
    ├── JsonImportDialog.tsx (новый)
    └── JsonExportButton.tsx (новый)
```

## 🚀 План по фазам

### 📦 ФАЗА 1: Подготовка (30 мин)

**Цель**: Подготовить окружение и создать типы

**Шаги**:
1. ✅ Проверить существующую структуру `components/banner/`
2. Создать недостающие папки:
   ```bash
   mkdir -p components/banner/preview-panel
   mkdir -p components/banner/json-manager
   ```
3. Создать/обновить `types/index.ts` с полными типами:
   - PreviewItem
   - BannerSettings
   - LocalizedContent
   - FontSettings
   - VerticalOffset
   - Screenshot

**Результат**: Готовая структура папок и полные типы

---

### 🎣 ФАЗА 2: Извлечение Custom Hooks (1 час)

**Цель**: Вынести всю логику состояний в custom hooks

**2.1 Создать `hooks/useBannerSettings.ts`**
```typescript
// Управление настройками баннера
- bannerSettings
- setBannerSettings
- textAlignment
- setTextAlignment
- fontSize
- setFontSize
- lineHeight
- setLineHeight
- letterSpacing
- setLetterSpacing
```

**2.2 Создать `hooks/usePreviewItems.ts`**
```typescript
// Управление preview items
- previewItems
- setPreviewItems
- previewIndex
- setPreviewIndex
- addPreview()
- removePreview()
- duplicatePreview()
- updatePreview()
```

**2.3 Создать `hooks/useLocalizedContent.ts`**
```typescript
// Управление мультиязычного контента
- localizedContent
- setLocalizedContent
- activeLanguage
- setActiveLanguage
- updateLocalizedContent()
- getPreviewContent()
```

**2.4 Создать `hooks/useJsonManager.ts`**
```typescript
// Импорт/экспорт JSON
- handleJsonImport()
- handleJsonExport()
- jsonImportText
- setJsonImportText
```

**Результат**: 4 custom hooks, которые заменят 13+ useState

---

### 🧩 ФАЗА 3: Извлечение под-компонентов (2 часа)

**Цель**: Разбить огромный JSX на переиспользуемые компоненты

**3.1 Top Bar компоненты**

✅ `TopBar.tsx` - уже есть, но нужно обновить
✅ `DeviceSelector.tsx` - уже есть
- `LanguageSelector.tsx` - создать из inline кода
- `ImportButton.tsx` - вынести Dialog для импорта JSON
✅ `ExportAllButton.tsx` - уже есть

**3.2 Preview Panel компоненты**

- `PreviewPanel.tsx` - контейнер для preview области
  ```typescript
  Props: {
    previewItems
    previewIndex
    activeLanguage
    onPreviewIndexChange
  }
  ```

- `PreviewCarousel.tsx` - карусель с миниатюрами
  ```typescript
  Props: {
    items
    activeIndex
    onSelect
    onAdd
    onRemove
    onDuplicate
  }
  ```

- `BannerRenderer.tsx` - рендеринг одного баннера (из renderBanner)
  ```typescript
  Props: {
    item: PreviewItem
    settings: BannerSettings
    content: LocalizedContent
    activeLanguage
  }
  ```

**3.3 Settings Panel компоненты**

- `SettingsPanel.tsx` - главный контейнер настроек
  ```typescript
  Props: {
    activeElement: 'banner' | 'title' | 'description' | 'device'
    settings
    onSettingsChange
  }
  ```

- `BannerSettings.tsx` - настройки баннера (фон, ориентация)
- `TitleSettings.tsx` - настройки заголовка (размер, цвет, отступы)
- `DescriptionSettings.tsx` - настройки описания
- `DeviceSettings.tsx` - настройки устройства (позиция, масштаб, border)

**3.4 JSON Manager компоненты**

- `JsonImportDialog.tsx` - диалог импорта JSON
- `JsonExportButton.tsx` - кнопка экспорта JSON

**Результат**: 15+ небольших компонентов вместо одного огромного

---

### 🔧 ФАЗА 4: Рефакторинг главного компонента (30 мин)

**Цель**: Упростить BannerGenerator до координатора

**Новая структура BannerGenerator.tsx** (~300 строк):
```typescript
export default function BannerGenerator() {
  // Custom hooks
  const bannerSettings = useBannerSettings()
  const previewManager = usePreviewItems()
  const contentManager = useLocalizedContent()
  const jsonManager = useJsonManager()
  const imageDB = useImageDB()

  // Handlers
  const handleExport = async () => { /* ... */ }

  // Render
  return (
    <div>
      <TopBar
        deviceSelector={<DeviceSelector />}
        languageSelector={<LanguageSelector />}
        importButton={<ImportButton />}
        exportButton={<ExportAllButton />}
      />

      <div className="grid lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PreviewPanel
            items={previewManager.previewItems}
            activeIndex={previewManager.previewIndex}
            activeLanguage={contentManager.activeLanguage}
            onIndexChange={previewManager.setPreviewIndex}
          />
        </div>

        <div className="lg:col-span-1">
          <SettingsPanel
            activeElement={activeElement}
            settings={bannerSettings}
            onChange={bannerSettings.update}
          />
        </div>
      </div>
    </div>
  )
}
```

**Результат**: Чистый и понятный главный компонент

---

### ✅ ФАЗА 5: Тестирование (30 мин)

**Цель**: Убедиться, что ничего не сломалось

**Шаги**:
1. Запустить dev сервер: `npm run dev`
2. Проверить все функции:
   - ✅ Переключение языков
   - ✅ Переключение устройств (iPhone/iPad)
   - ✅ Добавление/удаление preview
   - ✅ Загрузка скриншотов
   - ✅ Изменение настроек (цвета, шрифты, отступы)
   - ✅ Импорт/экспорт JSON
   - ✅ Экспорт всех изображений
3. Проверить localStorage (сохранение/загрузка)
4. Проверить IndexedDB (скриншоты)

**Результат**: Все работает как раньше

---

### 🚀 ФАЗА 6: Сборка и деплой (15 мин)

**Цель**: Собрать и задеплоить на GitHub Pages

**Шаги**:
1. Собрать проект:
   ```bash
   npm run build
   ```
2. Экспортировать статику (если используется):
   ```bash
   npm run export
   ```
3. Скопировать файлы в gh-pages:
   ```bash
   git checkout gh-pages
   cp -r out/* .
   git add .
   git commit -m "refactor: Split BannerGenerator into modular components"
   git push
   ```
4. Проверить на https://yurabruskov.github.io/App_screen/

**Результат**: Рефакторенная версия на продакшене

---

## ⏱️ Общее время: ~4.5 часа

| Фаза | Время | Описание |
|------|-------|----------|
| 1. Подготовка | 30 мин | Папки и типы |
| 2. Custom Hooks | 1 час | Извлечение логики |
| 3. Под-компоненты | 2 часа | Разбивка на компоненты |
| 4. Главный компонент | 30 мин | Упрощение |
| 5. Тестирование | 30 мин | Проверка работы |
| 6. Деплой | 15 мин | Сборка и публикация |

---

## 🎯 Ожидаемый результат

### До рефакторинга:
```
banner-generator.tsx - 1905 строк ❌
```

### После рефакторинга:
```
BannerGenerator.tsx - ~300 строк ✅

+ 4 custom hooks - ~200 строк каждый
+ 15 компонентов - ~50-150 строк каждый

ИТОГО: ~20 файлов по 50-300 строк
```

---

## ⚠️ Важные правила

1. **Не делать все сразу** - по одной фазе за раз
2. **Коммитить после каждой фазы** - чтобы можно было откатиться
3. **Тестировать после каждого изменения** - npm run dev
4. **Сохранять совместимость** - не менять API, только структуру
5. **Не трогать работающий код на gh-pages** - пока не протестируем

---

## 🚦 Следующий шаг

**Начать с ФАЗЫ 1**: Создать структуру папок и типы

Готовы начать? 🚀
