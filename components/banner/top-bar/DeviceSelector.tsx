"use client"

import type { DeviceType } from '../types';

interface DeviceSelectorProps {
  selectedDevice: DeviceType;
  onChange: (device: DeviceType) => void;
}

export function DeviceSelector({ selectedDevice, onChange }: DeviceSelectorProps) {
  return (
    <div className="flex rounded border border-[#1E1E1E] p-0.5 bg-[#1E1E1E]">
      <button
        onClick={() => onChange("iphone")}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          selectedDevice === "iphone"
            ? "bg-[#0D99FF] text-white"
            : "text-gray-400 hover:bg-[#3D3D3D] hover:text-gray-200"
        }`}
      >
        iPhone
      </button>
      <button
        onClick={() => onChange("ipad")}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          selectedDevice === "ipad"
            ? "bg-[#0D99FF] text-white"
            : "text-gray-400 hover:bg-[#3D3D3D] hover:text-gray-200"
        }`}
      >
        iPad
      </button>
    </div>
  );
}
