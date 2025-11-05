"use client"

import type { DeviceType } from '../types';

interface DeviceSelectorProps {
  selectedDevice: DeviceType;
  onChange: (device: DeviceType) => void;
}

export function DeviceSelector({ selectedDevice, onChange }: DeviceSelectorProps) {
  return (
    <div className="inline-flex items-center h-10 p-1 bg-gray-100 rounded-lg border border-gray-200">
      <button
        onClick={() => onChange("iphone")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          selectedDevice === "iphone"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        iPhone
      </button>
      <button
        onClick={() => onChange("ipad")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          selectedDevice === "ipad"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        iPad
      </button>
    </div>
  );
}
