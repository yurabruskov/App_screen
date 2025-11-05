"use client"

import { DeviceSelector } from './DeviceSelector';
import { ExportAllButton } from './ExportAllButton';
import { LanguageSelector } from '@/components/language-selector';
import type { DeviceType } from '../types';

interface Language {
  code: string;
  name: string;
}

interface TopBarProps {
  selectedDevice: DeviceType;
  onDeviceChange: (device: DeviceType) => void;
  languages: Language[];
  activeLanguage: string;
  onLanguageChange: (language: string) => void;
  isExporting: boolean;
  exportProgress: number;
  onExportAll: () => void;
}

export function TopBar({
  selectedDevice,
  onDeviceChange,
  languages,
  activeLanguage,
  onLanguageChange,
  isExporting,
  exportProgress,
  onExportAll,
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-[#2C2C2C] rounded-lg">
      <div className="flex items-center gap-4">
        <DeviceSelector
          selectedDevice={selectedDevice}
          onChange={onDeviceChange}
        />
        <LanguageSelector
          languages={languages}
          activeLanguage={activeLanguage}
          onChange={onLanguageChange}
        />
      </div>
      <div className="flex items-center gap-2">
        <ExportAllButton
          isExporting={isExporting}
          exportProgress={exportProgress}
          onClick={onExportAll}
        />
      </div>
    </div>
  );
}
