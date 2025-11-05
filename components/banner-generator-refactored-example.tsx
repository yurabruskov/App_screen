"use client"

/**
 * ПРИМЕР рефакторированного BannerGenerator
 *
 * Это демонстрация того, как будет выглядеть главный компонент
 * после полного рефакторинга с использованием новых под-компонентов.
 *
 * Оригинальный файл: components/banner-generator.tsx (1905 строк)
 * Этот файл: ~150-200 строк (целевой размер)
 */

import { useState } from "react"
import { TopBar, useImageDB, useLocalStorage, type DeviceType } from "@/components/banner"
import { LANGUAGES, DEFAULT_SETTINGS } from "@/lib/constants"
import { Card, CardContent } from "@/components/ui/card"

export default function BannerGeneratorRefactored() {
  // ============================================
  // STATE MANAGEMENT (теперь через кастомные хуки)
  // ============================================

  const imageDB = useImageDB();
  const [device, setDevice] = useState<DeviceType>("iphone");
  const [activeLanguage, setActiveLanguage] = useState("en");

  // Использование кастомного хука для localStorage
  const [bannerSettings, setBannerSettings] = useLocalStorage(
    'bannerSettings',
    DEFAULT_SETTINGS
  );

  const [localizedContent, setLocalizedContent] = useLocalStorage(
    'localizedContent',
    { en: { title: "TEST TITLE", description: "TEST description" } }
  );

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleLanguageChange = (language: string) => {
    setActiveLanguage(language);

    // Create content for new language if it doesn't exist
    if (!localizedContent[language]) {
      setLocalizedContent({
        ...localizedContent,
        [language]: {
          title: localizedContent.en?.title || "Title",
          description: localizedContent.en?.description || "Description",
        },
      });
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      // TODO: Implement export logic
      // exportBanners(...);

      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setExportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ============================================ */}
      {/* TOP BAR - Вынесен в отдельный компонент */}
      {/* ============================================ */}
      <TopBar
        selectedDevice={device}
        onDeviceChange={setDevice}
        languages={LANGUAGES}
        activeLanguage={activeLanguage}
        onLanguageChange={handleLanguageChange}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onExportAll={handleExportAll}
      />

      {/* ============================================ */}
      {/* MAIN CONTENT AREA */}
      {/* ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* LEFT SIDE - Preview Panel */}
        {/* TODO: Вынести в PreviewPanel компонент */}
        <div>
          <Card>
            <CardContent className="p-6">
              <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">
                    {localizedContent[activeLanguage]?.title || "Title"}
                  </h2>
                  <p className="text-lg">
                    {localizedContent[activeLanguage]?.description || "Description"}
                  </p>
                  <div className="mt-4 text-sm opacity-75">
                    Device: {device.toUpperCase()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDE - Settings Panel */}
        {/* TODO: Вынести в SettingsPanel компонент */}
        <div>
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold">Settings</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Settings panel coming soon...
                </p>
                <p className="text-xs text-gray-500">
                  Current device: {device}
                </p>
                <p className="text-xs text-gray-500">
                  Current language: {activeLanguage}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================================ */}
      {/* DEVELOPMENT INFO */}
      {/* ============================================ */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">
          🎉 Рефакторинг в процессе!
        </h4>
        <p className="text-sm text-blue-800 mb-2">
          Этот файл демонстрирует новую структуру компонента.
        </p>
        <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
          <li>✅ TopBar component создан и работает</li>
          <li>✅ DeviceSelector вынесен отдельно</li>
          <li>✅ ExportAllButton вынесен отдельно</li>
          <li>✅ ImageDB вынесен в utils</li>
          <li>✅ Типы TypeScript созданы</li>
          <li>✅ Кастомные хуки созданы (useImageDB, useLocalStorage)</li>
          <li>🔄 TODO: PreviewPanel компонент</li>
          <li>🔄 TODO: SettingsPanel компонент</li>
          <li>🔄 TODO: Dialogs компоненты</li>
        </ul>
      </div>
    </div>
  );
}
