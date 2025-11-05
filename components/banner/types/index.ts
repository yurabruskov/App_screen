// TypeScript types for Banner Generator

export interface ScreenshotData {
  file: File | null;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

export interface VerticalOffset {
  combined: number;
  title: number;
  description: number;
  device: number;
}

export interface Rotation {
  device: number;
  title: number;
  description: number;
  textBlock: number;
}

export interface HorizontalOffset {
  combined: number;
  title: number;
  description: number;
}

export interface PreviewItem {
  id: number;
  name: string;
  backgroundColor: string;
  devicePosition: string;
  deviceScale: number;
  rotation?: Rotation;
  verticalOffset: VerticalOffset;
  horizontalOffset?: HorizontalOffset;
  screenshot: ScreenshotData;
  localizedScreenshots?: {
    [device: string]: {
      [languageCode: string]: ScreenshotData;
    };
  };
}

export interface LocalizedText {
  title: string;
  description: string;
  promotionalText?: string;
  whatsNew?: string;
  keywords?: string;
}

export interface LocalizedContent {
  [languageCode: string]: LocalizedText;
}

export interface BannerSettings {
  orientation: string;
  backgroundColor: string;
  titleColor: string;
  descriptionColor: string;
  fontFamily: string;
}

export interface FontSize {
  title: number;
  description: number;
}

export interface LineHeight {
  title: string | number;
  description: string | number;
}

export interface LetterSpacing {
  title: number;
  description: number;
}

export interface Project {
  id: number;
  name: string;
  createdAt: number;
}

export type DeviceType = "iphone" | "ipad";
export type ActiveElement = "banner" | "title" | "description" | "device";
export type TextAlignment = "left" | "center" | "right" | "justify";
