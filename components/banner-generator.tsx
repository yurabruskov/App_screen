"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, ArrowDownToLine, Plus, Trash2, ImageIcon, Smartphone, Upload, Copy, AlignCenter, AlignLeft, AlignRight, AlignJustify, ChevronLeft, ChevronRight, Download } from "lucide-react"
import * as htmlToImage from 'html-to-image'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { LanguageSelector } from "@/components/language-selector"
import { LANGUAGES, DEFAULT_SETTINGS, DEVICE_POSITIONS } from "@/lib/constants"
import { ColorPicker } from "@/components/color-picker"
import html2canvas from 'html2canvas'

interface PreviewContent {
  title: string;
  description: string;
}

interface LocalizedPreview {
  [key: string]: PreviewContent;
}

interface LocalizedContent {
  [key: string]: {
    title: string;
    description: string;
    promotionalText: string;
    whatsNew: string;
    keywords: string;
    [key: string]: string;
  };
}

interface PreviewItem {
  id: number;
  name: string;
  backgroundColor: string;
  devicePosition: string;
  deviceScale: number;
  rotation?: {
    device: number;
    title: number;
    description: number;
    textBlock: number;
  };
  verticalOffset?: {
    combined: number;
    title: number;
    description: number;
    device: number;
  };
  horizontalOffset?: {
    combined: number;
    title: number;
    description: number;
  };
  screenshot: {
    file: File | null;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
  };
  localizedScreenshots?: {
    [languageCode: string]: {
      file: File | null;
      borderColor: string;
      borderWidth: number;
      borderRadius: number;
    };
  };
}

// Функция для получения скриншота с fallback на английский язык
const getCurrentScreenshot = (previewItem: PreviewItem, currentLanguage: string) => {
  // Сначала проверяем есть ли скриншот для текущего языка
  if (previewItem.localizedScreenshots?.[currentLanguage]?.file) {
    return previewItem.localizedScreenshots[currentLanguage];
  }

  // Fallback на английский
  if (previewItem.localizedScreenshots?.en?.file) {
    return previewItem.localizedScreenshots.en;
  }

  // Fallback на общий скриншот
  return previewItem.screenshot;
};

// Класс для работы с IndexedDB
class ImageDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'bannerGeneratorDB';
  private readonly storeName = 'screenshots';
  private readonly version = 1;

  constructor() {
    this.initDB();
  }

  // Инициализация базы данных
  public initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.error('Ваш браузер не поддерживает IndexedDB');
        reject('IndexedDB не поддерживается');
        return;
      }

      const request = window.indexedDB.open(this.dbName, this.version);

      request.onerror = (event) => {
        console.error('Ошибка при открытии базы данных', event);
        reject('Ошибка при открытии базы данных');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Используем id как явный ключ (keyPath), а не автоинкремент
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  // Сохранить изображение в базу данных
  public async saveImage(id: string, file: File): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            // Убедимся, что id является явным ключом объекта, соответствующим keyPath
            const imageData = {
              id: id,  // Явно присваиваем id для соответствия keyPath
              data: reader.result,
              type: file.type,
              lastModified: new Date().getTime()
            };
            
            // put с одним параметром - IndexedDB будет использовать id из объекта как ключ
            const request = store.put(imageData);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => {
              console.error("Error putting data in IndexedDB:", event);
              reject(event);
            };
          } catch (err) {
            console.error("Catch error in transaction:", err);
            reject(err);
          }
        };
        
        reader.onerror = (event) => reject(event);
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Outer catch error:", err);
        reject(err);
      }
    });
  }

  // Получить изображение из базы данных
  public async getImage(id: string): Promise<File | null> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);
        
        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve(null);
            return;
          }
          
          // Преобразование data URL обратно в File
          const binary = atob((result.data as string).split(',')[1]);
          const array = [];
          for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
          }
          const blob = new Blob([new Uint8Array(array)], { type: result.type });
          const file = new File([blob], `preview_${id}.${result.type.split('/')[1]}`, { 
            type: result.type, 
            lastModified: result.lastModified 
          });
          
          resolve(file);
        };
        
        request.onerror = (event) => reject(event);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Удалить изображение из базы данных
  public async deleteImage(id: string): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Очистить всю базу данных
  public async clearAll(): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event);
      } catch (err) {
        reject(err);
      }
    });
  }
}

// В начале файла, после импортов добавим массив шрифтов
const FONTS = [
  { value: "SF Pro", label: "SF Pro" },
  { value: "SF Pro Display", label: "SF Pro Display" },
  { value: "SF Pro Text", label: "SF Pro Text" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Helvetica Neue", label: "Helvetica Neue" },
  { value: "Roboto", label: "Roboto" },
  { value: "Inter", label: "Inter" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Poppins", label: "Poppins" },
  { value: "Lato", label: "Lato" }
];

// После импортов добавляем новый компонент
interface NumberInputWithSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  className?: string;
}

const NumberInputWithSlider = ({ value, onChange, min, max, step = 1, unit, className = "" }: NumberInputWithSliderProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([newValue]) => onChange(newValue)}
          className="w-full"
        />
      </div>
      <div className="flex items-center gap-1 min-w-[90px]">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            if (!isNaN(newValue)) {
              onChange(Math.min(Math.max(newValue, min), max));
            }
          }}
          className="w-[60px] h-6 px-2 text-[10px] font-mono"
          min={min}
          max={max}
          step={step}
        />
        {unit && <span className="text-[10px] font-mono text-gray-500">{unit}</span>}
      </div>
    </div>
  );
};

export default function BannerGenerator() {
  const [activeLanguage, setActiveLanguage] = useState("ru")
  const [bannerSettings, setBannerSettings] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedSettings = localStorage.getItem('bannerSettings');
        if (savedSettings) {
          return JSON.parse(savedSettings);
        }
      } catch (e) {
        console.error('Error loading initial banner settings:', e);
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [localizedContent, setLocalizedContent] = useState<LocalizedContent>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedContent = localStorage.getItem('localizedContent');
        if (savedContent) {
          return JSON.parse(savedContent);
        }
      } catch (e) {
        console.error('Error loading initial localized content:', e);
      }
    }
    
    // Значение по умолчанию
    return {
      ru: { 
        title: "Новое приложение",
        description: "Описание приложения",
        promotionalText: "Рекламный текст",
        whatsNew: "Что нового в этой версии",
        keywords: "приложение, ключевые, слова"
      }
    };
  });
  const [isExporting, setIsExporting] = useState(false)
  const [jsonImportText, setJsonImportText] = useState("")
  const [exportingProgress, setExportingProgress] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [textAlignment, setTextAlignment] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedAlignment = localStorage.getItem('textAlignment');
        if (savedAlignment) {
          console.log("Loaded initial text alignment from localStorage:", savedAlignment);
          return savedAlignment;
        }
      } catch (e) {
        console.error('Error loading initial text alignment:', e);
      }
    }
    return 'center'; // значение по умолчанию
  });
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedFontSize = localStorage.getItem('fontSize');
        if (savedFontSize) {
          console.log("Loaded initial font size from localStorage");
          return JSON.parse(savedFontSize);
        }
      } catch (e) {
        console.error('Error loading initial font size:', e);
      }
    }
    return { title: 24, description: 16 };
  });
  const [lineHeight, setLineHeight] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedLineHeight = localStorage.getItem('lineHeight');
        if (savedLineHeight) {
          console.log("Loaded initial line height from localStorage");
          return JSON.parse(savedLineHeight);
        }
      } catch (e) {
        console.error('Error loading initial line height:', e);
      }
    }
    return { title: "auto", description: "auto" };
  });
  const [letterSpacing, setLetterSpacing] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedLetterSpacing = localStorage.getItem('letterSpacing');
        if (savedLetterSpacing) {
          console.log("Loaded initial letter spacing from localStorage");
          return JSON.parse(savedLetterSpacing);
        }
      } catch (e) {
        console.error('Error loading initial letter spacing:', e);
      }
    }
    return { title: 0, description: 0 };
  });
  const canvasRef = useRef(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Укажем тип для ref
  const [activeElement, setActiveElement] = useState("banner") // banner, title, description, device
  
  // Состояние для отслеживания перетаскиваемого элемента
  const [draggingElementInfo, setDraggingElementInfo] = useState<{
    bannerId: number;
    elementType: "title" | "description" | "device" | "text-block";
    initialMouseX: number;
    initialMouseY: number;
    initialElementOffsetX: number;
    initialElementOffsetY: number;
  } | null>(null);
  
  // Создаем экземпляр ImageDB
  const imageDBRef = useRef<ImageDB | null>(null);

  // Инициализация IndexedDB при монтировании компонента
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Создаем экземпляр ImageDB только один раз
      if (!imageDBRef.current) {
        imageDBRef.current = new ImageDB();
        // Явно инициализируем базу данных
        imageDBRef.current.initDB().catch(err => 
          console.error('Ошибка при инициализации IndexedDB:', err)
        );
      }
    }
    
    // Очистка при размонтировании
    return () => {
      // Нет необходимости в особой очистке
    };
  }, []);

  // Обновим установку начальных значений, добавим проверку localStorage перед установкой дефолтного состояния
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>(() => {
    // Попробуем загрузить из localStorage при инициализации
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedItems = localStorage.getItem('previewItems');
        if (savedItems) {
          const parsedItems = JSON.parse(savedItems);
          console.log("Loaded initial preview items from localStorage", parsedItems);
          if (Array.isArray(parsedItems) && parsedItems.length > 0) {
            return parsedItems;
          }
        }
      } catch (e) {
        console.error('Error loading initial preview items:', e);
      }
    }
    
    // Если не удалось загрузить, используем значение по умолчанию
    return [
      {
        id: 1,
        name: "Preview 1",
        backgroundColor: "#FFD700",
        devicePosition: "center",
        deviceScale: 100,
        rotation: {
          device: 0,
          title: 0,
          description: 0,
          textBlock: 0
        },
        verticalOffset: {
          combined: 0,
          title: 0,
          description: 0,
          device: 0
        },
        horizontalOffset: {
          combined: 0,
          title: 0,
          description: 0
        },
        screenshot: {
          file: null,
          borderColor: "#000000",
          borderWidth: 8,
          borderRadius: 30
        }
      }
    ];
  });

  // Замените старый хук загрузки данных из localStorage на этот
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    console.log("Checking for additional data in localStorage");
    
    // Загружаем только недостающие данные, не трогая previewItems и bannerSettings,
    // так как они уже были загружены в useState
    try {
      const savedContent = localStorage.getItem('localizedContent');
      if (savedContent) {
        const parsedContent = JSON.parse(savedContent);
        setLocalizedContent(parsedContent);
      }
      
      const savedAlignment = localStorage.getItem('textAlignment');
      if (savedAlignment) {
        setTextAlignment(savedAlignment);
      }
      
      const savedFontSize = localStorage.getItem('fontSize');
      if (savedFontSize) {
        setFontSize(JSON.parse(savedFontSize));
      }
      
      const savedLineHeight = localStorage.getItem('lineHeight');
      if (savedLineHeight) {
        setLineHeight(JSON.parse(savedLineHeight));
      }
      
      const savedLetterSpacing = localStorage.getItem('letterSpacing');
      if (savedLetterSpacing) {
        setLetterSpacing(JSON.parse(savedLetterSpacing));
      }
    } catch (e) {
      console.error('Error loading additional data from localStorage:', e);
    }
  }, []);

  // Обновим функцию сохранения previewItems
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!previewItems) return;
    
    try {
      console.log("Saving previewItems to localStorage", previewItems.length);
      // Создаем копию превью без файлов для сохранения
      const previewsForStorage = previewItems.map(item => ({
        ...item,
        screenshot: {
          ...item.screenshot,
          file: null // Не сохраняем файлы, так как они не могут быть сериализованы
        }
      }));
      localStorage.setItem('previewItems', JSON.stringify(previewsForStorage));
    } catch (error) {
      console.error('Error saving preview items:', error);
    }
  }, [previewItems]);

  // После того как previewItems загружены, инициализируем базу данных и загружаем изображения
  useEffect(() => {
    console.log("Initializing IndexedDB and loading images");
    // Инициализируем базу данных
    if (!imageDBRef.current) {
      imageDBRef.current = new ImageDB();
    }
    
    const loadImagesFromDB = async () => {
      console.log("Loading images from IndexedDB...");
      if (!imageDBRef.current) return;

      try {
        // Загружаем изображения для всех превью
        const updatedItems = [...previewItems];
        let hasChanges = false;

        for (let i = 0; i < previewItems.length; i++) {
          const item = previewItems[i];

          // Загружаем основной скриншот (fallback)
          const imageId = `preview_${item.id}_default`;
          try {
            const imageFile = await imageDBRef.current.getImage(imageId);
            if (imageFile) {
              console.log(`Loaded default image for preview ${imageId}`);
              updatedItems[i] = {
                ...updatedItems[i],
                screenshot: {
                  ...updatedItems[i].screenshot,
                  file: imageFile
                }
              };
              hasChanges = true;
            }
          } catch (error) {
            console.error(`Error loading default image for ${imageId}:`, error);
          }

          // Загружаем локализованные скриншоты
          if (!updatedItems[i].localizedScreenshots) {
            updatedItems[i].localizedScreenshots = {};
          }

          for (const lang of LANGUAGES) {
            const langImageId = `preview_${item.id}_${lang.code}`;
            try {
              const langImageFile = await imageDBRef.current.getImage(langImageId);
              if (langImageFile) {
                console.log(`Loaded localized image for ${langImageId}`);
                updatedItems[i].localizedScreenshots![lang.code] = {
                  file: langImageFile,
                  borderColor: item.screenshot.borderColor,
                  borderWidth: item.screenshot.borderWidth,
                  borderRadius: item.screenshot.borderRadius,
                };
                hasChanges = true;
              }
            } catch (error) {
              console.error(`Error loading localized image for ${langImageId}:`, error);
            }
          }
        }
        
        // Обновляем состояние только если были изменения
        if (hasChanges) {
          setPreviewItems(updatedItems);
        }
      } catch (error) {
        console.error("Error loading images from IndexedDB:", error);
      }
    };
    
    // Загружаем изображения только если есть превью
    if (previewItems.length > 0) {
      loadImagesFromDB();
    }
  }, [previewItems.length]); // Запускаем только при изменении количества превью

  // Обновляем все хуки сохранения, чтобы они были консистентными
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!localizedContent) return;
    
    try {
      localStorage.setItem('localizedContent', JSON.stringify(localizedContent));
    } catch (error) {
      console.error('Error saving localized content:', error);
    }
  }, [localizedContent]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!bannerSettings) return;
    
    try {
      localStorage.setItem('bannerSettings', JSON.stringify(bannerSettings));
    } catch (error) {
      console.error('Error saving banner settings:', error);
    }
  }, [bannerSettings]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!textAlignment) return;
    
    try {
      localStorage.setItem('textAlignment', textAlignment);
    } catch (error) {
      console.error('Error saving text alignment:', error);
    }
  }, [textAlignment]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!fontSize) return;
    
    try {
      localStorage.setItem('fontSize', JSON.stringify(fontSize));
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  }, [fontSize]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!lineHeight) return;
    
    try {
      localStorage.setItem('lineHeight', JSON.stringify(lineHeight));
    } catch (error) {
      console.error('Error saving line height:', error);
    }
  }, [lineHeight]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!letterSpacing) return;
    
    try {
      localStorage.setItem('letterSpacing', JSON.stringify(letterSpacing));
    } catch (error) {
      console.error('Error saving letter spacing:', error);
    }
  }, [letterSpacing]);

  // Handle language change
  const handleLanguageChange = (language: string) => {
    setActiveLanguage(language)
    
    // Create language content if it doesn't exist
    if (!localizedContent[language]) {
      const newLocalizedContent = { ...localizedContent }
      newLocalizedContent[language] = {
        title: "",
        description: "",
        promotionalText: "",
        whatsNew: "",
        keywords: ""
      }
      setLocalizedContent(newLocalizedContent)
    }
  }

  const updateLocalizedContent = (language: string, field: keyof LocalizedContent, value: string) => {
    const newLocalizedContent = { ...localizedContent }
    if (!newLocalizedContent[language]) {
      newLocalizedContent[language] = {
        title: "",
        description: "",
        promotionalText: "",
        whatsNew: "",
        keywords: ""
      }
    }
    newLocalizedContent[language][field] = value
    setLocalizedContent(newLocalizedContent)
  }

  // Функция для получения глобального контента
  const getGlobalContent = (langCode: string, field: string): string => {
    // Проверяем наличие языковых данных
    if (!localizedContent[langCode]) {
      return "";
    }

    // Возвращаем глобальный контент
    return localizedContent[langCode]?.[field] || "";
  };

  // Обновляем функцию getPreviewContent для работы только с контентом баннеров
  const getPreviewContent = (langCode: string, previewId: number, field: string): string => {
    // Проверяем наличие языковых данных
    if (!localizedContent[langCode]) {
      return "";
    }

    // Формируем ключ для контента баннера
    const previewKey = `preview_${previewId}_${field}`;
    
    // Возвращаем контент баннера или пустую строку
    return localizedContent[langCode]?.[previewKey] || "";
  };

  // Полностью заменяем эту функцию
  const handleScreenshotUpload = (file: File, forLanguage: string = activeLanguage) => {
    // Для отладки
    console.log("Starting upload for preview: ", previewIndex, "for language:", forLanguage);
    console.log("With position: ", previewItems[previewIndex]?.devicePosition);

    // Вместо создания копии, модифицируем существующий элемент
    const newItems = [...previewItems];

    if (newItems[previewIndex]) {
      // Сохраняем ссылку на элемент
      const item = newItems[previewIndex];

      // Инициализируем localizedScreenshots если его нет
      if (!item.localizedScreenshots) {
        item.localizedScreenshots = {};
      }

      // Если загружаем для текущего языка, сохраняем в localizedScreenshots
      if (forLanguage !== 'default') {
        item.localizedScreenshots[forLanguage] = {
          file,
          borderColor: item.screenshot.borderColor,
          borderWidth: item.screenshot.borderWidth,
          borderRadius: item.screenshot.borderRadius,
        };
      } else {
        // Для default сохраняем в основной screenshot (fallback)
        item.screenshot = {
          ...item.screenshot,
          file
        };
      }

      // Устанавливаем новое состояние
      setPreviewItems(newItems);

      // Сохраняем в IndexedDB
      if (imageDBRef.current) {
        const imageId = `preview_${item.id}_${forLanguage}`;
        imageDBRef.current.saveImage(imageId, file)
          .catch(error => console.error('Error saving image to IndexedDB:', error));
      }

      console.log("Upload complete, position should still be:", item.devicePosition);
    }
  };

  // Add new preview
  const addPreview = () => {
    const newId = previewItems.length > 0 ? Math.max(...previewItems.map((p) => p.id)) + 1 : 1
    const colors = ["#FFD700", "#F5F5DC", "#FF6347", "#FFDAB9", "#87CEEB", "#98FB98", "#DDA0DD", "#F0E68C"]
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    setPreviewItems([
      ...previewItems,
      {
        id: newId,
        name: `Preview ${newId}`,
        backgroundColor: randomColor,
        devicePosition: "center",
        deviceScale: 100,
        verticalOffset: {
          combined: 0,
          title: 0,
          description: 0,
          device: 0,
        },
        horizontalOffset: {
          combined: 0,
          title: 0,
          description: 0
        },
        screenshot: {
          file: null,
          borderColor: "#000000",
          borderWidth: 8,
          borderRadius: 30,
        },
      },
    ])

    // Scroll to the new banner after it's added
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth
      }
    }, 100)
  }

  // Duplicate preview
  const duplicatePreview = (id) => {
    const previewToDuplicate = previewItems.find((p) => p.id === id)
    if (!previewToDuplicate) return

    const newId = previewItems.length > 0 ? Math.max(...previewItems.map((p) => p.id)) + 1 : 1

    // Create a new preview with the same settings
    const newPreview = {
      ...previewToDuplicate,
      id: newId,
      name: `Preview ${newId}`,
      screenshot: {
        ...previewToDuplicate.screenshot,
        file: previewToDuplicate.screenshot.file ? previewToDuplicate.screenshot.file : null,
      },
    }

    // Add the new preview
    setPreviewItems([...previewItems, newPreview])

    // Duplicate localized content for all languages
    const newLocalizedContent = { ...localizedContent }

    Object.keys(newLocalizedContent).forEach((langCode) => {
      // Copy title and description from the original preview
      const originalTitleKey = `preview_${id}_title`
      const originalDescKey = `preview_${id}_description`
      const newTitleKey = `preview_${newId}_title`
      const newDescKey = `preview_${newId}_description`

      if (newLocalizedContent[langCode]) {
        newLocalizedContent[langCode][newTitleKey] =
          newLocalizedContent[langCode][originalTitleKey] || newLocalizedContent[langCode].title || ""

        newLocalizedContent[langCode][newDescKey] =
          newLocalizedContent[langCode][originalDescKey] || newLocalizedContent[langCode].description || ""
      }
    })

    setLocalizedContent(newLocalizedContent)

    // Switch to the new preview
    setPreviewIndex(previewItems.length)

    // Scroll to the new banner after it's added
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth
      }
    }, 100)
  }

  // Модифицируем removePreview для удаления изображений из IndexedDB
  const removePreview = (id: number) => {
    if (previewItems.length <= 1) return; // Don't remove the last preview

    // Удаляем изображение из IndexedDB
    if (imageDBRef.current) {
      const imageId = `preview_${id}`;
      imageDBRef.current.deleteImage(imageId)
        .catch(error => console.error('Error deleting image from IndexedDB:', error));
    }

    const newPreviewItems = previewItems.filter((p) => p.id !== id);
    setPreviewItems(newPreviewItems);

    // Adjust preview index if needed
    if (previewIndex >= newPreviewItems.length) {
      setPreviewIndex(newPreviewItems.length - 1);
    }
  };

  // Update preview settings
  const updatePreview = (id, field, value) => {
    setPreviewItems(previewItems.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  // Update screenshot settings
  const updateScreenshotSetting = (field, value) => {
    const updatedItems = [...previewItems]
    if (updatedItems[previewIndex]) {
      updatedItems[previewIndex] = {
        ...updatedItems[previewIndex],
        screenshot: {
          ...updatedItems[previewIndex].screenshot,
          [field]: value,
        },
      }
      setPreviewItems(updatedItems)
    }
  }

  // Полностью переписываем функцию getDevicePositionStyles с более выраженным позиционированием
  const getDevicePositionStyles = (banner) => {
    // Проверка наличия объекта баннера
    if (!banner) {
      return {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "220px",
      };
    }
    
    // Получаем значения с проверкой наличия
    const devicePosition = banner.devicePosition || "center";
    const deviceScale = banner.deviceScale || 100;
    const deviceOffset = banner.verticalOffset?.device || 0;
    const deviceRotation = banner.rotation?.device || 0;
    
    // Базовая ширина устройства
    const baseWidth = 220;
    const width = `${(baseWidth * deviceScale) / 100}px`;
    
    // Объект стилей для различных позиций с более контрастными значениями
    let styles = {
      position: "absolute",
      width
    };
    
    // Определяем позицию в зависимости от выбранного значения
    // Более контрастное позиционирование для большей различимости
    switch (devicePosition) {
      case "top-left":
        styles = {
          ...styles,
          top: "-35%", // Устройство будет выступать на 85% сверху
          left: "-15%", // Устройство будет выступать на 15% слева
          transform: `translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      case "top-center":
        styles = {
          ...styles,
          top: "-35%", // Устройство будет выступать на 85% сверху
          left: "50%",
          transform: `translateX(-50%) translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      case "top-right":
        styles = {
          ...styles,
          top: "-35%", // Устройство будет выступать на 85% сверху
          right: "-15%", // Устройство будет выступать на 15% справа
          transform: `translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      case "center-left":
        styles = {
          ...styles,
          top: "50%",
          left: "-25%", // Устройство будет выступать на 25% слева
          transform: `translateY(-50%) translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      case "center":
        styles = {
          ...styles,
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`,
          zIndex: "10", // Добавляем z-index, чтобы устройство было поверх текста
          maxWidth: "75%", // Ограничиваем максимальную ширину для лучшего вида
          margin: "0 auto" // Центрируем горизонтально
        };
        break;
      case "center-right":
        styles = {
          ...styles,
          top: "50%",
          right: "-25%", // Устройство будет выступать на 25% справа
          transform: `translateY(-50%) translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      case "bottom-left":
        styles = {
          ...styles,
          bottom: "-35%", // Устройство будет выступать на 85% снизу
          left: "-15%", // Устройство будет выступать на 15% слева
          transform: `translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      case "bottom-center":
        styles = {
          ...styles,
          bottom: "-35%", // Устройство будет выступать на 85% снизу
          left: "50%",
          transform: `translateX(-50%) translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      case "bottom-right":
        styles = {
          ...styles,
          bottom: "-35%", // Устройство будет выступать на 85% снизу
          right: "-15%", // Устройство будет выступать на 15% справа
          transform: `translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
        break;
      default:
        styles = {
          ...styles,
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
        };
    }
    
    return styles;
  };

  // Get title and description positions based on device position
  const getContentPositions = (devicePosition) => {
    // Default positions
    let titlePosition = {}
    let descriptionPosition = {}
    let separateElements = false

    // If device is centered, title at top and description below device
    if (devicePosition === "center") {
      // Title at the top
      titlePosition = {
        top: "8%",  // Увеличиваем отступ сверху
        left: "50%",
        transform: "translateX(-50%)",
        width: "250px",
        textAlign: "center",
        zIndex: "5"  // Обеспечиваем отображение поверх фона
      }

      // Description at the bottom, гарантированно под устройством
      descriptionPosition = {
        bottom: "15%",  // Увеличиваем отступ снизу для большей заметности
        left: "50%",
        transform: "translateX(-50%)",
        width: "250px",
        textAlign: "center",
        zIndex: "5"  // Обеспечиваем отображение поверх фона
      }

      separateElements = true
      return { titlePosition, descriptionPosition, separateElements }
    }

    // If device is at the top, put content at the bottom
    else if (devicePosition.startsWith("top")) {
      titlePosition = { bottom: "15%", left: "50%", transform: "translateX(-50%)", width: "250px" }
      descriptionPosition = {}
      separateElements = false
      return {
        titlePosition,
        descriptionPosition,
        separateElements,
      }
    }

    // If device is at the bottom, put content at the top
    else if (devicePosition.startsWith("bottom")) {
      titlePosition = { top: "15%", left: "50%", transform: "translateX(-50%)", width: "250px" }
      descriptionPosition = {}
      separateElements = false
      return {
        titlePosition,
        descriptionPosition,
        separateElements,
      }
    }

    // If device is on the left, put content on the right
    else if (devicePosition.endsWith("left")) {
      titlePosition = { top: "50%", right: "15%", transform: "translateY(-50%)", width: "250px" }
      descriptionPosition = {}
      separateElements = false
      return {
        titlePosition,
        descriptionPosition,
        separateElements,
      }
    }

    // If device is on the right, put content on the left
    else if (devicePosition.endsWith("right")) {
      titlePosition = { top: "50%", left: "15%", transform: "translateY(-50%)", width: "250px" }
      descriptionPosition = {}
      separateElements = false
      return {
        titlePosition,
        descriptionPosition,
        separateElements,
      }
    }

    // Default fallback
    titlePosition = { top: "15%", left: "50%", transform: "translateX(-50%)", width: "250px" }
    descriptionPosition = {}
    separateElements = false
    return {
      titlePosition,
      descriptionPosition,
      separateElements,
    }
  }

  // Обновляем функции для импорта JSON
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    try {
      const file = event.target.files[0];
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Проверяем структуру данных
      if (!data.global || !data.banners) {
        throw new Error('Неверный формат JSON: отсутствуют разделы global или banners');
      }
      
      // Создаем новый объект для локализованного контента
      const newLocalizedContent: LocalizedContent = {};
      
      // Обрабатываем глобальные данные
      Object.entries(data.global).forEach(([langCode, content]: [string, any]) => {
        if (!newLocalizedContent[langCode]) {
          // Создаем структуру для нового языка
          newLocalizedContent[langCode] = {
            title: "",
            description: "",
            promotionalText: "",
            whatsNew: "",
            keywords: ""
          };
        }
        
        // Копируем глобальные поля
        newLocalizedContent[langCode] = {
          ...newLocalizedContent[langCode],
          title: content.title || "",
          description: content.description || "",
          promotionalText: content.promotionalText || "",
          whatsNew: content.whatsNew || "",
          keywords: content.keywords || ""
        };
      });
      
      // Обрабатываем данные баннеров
      Object.entries(data.banners).forEach(([langCode, banners]: [string, any]) => {
        if (!newLocalizedContent[langCode]) {
          // Создаем структуру для нового языка
          newLocalizedContent[langCode] = {
            title: "",
            description: "",
            promotionalText: "",
            whatsNew: "",
            keywords: ""
          };
        }
        
        // Копируем данные каждого баннера
        Object.entries(banners).forEach(([previewKey, content]: [string, any]) => {
          // Добавляем данные баннера как дополнительные поля
          newLocalizedContent[langCode][`${previewKey}_title`] = content.title || "";
          newLocalizedContent[langCode][`${previewKey}_description`] = content.description || "";
        });
      });
      
      // Обновляем состояние
      setLocalizedContent(newLocalizedContent);
      
      // Очищаем поле файла
      event.target.value = '';
      
      alert('JSON успешно импортирован!');
    } catch (error) {
      console.error('Ошибка при импорте JSON:', error);
      alert('Ошибка при импорте JSON. Проверьте формат файла.');
    }
  };

  const handleImportFromText = () => {
    try {
      const data = JSON.parse(jsonImportText);
      
      // Проверяем структуру данных
      if (!data.global || !data.banners) {
        throw new Error('Неверный формат JSON: отсутствуют разделы global или banners');
      }
      
      // Создаем новый объект для локализованного контента
      const newLocalizedContent: LocalizedContent = {};
      
      // Обрабатываем глобальные данные
      Object.entries(data.global).forEach(([langCode, content]: [string, any]) => {
        if (!newLocalizedContent[langCode]) {
          // Создаем структуру для нового языка
          newLocalizedContent[langCode] = {
            title: "",
            description: "",
            promotionalText: "",
            whatsNew: "",
            keywords: ""
          };
        }
        
        // Копируем глобальные поля
        newLocalizedContent[langCode] = {
          ...newLocalizedContent[langCode],
          title: content.title || "",
          description: content.description || "",
          promotionalText: content.promotionalText || "",
          whatsNew: content.whatsNew || "",
          keywords: content.keywords || ""
        };
      });
      
      // Обрабатываем данные баннеров
      Object.entries(data.banners).forEach(([langCode, banners]: [string, any]) => {
        if (!newLocalizedContent[langCode]) {
          // Создаем структуру для нового языка
          newLocalizedContent[langCode] = {
            title: "",
            description: "",
            promotionalText: "",
            whatsNew: "",
            keywords: ""
          };
        }
        
        // Копируем данные каждого баннера
        Object.entries(banners).forEach(([previewKey, content]: [string, any]) => {
          // Добавляем данные баннера как дополнительные поля
          newLocalizedContent[langCode][`${previewKey}_title`] = content.title || "";
          newLocalizedContent[langCode][`${previewKey}_description`] = content.description || "";
        });
      });
      
      // Обновляем состояние
      setLocalizedContent(newLocalizedContent);
      
      // Очищаем поле ввода
      setJsonImportText('');
      
      alert('JSON успешно импортирован!');
    } catch (error) {
      console.error('Ошибка при импорте JSON:', error);
      alert('Ошибка при импорте JSON. Проверьте формат текста.');
    }
  };

  // Handle JSON import
  const handleJsonImport = () => {
    try {
      const importedData = JSON.parse(jsonImportText)

      // Check if the imported data has the expected structure
      if (typeof importedData === "object" && importedData !== null) {
        // Validate the structure
        const isValidStructure = Object.entries(importedData).every(([langCode, content]) => {
          const isValidLanguage = LANGUAGES.some(lang => lang.code === langCode)
          const hasRequiredFields = content && typeof content === "object" &&
            "title" in content && typeof content.title === "string" &&
            "description" in content && typeof content.description === "string" &&
            "promotionalText" in content && typeof content.promotionalText === "string" &&
            "whatsNew" in content && typeof content.whatsNew === "string" &&
            "keywords" in content && typeof content.keywords === "string"
          
          return isValidLanguage && hasRequiredFields
        })

        if (isValidStructure) {
          setLocalizedContent(importedData as Record<string, LocalizedContent>)
        } else {
          alert("Invalid JSON structure. Please ensure all languages have the required fields: title, description, promotionalText, whatsNew, and keywords.")
        }
      } else {
        alert("Invalid JSON format. Please provide a valid object.")
      }
    } catch (error) {
      alert(`Error parsing JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Update the useEffect that handles drag and drop
  useEffect(() => {
    const highlightDropTargets = (show) => {
      const bannerDevices = document.querySelectorAll('.banner-device-target');
      bannerDevices.forEach((element) => {
        if (show) {
          element.classList.add('drag-highlight');
        } else {
          element.classList.remove('drag-highlight');
        }
      });
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Highlight all potential drop targets when dragging over the window
      highlightDropTargets(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      // Only remove highlights if we're leaving the window
      if (!e.relatedTarget) {
        highlightDropTargets(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Remove highlights
      highlightDropTargets(false);
      
      // Check if we have files
      if (!e.dataTransfer?.files || !e.dataTransfer.files[0]) {
        return;
      }
      
      const file = e.dataTransfer.files[0];
      
      // Find which banner device element was dropped on
      const targetElement = findDropTarget(e);
      if (targetElement) {
        const bannerId = parseInt(targetElement.dataset.bannerId || "-1");
        if (bannerId >= 0) {
          // Set the active preview to the target banner
          setPreviewIndex(bannerId);
          
          // Upload the screenshot to the target banner
          uploadScreenshotToBanner(file, bannerId);
          return;
        }
      }
      
      // Default to current active banner if no specific target found
      handleScreenshotUpload(file);
    };
    
    // Helper function to find which banner device the drop occurred on
    const findDropTarget = (e: DragEvent) => {
      // Get all potential drop targets
      const dropTargets = document.querySelectorAll('.banner-device-target');
      
      // Check each drop target to see if the drop point is within its bounds
      for (const target of dropTargets) {
        const rect = target.getBoundingClientRect();
        // Check if drop coordinates are within this element's bounds
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return target;
        }
      }
      return null;
    };
    
    // Helper function to upload a screenshot to a specific banner
    const uploadScreenshotToBanner = (file: File, bannerIndex: number) => {
      console.log(`Uploading screenshot to banner ${bannerIndex}`);
      
      const newItems = [...previewItems];
      
      if (newItems[bannerIndex]) {
        const item = newItems[bannerIndex];
        
        item.screenshot = {
          ...item.screenshot,
          file
        };
        
        setPreviewItems(newItems);
        
        // Save to IndexedDB
        if (imageDBRef.current) {
          const imageId = `preview_${item.id}`;
          imageDBRef.current.saveImage(imageId, file)
            .catch(error => console.error('Error saving image to IndexedDB:', error));
        }
      }
    };

    // Add event listeners to the window
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    // Clean up
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [previewIndex, previewItems]); // Keep dependencies as before

  // Добавляем состояние для выбора локалей при экспорте
  const [selectedLocales, setSelectedLocales] = useState(() => {
    return LANGUAGES.reduce((acc, lang) => {
      acc[lang.code] = true; // По умолчанию выбраны все
      return acc;
    }, {});
  });
  
  // Функция для переключения выбора локали
  const toggleLocaleSelection = (langCode) => {
    setSelectedLocales(prev => ({
      ...prev,
      [langCode]: !prev[langCode]
    }));
  };
  
  // Функция для выбора/отмены выбора всех локалей
  const toggleAllLocales = (selectAll) => {
    const newSelection = {};
    LANGUAGES.forEach(lang => {
      newSelection[lang.code] = selectAll;
    });
    setSelectedLocales(newSelection);
  };

  // Полностью переписываем функцию handleExport
  const handleExport = async () => {
    setIsExporting(true);
    setExportingProgress(0);
    
    try {
      console.log("Начинаем процесс экспорта...");
      
      // Проверяем, инициализирована ли IndexedDB
      if (!imageDBRef.current) {
        console.log("Инициализируем IndexedDB...");
        imageDBRef.current = new ImageDB();
        // Ждем инициализации
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Создаем zip-архив
      const zip = new JSZip();
      
      // Отбираем только выбранные языки
      const selectedLanguages = Object.keys(selectedLocales).filter(lang => selectedLocales[lang]);
      if (selectedLanguages.length === 0) {
        alert("Пожалуйста, выберите хотя бы один язык для экспорта");
        setIsExporting(false);
        return;
      }
      
      console.log("Выбранные языки для экспорта:", selectedLanguages);
      
      const totalBanners = previewItems.length * selectedLanguages.length;
      let processedBanners = 0;
      
      // Сохраняем текущий язык и индекс
      const originalLang = activeLanguage;
      const originalIndex = previewIndex;
      
      // Создаем папки для каждого языка
      for (const langCode of selectedLanguages) {
        const langFolder = zip.folder(langCode);
        if (!langFolder) continue;
        
        // Перебираем все баннеры
        for (let i = 0; i < previewItems.length; i++) {
          try {
            // Устанавливаем текущий язык и индекс
            setActiveLanguage(langCode);
            setPreviewIndex(i);
            
            // Даем время на обновление интерфейса
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const banner = previewItems[i];
            console.log(`Экспорт баннера #${banner.id} для языка ${langCode}`);
            
            // Получаем DOM-элемент баннера
            const previewElement = document.getElementById(`preview-${banner.id}`);
            if (!previewElement) {
              console.error(`Не найден элемент с ID preview-${banner.id}`);
              continue;
            }
            
            // Создаем копию элемента для экспорта
            const exportElement = previewElement.cloneNode(true);
            document.body.appendChild(exportElement);
            
            try {
              // Удаляем элементы управления из копии
              const controlButtons = exportElement.querySelectorAll('.banner-controls, .banner-edit-icons, button');
              controlButtons.forEach(el => el.parentNode?.removeChild(el));
              
              // Удаляем hover-эффекты
              exportElement.querySelectorAll('[class*="hover:"]').forEach(el => {
                const element = el;
                const classes = element.className.split(' ').filter(cls => !cls.includes('hover:'));
                element.className = classes.join(' ');
              });
              
              // НЕ удаляем рамки и тени для девайса
              const nonDeviceElements = exportElement.querySelectorAll('.banner-content');
              nonDeviceElements.forEach(el => {
                if (el instanceof HTMLElement) {
                  el.classList.remove('border', 'border-blue-500', 'shadow-xl');
                }
              });
              
              // Устанавливаем стили для экспорта
              exportElement.style.position = 'absolute';
              exportElement.style.left = '-9999px';
              exportElement.style.top = '0';
              exportElement.style.zIndex = '-1';
              exportElement.style.transform = 'none';
              exportElement.style.margin = '0';
              exportElement.style.padding = '0';
              exportElement.style.borderRadius = '0';
              exportElement.style.width = '321px';
              exportElement.style.height = '694.5px';
              exportElement.style.boxSizing = 'border-box';
              
              // Сохраняем оригинальные вертикальные отступы
              const deviceElement = exportElement.querySelector('.banner-device-target');
              const textElement = exportElement.querySelector('.banner-text-container');
              let originalDeviceTransform = '';
              let originalTextTransform = '';
              
              if (deviceElement instanceof HTMLElement) {
                originalDeviceTransform = deviceElement.style.transform;
              }
              
              if (textElement instanceof HTMLElement) {
                originalTextTransform = textElement.style.transform;
              }
              
              // Используем html2canvas для рендеринга
              const canvas = await html2canvas(exportElement as HTMLElement, {
                scale: 4,
                useCORS: true,
                allowTaint: true,
                backgroundColor: banner.backgroundColor || '#ffffff',
                width: 321,
                height: 694.5,
                logging: false,
                removeContainer: false,
                onclone: (clonedDoc, element) => {
                  // Восстанавливаем оригинальные трансформации в клоне
                  const clonedDevice = clonedDoc.querySelector('.banner-device-target');
                  const clonedText = clonedDoc.querySelector('.banner-text-container');
                  
                  if (clonedDevice instanceof HTMLElement && originalDeviceTransform) {
                    clonedDevice.style.transform = originalDeviceTransform;
                  }
                  
                  if (clonedText instanceof HTMLElement && originalTextTransform) {
                    clonedText.style.transform = originalTextTransform;
                  }
                  
                  return element;
                }
              });
              
              // Создаем новый canvas с точными размерами
              const finalCanvas = document.createElement('canvas');
              finalCanvas.width = 1284;
              finalCanvas.height = 2778;
              const finalCtx = finalCanvas.getContext('2d');
              if (finalCtx) {
                // Рисуем исходный canvas на финальный с точными размерами
                finalCtx.drawImage(canvas, 0, 0, 1284, 2778);
              }
              
              // Получаем данные из финального canvas
              const blob = await new Promise<Blob>((resolve, reject) => {
                finalCanvas.toBlob((b) => {
                  if (b) resolve(b);
                  else reject(new Error('Failed to create blob'));
                }, 'image/png', 1.0);
              });
              
              // Добавляем в архив
              langFolder.file(`banner_${banner.id}.png`, blob);
              
              // Обновляем прогресс
              processedBanners++;
              setExportingProgress(Math.floor((processedBanners / totalBanners) * 100));
              
            } finally {
              // Удаляем временный элемент
              if (exportElement.parentNode) {
                document.body.removeChild(exportElement);
              }
            }
          } catch (error) {
            console.error(`Ошибка при экспорте баннера ${previewItems[i].id}:`, error);
          }
        }
      }
      
      // Восстанавливаем исходный язык и индекс
      setActiveLanguage(originalLang);
      setPreviewIndex(originalIndex);
      
      // Генерируем ZIP-архив
      console.log('Генерация архива...');
      const content = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6
        }
      });
      console.log(`Размер архива: ${content.size} байт`);
      
      // Сохраняем
      saveAs(content, "app_banners.zip");
      console.log('Экспорт завершен успешно!');
      
    } catch (error) {
      console.error("Ошибка при экспорте:", error);
      alert("Произошла ошибка при экспорте. Пожалуйста, попробуйте снова.");
    } finally {
      setIsExporting(false);
      setExportingProgress(0);
    }
  };

  // Обновим функцию getTextStyle, чтобы обеспечить корректное применение textAlignment
  const getTextStyle = (elementType, rotation = 0) => {
    const baseStyle = {
      color: elementType === "title" ? bannerSettings.titleColor : bannerSettings.descriptionColor,
      fontFamily: bannerSettings.fontFamily,
      textAlign: textAlignment as any, // используем as any для обхода проверки типов
      fontSize: `${elementType === "title" ? fontSize.title : fontSize.description}px`,
      lineHeight: elementType === "title" ? lineHeight.title : lineHeight.description,
      letterSpacing: `${elementType === "title" ? letterSpacing.title : letterSpacing.description}%`,
      transform: rotation ? `rotate(${rotation}deg)` : undefined,
      transformOrigin: "center",
      display: "inline-block",
      width: "100%"
    }

    return baseStyle
  }

  // Обновляем функцию renderSettingsPanel, чтобы добавить настройки высоты
  const renderSettingsPanel = () => {
    const currentBanner = previewItems[previewIndex] || {} as PreviewItem;

    switch (activeElement) {
      case "none":
      case "banner":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-base font-medium font-mono">Banner Settings</h3>

              <div>
                <Label className="text-xs font-mono">Background Color</Label>
                <div className="mt-2">
                  <ColorPicker
                    color={currentBanner.backgroundColor || "#007AFF"}
                    onChange={(color) => {
                      const updatedItems = [...previewItems]
                      if (updatedItems[previewIndex]) {
                        updatedItems[previewIndex] = {
                          ...updatedItems[previewIndex],
                          backgroundColor: color,
                        }
                        setPreviewItems(updatedItems)
                      }
                    }}
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <h4 className="text-xs font-medium text-gray-500 font-mono">Localized App Information</h4>
                
                <div>
                  <Label className="text-xs font-mono">Promotional Text</Label>
                  <Textarea
                    value={getGlobalContent(activeLanguage, "promotionalText") || ""}
                    onChange={(e) => {
                      updateLocalizedContent(activeLanguage, "promotionalText", e.target.value)
                    }}
                    className="mt-1"
                    rows={4}
                    placeholder={`Promotional text in ${activeLanguage}`}
                  />
                </div>

                <div>
                  <Label className="text-xs font-mono">Description</Label>
                  <Textarea
                    value={getGlobalContent(activeLanguage, "description") || ""}
                    onChange={(e) => {
                      updateLocalizedContent(activeLanguage, "description", e.target.value)
                    }}
                    className="mt-1"
                    rows={4}
                    placeholder={`Description in ${activeLanguage}`}
                  />
                </div>

                <div>
                  <Label className="text-xs font-mono">What's New in This Version</Label>
                  <Textarea
                    value={getGlobalContent(activeLanguage, "whatsNew") || ""}
                    onChange={(e) => {
                      updateLocalizedContent(activeLanguage, "whatsNew", e.target.value)
                    }}
                    className="mt-1"
                    rows={4}
                    placeholder={`What's new in ${activeLanguage}`}
                  />
                </div>

                <div>
                  <Label className="text-xs font-mono">Keywords</Label>
                  <Input
                    value={getGlobalContent(activeLanguage, "keywords") || ""}
                    onChange={(e) => {
                      updateLocalizedContent(activeLanguage, "keywords", e.target.value)
                    }}
                    className="mt-1"
                    placeholder={`Keywords in ${activeLanguage}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case "title":
      case "description":
        const isTitle = activeElement === "title"
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col">
                <h3 className="text-base font-semibold font-mono">
                  {isTitle ? "Заголовок" : "Описание"}
                </h3>
                <Label className="text-xs text-gray-500 font-mono">
                  {isTitle ? "Текст заголовка" : "Текст описания"}
                </Label>
                <Textarea
                  value={getPreviewContent(activeLanguage, currentBanner.id, isTitle ? "title" : "description") || ""}
                  onChange={(e) => {
                    updateBannerText(activeLanguage, currentBanner.id, isTitle ? "title" : "description", e.target.value);
                  }}
                  className="mt-1"
                  placeholder={isTitle ? "Введите заголовок..." : "Введите описание..."}
                />
              </div>

              <div className="space-y-3 mt-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs font-mono">{isTitle ? "Вертикальное смещение заголовка" : "Вертикальное смещение описания"}</Label>
                  </div>
                  <NumberInputWithSlider
                    value={currentBanner.verticalOffset?.[isTitle ? "title" : "description"] || 0}
                    onChange={(value) => {
                      const updatedItems = [...previewItems];
                      if (updatedItems[previewIndex]) {
                        updatedItems[previewIndex] = {
                          ...updatedItems[previewIndex],
                          verticalOffset: {
                            ...updatedItems[previewIndex].verticalOffset,
                            [isTitle ? "title" : "description"]: value,
                          },
                        };
                        setPreviewItems(updatedItems);
                      }
                    }}
                    min={-300}
                    max={300}
                    unit="px"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs font-mono">{isTitle ? "Горизонтальное смещение заголовка" : "Горизонтальное смещение описания"}</Label>
                  </div>
                  <NumberInputWithSlider
                    value={currentBanner.horizontalOffset?.[isTitle ? "title" : "description"] || 0}
                    onChange={(value) => {
                      const updatedItems = [...previewItems];
                      if (updatedItems[previewIndex]) {
                        updatedItems[previewIndex] = {
                          ...updatedItems[previewIndex],
                          horizontalOffset: {
                            ...updatedItems[previewIndex].horizontalOffset,
                            [isTitle ? "title" : "description"]: value,
                          },
                        };
                        setPreviewItems(updatedItems);
                      }
                    }}
                    min={-300}
                    max={300}
                    unit="px"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs font-mono">{isTitle ? "Поворот заголовка" : "Поворот описания"}</Label>
                  </div>
                  <NumberInputWithSlider
                    value={currentBanner.rotation?.[isTitle ? "title" : "description"] || 0}
                    onChange={(value) => {
                      const updatedItems = [...previewItems];
                      if (updatedItems[previewIndex]) {
                        updatedItems[previewIndex] = {
                          ...updatedItems[previewIndex],
                          rotation: {
                            ...updatedItems[previewIndex].rotation,
                            [isTitle ? 'title' : 'description']: value
                          }
                        };
                        setPreviewItems(updatedItems);
                      }
                    }}
                    min={-180}
                    max={180}
                    unit="°"
                  />
                </div>
              </div>
            </div>
          </div>
        )
      
      case "text-block":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold font-mono">Блок текста</h3>
              
              <div className="space-y-3 mt-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs font-mono">Вертикальное смещение блока</Label>
                  </div>
                  <NumberInputWithSlider
                    value={currentBanner.verticalOffset?.combined || 0}
                    onChange={(value) => {
                      const updatedItems = [...previewItems];
                      if (updatedItems[previewIndex]) {
                        updatedItems[previewIndex] = {
                          ...updatedItems[previewIndex],
                          verticalOffset: {
                            ...updatedItems[previewIndex].verticalOffset,
                            combined: value,
                          },
                        };
                        setPreviewItems(updatedItems);
                      }
                    }}
                    min={-300}
                    max={300}
                    unit="px"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs font-mono">Горизонтальное смещение блока</Label>
                  </div>
                  <NumberInputWithSlider
                    value={currentBanner.horizontalOffset?.combined || 0}
                    onChange={(value) => {
                      const updatedItems = [...previewItems];
                      if (updatedItems[previewIndex]) {
                        updatedItems[previewIndex] = {
                          ...updatedItems[previewIndex],
                          horizontalOffset: {
                            ...updatedItems[previewIndex].horizontalOffset,
                            combined: value,
                          },
                        };
                        setPreviewItems(updatedItems);
                      }
                    }}
                    min={-300}
                    max={300}
                    unit="px"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="font-mono">Поворот блока</Label>
                  </div>
                  <NumberInputWithSlider
                    value={currentBanner.rotation?.textBlock || 0}
                    onChange={(value) => {
                      const updatedItems = [...previewItems];
                      if (updatedItems[previewIndex]) {
                        updatedItems[previewIndex] = {
                          ...updatedItems[previewIndex],
                          rotation: {
                            ...updatedItems[previewIndex].rotation,
                            textBlock: value
                          }
                        };
                        setPreviewItems(updatedItems);
                      }
                    }}
                    min={-180}
                    max={180}
                    unit="°"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case "device":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-base font-medium font-mono">Device Settings</h3>

              <div>
                <Label className="text-xs font-mono">Position</Label>
                <div className="grid grid-cols-3 gap-0.5 mt-1">
                  {DEVICE_POSITIONS.map((position) => {
                    // Определение иконки-схемы для каждой позиции
                    const getPositionIcon = () => {
                      // SVG схема для каждой позиции
                      const icons = {
                        'top-left': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="4" y="4" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="14" width="16" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        ),
                        'top-center': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="9" y="4" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="14" width="16" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        ),
                        'top-right': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="14" y="4" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="14" width="16" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        ),
                        'center-left': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="4" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="14" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        ),
                        'center': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="4" y="2" width="16" height="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="18" width="16" height="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          </svg>
                        ),
                        'center-right': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="14" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        ),
                        'bottom-left': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="4" y="14" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="4" width="16" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        ),
                        'bottom-center': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="9" y="14" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="4" width="16" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        ),
                        'bottom-right': (
                          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto">
                            <rect x="14" y="14" width="6" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                            <rect x="4" y="4" width="16" height="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
                          </svg>
                        )
                      };
                      
                      return icons[position.value] || <Smartphone className="h-4 w-4 mx-auto" />;
                    };
                    
                    return (
                      <button
                        key={position.value}
                        type="button"
                        onClick={() => {
                          const updatedItems = [...previewItems]
                          if (updatedItems[previewIndex]) {
                            updatedItems[previewIndex] = {
                              ...updatedItems[previewIndex],
                              devicePosition: position.value,
                            }
                            setPreviewItems(updatedItems)
                          }
                        }}
                        className={`p-0.5 rounded-md border ${
                          currentBanner.devicePosition === position.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-background hover:bg-muted"
                        }`}
                        title={position.label}
                      >
                        {getPositionIcon()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs font-mono">Device Scale</Label>
                </div>
                <NumberInputWithSlider
                  value={currentBanner.deviceScale || 100}
                  onChange={(value) => {
                    const updatedItems = [...previewItems];
                    if (updatedItems[previewIndex]) {
                      updatedItems[previewIndex] = {
                        ...updatedItems[previewIndex],
                        deviceScale: value,
                      };
                      setPreviewItems(updatedItems);
                    }
                  }}
                  min={50}
                  max={150}
                  unit="%"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs font-mono">Vertical Position</Label>
                </div>
                <NumberInputWithSlider
                  value={previewItems[previewIndex]?.verticalOffset?.device || 0}
                  onChange={(value) => {
                    const updatedItems = [...previewItems]
                    if (updatedItems[previewIndex]) {
                      updatedItems[previewIndex] = {
                        ...updatedItems[previewIndex],
                        verticalOffset: {
                          ...updatedItems[previewIndex].verticalOffset,
                          device: value,
                        },
                      }
                      setPreviewItems(updatedItems)
                    }
                  }}
                  min={-300}
                  max={300}
                  unit="px"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-base font-medium font-mono">Border Settings</h3>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-mono">Border Color</Label>
                    <div className="mt-2">
                      <ColorPicker
                        color={currentBanner.screenshot?.borderColor || "#000000"}
                        onChange={(color) => updateScreenshotSetting("borderColor", color)}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-xs font-mono">Border Width</Label>
                    </div>
                    <NumberInputWithSlider
                      value={currentBanner.screenshot?.borderWidth || 8}
                      onChange={(value) => updateScreenshotSetting("borderWidth", value)}
                      min={0}
                      max={20}
                      unit="px"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-xs font-mono">Border Radius</Label>
                    </div>
                    <NumberInputWithSlider
                      value={currentBanner.screenshot?.borderRadius || 30}
                      onChange={(value) => updateScreenshotSetting("borderRadius", value)}
                      min={0}
                      max={60}
                      unit="px"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-xs font-mono">Rotation</Label>
                </div>
                <NumberInputWithSlider
                  value={currentBanner.rotation?.device || 0}
                  onChange={(value) => {
                    const updatedItems = [...previewItems];
                    if (updatedItems[previewIndex]) {
                      updatedItems[previewIndex] = {
                        ...updatedItems[previewIndex],
                        rotation: {
                          ...updatedItems[previewIndex].rotation,
                          device: value
                        }
                      };
                      setPreviewItems(updatedItems);
                    }
                  }}
                  min={-360}
                  max={360}
                  unit="°"
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // Add new state for inline editing
  const [editingText, setEditingText] = useState<{ type: string; bannerId: number; value: string } | null>(null);

  // Add function to handle inline text editing
  const handleInlineTextEdit = (type: string, bannerId: number, value: string) => {
    setEditingText({ type, value, bannerId });
    if (textareaRef.current) {
      adjustTextareaHeight(textareaRef.current);
    }
  };

  // Update the saveInlineTextEdit function to use the correct key format
  const saveInlineTextEdit = () => {
    if (!editingText) return;

    // Используем updateBannerText для сохранения текста
    updateBannerText(activeLanguage, editingText.bannerId, editingText.type, editingText.value);
    
    setEditingText(null);
  };

  // Add a ref for the textarea element
  const textareaRef = useRef(null);

  // Add a function to automatically adjust the textarea height
  const adjustTextareaHeight = (textarea) => {
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set the height to match the content
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  // Move the useEffect for textarea adjustment outside nested functions
  useEffect(() => {
    if (editingText && textareaRef.current) {
      adjustTextareaHeight(textareaRef.current);
    }
  }, [editingText]);

  // Функция для рендеринга баннера
  const renderBanner = (item, index) => {
    const isActive = index === previewIndex
    
    // Принудительно устанавливаем сохраненную позицию устройства
    const devicePosition = item.devicePosition || "center";
    
    console.log(`Rendering banner ${index}, device position:`, devicePosition);
    
    const { titlePosition, descriptionPosition, separateElements } = getContentPositions(devicePosition)
    const currentOffset = item.verticalOffset || { combined: 0, title: 0, description: 0, device: 0 }
    const currentHorizontalOffset = item.horizontalOffset || { combined: 0, title: 0, description: 0 }
    const currentRotation = item.rotation || { device: 0, title: 0, description: 0, textBlock: 0 }

    // Helper function to render editable text
    const renderEditableText = (type, content, elementStyle, additionalStyle = {}) => {
      const isEditing = editingText && editingText.type === type && editingText.bannerId === item.id;
      
      // Calculate consistent dimensions for both view and edit modes
      const containerStyle = {
        ...additionalStyle,
        width: 'calc(100% + 30px)', // Увеличиваем ширину на 30px
        display: 'flex',
        flexDirection: 'column',
        alignItems: textAlignment === 'center' ? 'center' : textAlignment === 'right' ? 'flex-end' : 'flex-start',
        justifyContent: 'flex-start',
      };
      
      // Make sure text alignment is properly applied
      const textStyle = {
        ...elementStyle,
        textAlign: textAlignment,
        width: '100%',
      };
      
      return isEditing ? (
        <div style={containerStyle}>
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent outline-none resize-none p-1"
            value={editingText.value}
            onChange={(e) => {
              setEditingText({ ...editingText, value: e.target.value });
              adjustTextareaHeight(e.target);
            }}
            onBlur={saveInlineTextEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveInlineTextEdit();
              }
            }}
            autoFocus
            style={{
              ...textStyle,
              height: 'auto',
              minHeight: type === 'title' ? '2.5rem' : '3.5rem',
              display: 'block',
              overflow: 'hidden',
              border: 'none',
              background: 'rgba(59, 130, 246, 0.05)',
              verticalAlign: 'top',
            }}
          />
        </div>
      ) : (
        <div 
          className="cursor-text w-full"
          onClick={() => {
            if (isActive) {
              handleInlineTextEdit(type, item.id, content);
            }
          }}
          style={containerStyle}
        >
          {type === 'title' ? (
            <h2 className={`text-2xl font-bold text-${textAlignment}`} style={textStyle}>
              {content || "Title"}
            </h2>
          ) : (
            <p className={`text-base text-${textAlignment}`} style={textStyle}>
              {content || "Description"}
            </p>
          )}
        </div>
      );
    };

    return (
      <div
        key={`banner-${item.id}`}
        id={`preview-${item.id}`}
        className={`relative rounded-lg pb-4 overflow-hidden banner border ${isActive ? "shadow-xl border-transparent" : "border-transparent"}`}
        onClick={() => setPreviewIndex(index)}
        style={{
          backgroundColor: item.backgroundColor || "#007AFF",
          width: "320px",
          height: "690px",
          position: "relative",
          margin: "0 15px", // Добавляем отступ 15px справа и слева (итого 30px между соседними баннерами)
        }}
      >
        <div
          className="w-full h-full relative"
          style={{
            backgroundColor: item.backgroundColor,
          }}
        >
          <div className="absolute top-4 left-4 text-white text-xl font-mono opacity-50">
            {String(item.id).padStart(2, "0")}
          </div>

          {/* Title and description - position changes based on device position */}
          {separateElements ? (
            <>
              {/* Title at the top */}
              <div
                className={`absolute ${isActive ? "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""} ${isActive && draggingElementInfo?.elementType !== 'title' ? 'cursor-grab' : ''} ${draggingElementInfo?.elementType === 'title' ? 'cursor-grabbing' : ''}`}
                style={{
                  ...titlePosition,
                  transform: `${(titlePosition as any).transform || ""} translateY(${currentOffset.title}px) translateX(${currentHorizontalOffset.title}px)`,
                }}
                onMouseDown={(e) => isActive && handleMouseDown(e, item.id, "title")}
                onDoubleClick={(e) => {
                  if (isActive) {
                    e.stopPropagation()
                    setActiveElement("title")
                  }
                }}
              >
                {renderEditableText(
                  'title', 
                  getPreviewContent(activeLanguage, item.id, "title"),
                  getTextStyle("title", currentRotation.title)
                )}
              </div>

              {/* Description at the bottom */}
              <div
                className={`absolute ${isActive ? "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""} ${isActive && draggingElementInfo?.elementType !== 'description' ? 'cursor-grab' : ''} ${draggingElementInfo?.elementType === 'description' ? 'cursor-grabbing' : ''}`}
                style={{
                  ...descriptionPosition,
                  transform: `${(descriptionPosition as any).transform || ""} translateY(${currentOffset.description}px) translateX(${currentHorizontalOffset.description}px)`,
                }}
                onMouseDown={(e) => isActive && handleMouseDown(e, item.id, "description")}
                onDoubleClick={(e) => {
                  if (isActive) {
                    e.stopPropagation()
                    setActiveElement("description")
                  }
                }}
              >
                {renderEditableText(
                  'description',
                  getPreviewContent(activeLanguage, item.id, "description"),
                  getTextStyle("description", currentRotation.description)
                )}
              </div>
            </>
          ) : (
            <div
              className={`absolute ${isActive ? "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""} ${isActive && draggingElementInfo?.elementType !== 'text-block' ? 'cursor-grab' : ''} ${draggingElementInfo?.elementType === 'text-block' ? 'cursor-grabbing' : ''}`}
              style={{
                ...titlePosition, // Используем titlePosition как базу для всего блока
                transform: `${(titlePosition as any).transform || ""} translateY(${currentOffset.combined}px) translateX(${currentHorizontalOffset.combined}px) rotate(${currentRotation.textBlock}deg)`,
              }}
              onMouseDown={(e) => isActive && handleMouseDown(e, item.id, "text-block")}
              onDoubleClick={(e) => {
                if (isActive) {
                  e.stopPropagation()
                  setActiveElement("text-block")
                }
              }}
            >
              {renderEditableText(
                'title',
                getPreviewContent(activeLanguage, item.id, "title"),
                getTextStyle("title"),
                { marginBottom: '0.5rem' }
              )}
              {renderEditableText(
                'description',
                getPreviewContent(activeLanguage, item.id, "description"),
                getTextStyle("description")
              )}
            </div>
          )}

          {/* Device/Screenshot */}
          <div
            className={`absolute banner-device-target ${isActive ? "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50" : ""} ${isActive && draggingElementInfo?.elementType !== 'device' ? 'cursor-grab' : ''} ${draggingElementInfo?.elementType === 'device' ? 'cursor-grabbing' : ''}`}
            data-banner-id={index}
            style={getDevicePositionStyles(item) as React.CSSProperties}
            onMouseDown={(e) => isActive && handleMouseDown(e, item.id, "device")}
            onDoubleClick={(e) => {
              if (isActive) {
                e.stopPropagation()
                setActiveElement("device")
              }
            }}
          >
            {(() => {
              const currentScreenshot = getCurrentScreenshot(item, activeLanguage);
              return currentScreenshot?.file ? (
                <div
                  style={{
                    borderWidth: `${currentScreenshot.borderWidth}px`,
                    borderStyle: "solid",
                    borderColor: currentScreenshot.borderColor,
                    borderRadius: `${currentScreenshot.borderRadius}px`,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={URL.createObjectURL(currentScreenshot.file) || "/placeholder.svg"}
                    alt={`Screenshot ${item.id}`}
                    style={{
                      width: "100%",
                      display: "block",
                    }}
                  />
                </div>
              ) : (
              <div
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50"
                style={{
                  width: "100%",
                  height: "400px",
                  borderWidth: `${item.screenshot?.borderWidth || 8}px`,
                  borderStyle: "solid",
                  borderColor: item.screenshot?.borderColor || "#000000",
                  borderRadius: `${item.screenshot?.borderRadius || 30}px`,
                }}
              >
                {isActive && (
                  <input
                    type="file"
                    id={`screenshot-upload-${item.id}`}
                    className="hidden"
                    accept="image/*"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files && e.target.files[0]) {
                        handleScreenshotUpload(e.target.files[0])
                      }
                    }}
                  />
                )}
                {isActive ? (
                  <label htmlFor={`screenshot-upload-${item.id}`} className="cursor-pointer flex flex-col items-center">
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                    <span className="mt-2 text-sm text-gray-500">Click or drag & drop to upload screenshot</span>
                  </label>
                ) : (
                  <>
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                    <span className="mt-2 text-sm text-gray-500">No screenshot</span>
                  </>
                )}
              </div>
              );
            })()}
          </div>

          {/* Action buttons */}
          {isActive && (
            <div className="absolute top-4 right-4 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-black bg-opacity-30 hover:bg-opacity-50 text-white rounded-full"
                onClick={(e) => {
                  e.stopPropagation()
                  duplicatePreview(item.id)
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              
              {previewItems.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-black bg-opacity-30 hover:bg-opacity-50 text-white rounded-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    removePreview(item.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Добавляем функцию для экспорта JSON с текущим контентом
  const handleJsonExport = () => {
    // Создаем объект для экспорта
    const exportData = {
      global: {},
      banners: {}
    };

    LANGUAGES.forEach(({ code: langCode }) => {
      // Добавляем глобальный контент
      if (!exportData.global[langCode]) {
        exportData.global[langCode] = {
          title: langCode === "ru" ? getGlobalContent(langCode, "title") || "" : "",
          description: langCode === "ru" ? getGlobalContent(langCode, "description") || "" : "",
          promotionalText: langCode === "ru" ? getGlobalContent(langCode, "promotionalText") || "" : "",
          whatsNew: langCode === "ru" ? getGlobalContent(langCode, "whatsNew") || "" : "",
          keywords: langCode === "ru" ? getGlobalContent(langCode, "keywords") || "" : ""
        };
      }
      
      // Добавляем контент баннеров
      if (!exportData.banners[langCode]) {
        exportData.banners[langCode] = {};
      }
      
      // Добавляем контент для каждого баннера
      previewItems.forEach(preview => {
        const previewKey = `preview_${preview.id}`;
        exportData.banners[langCode][previewKey] = {
          title: langCode === "ru" ? getPreviewContent(langCode, preview.id, "title") || "" : "",
          description: langCode === "ru" ? getPreviewContent(langCode, preview.id, "description") || "" : ""
        };
      });
    });

    // Создаем JSON blob и скачиваем
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'localized_content.json';
    document.body.appendChild(a);
    a.click();
    
    // Очистка
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // Add CSS rules in a useEffect to the document head
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement('style');
    
    // Add the CSS for drag-and-drop highlighting
    styleElement.textContent = `
      .drag-highlight {
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5), 0 0 0 6px rgba(59, 130, 246, 0.3);
        transition: box-shadow 0.2s ease-in-out;
      }
    `;
    
    // Append the style element to the head
    document.head.appendChild(styleElement);
    
    // Clean up
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Load bannerSettings from localStorage
  useEffect(() => {
    console.log("Loading banner settings from localStorage");
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const savedSettings = localStorage.getItem('bannerSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setBannerSettings(parsedSettings);
      }
    } catch (error) {
      console.error("Error parsing banner settings:", error);
    }
  }, []);

  // Load textAlignment from localStorage
  useEffect(() => {
    console.log("Loading text alignment from localStorage");
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const savedAlignment = localStorage.getItem('textAlignment');
      if (savedAlignment) {
        setTextAlignment(savedAlignment);
      }
    } catch (error) {
      console.error("Error loading text alignment:", error);
    }
  }, []);

  // Load fontSize from localStorage
  useEffect(() => {
    console.log("Loading font size from localStorage");
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const savedFontSize = localStorage.getItem('fontSize');
      if (savedFontSize) {
        setFontSize(JSON.parse(savedFontSize));
      }
    } catch (error) {
      console.error("Error parsing font size:", error);
    }
  }, []);

  // Load lineHeight and letterSpacing from localStorage
  useEffect(() => {
    console.log("Loading line height and letter spacing from localStorage");
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      const savedLineHeight = localStorage.getItem('lineHeight');
      if (savedLineHeight) {
        setLineHeight(JSON.parse(savedLineHeight));
      }
      
      const savedLetterSpacing = localStorage.getItem('letterSpacing');
      if (savedLetterSpacing) {
        setLetterSpacing(JSON.parse(savedLetterSpacing));
      }
    } catch (error) {
      console.error("Error parsing line height or letter spacing:", error);
    }
  }, []);

  // Улучшим функцию для обновления текстов в баннерах
  const updateBannerText = (language: string, previewId: number, field: string, value: string) => {
    console.log(`Updating banner text: ${language}, id=${previewId}, ${field}=${value}`);
    const newLocalizedContent = { ...localizedContent };
    if (!newLocalizedContent[language]) {
      newLocalizedContent[language] = {
        title: "",
        description: "",
        promotionalText: "",
        whatsNew: "",
        keywords: ""
      };
    }
    
    // Banner-specific content is stored with key format "preview_<id>_<field>"
    const previewKey = `preview_${previewId}_${field}`;
    newLocalizedContent[language][previewKey] = value;
    setLocalizedContent(newLocalizedContent);
  };

  // Добавим useLayoutEffect, чтобы избежать проблем с гидратацией
  const [domLoaded, setDomLoaded] = useState(false);

  // Используем useEffect для установки domLoaded когда компонент монтируется на клиенте
  useEffect(() => {
    setDomLoaded(true);
  }, []);

  // Добавим функцию для рисования скругленного прямоугольника
  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    return ctx;
  };

  // Обработчик начала перетаскивания
  const handleMouseDown = (
    event: React.MouseEvent,
    bannerId: number,
    elementType: "title" | "description" | "device" | "text-block"
  ) => {
    event.preventDefault();
    event.stopPropagation(); // Останавливаем всплытие, чтобы не конфликтовать с выбором активного баннера

    const banner = previewItems.find(p => p.id === bannerId);
    if (!banner) return;

    let initialElementOffsetX = 0;
    let initialElementOffsetY = 0;

    const verticalOffsets = banner.verticalOffset || { combined: 0, title: 0, description: 0, device: 0 };
    const horizontalOffsets = banner.horizontalOffset || { combined: 0, title: 0, description: 0 };

    if (elementType === "title") {
      initialElementOffsetX = horizontalOffsets.title;
      initialElementOffsetY = verticalOffsets.title;
    } else if (elementType === "description") {
      initialElementOffsetX = horizontalOffsets.description;
      initialElementOffsetY = verticalOffsets.description;
    } else if (elementType === "device") {
      initialElementOffsetX = 0; // Горизонтальное смещение устройства управляется его CSS-позицией
      initialElementOffsetY = verticalOffsets.device;
    } else if (elementType === "text-block") {
      initialElementOffsetX = horizontalOffsets.combined;
      initialElementOffsetY = verticalOffsets.combined;
    }
    
    // Устанавливаем активный элемент, если перетаскиваем его
    if (elementType === "title" || elementType === "description" || elementType === "device" || elementType === "text-block") {
      setActiveElement(elementType === "text-block" ? "title" : elementType); // Для text-block выбираем title, чтобы настройки открылись
    }


    setDraggingElementInfo({
      bannerId,
      elementType,
      initialMouseX: event.clientX,
      initialMouseY: event.clientY,
      initialElementOffsetX,
      initialElementOffsetY,
    });
  };

  // Обработчик перемещения мыши (будет добавлен глобально)
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!draggingElementInfo) return;

    const deltaX = event.clientX - draggingElementInfo.initialMouseX;
    const deltaY = event.clientY - draggingElementInfo.initialMouseY;

    const newOffsetX = draggingElementInfo.initialElementOffsetX + deltaX;
    const newOffsetY = draggingElementInfo.initialElementOffsetY + deltaY;

    setPreviewItems(prevItems => 
      prevItems.map(item => {
        if (item.id === draggingElementInfo.bannerId) {
          const updatedItem = { ...item };
          let elementType = draggingElementInfo.elementType;

          if (elementType === "title") {
            updatedItem.horizontalOffset = { ...item.horizontalOffset, title: newOffsetX };
            updatedItem.verticalOffset = { ...item.verticalOffset, title: newOffsetY };
          } else if (elementType === "description") {
            updatedItem.horizontalOffset = { ...item.horizontalOffset, description: newOffsetX };
            updatedItem.verticalOffset = { ...item.verticalOffset, description: newOffsetY };
          } else if (elementType === "device") {
            updatedItem.verticalOffset = { ...item.verticalOffset, device: newOffsetY };
            // Горизонтальное пока не трогаем, оно через CSS left/right/transform
          } else if (elementType === "text-block") {
            updatedItem.horizontalOffset = { ...item.horizontalOffset, combined: newOffsetX };
            updatedItem.verticalOffset = { ...item.verticalOffset, combined: newOffsetY };
          }
          return updatedItem;
        }
        return item;
      })
    );
  }, [draggingElementInfo, setPreviewItems]);

  // Обработчик отпускания кнопки мыши (будет добавлен глобально)
  const handleMouseUp = useCallback(() => {
    if (draggingElementInfo) {
      setDraggingElementInfo(null);
    }
  }, [draggingElementInfo]);

  // Эффект для добавления и удаления глобальных обработчиков мыши
  useEffect(() => {
    if (draggingElementInfo) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      // Добавим стиль для body, чтобы предотвратить выделение текста при перетаскивании
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [draggingElementInfo, handleMouseMove, handleMouseUp]);

  return (
    <>
      {domLoaded ? (
        <div className="min-h-screen flex flex-col">
          {/* Fixed header */}
          <header className="fixed top-0 left-0 right-0 bg-white border-b py-4 px-6 z-50 shadow-sm">
            <div className="container mx-auto">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">ASB Generator v2</h1>
                
                <div className="flex items-center gap-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Upload className="mr-2 h-4 w-4" />
                        Import JSON
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Import Localized Content</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Диалог импорта JSON */}
                        <div className="space-y-4 py-4">
                          <div className="flex flex-col gap-4">
                            <div>
                              <Label>Импорт из файла</Label>
                              <Input 
                                type="file" 
                                accept=".json"
                                onChange={handleImportFile}
                                className="mt-2"
                              />
                            </div>
                            
                            <div>
                              <Label>Или вставьте JSON текст</Label>
                              <Textarea
                                value={jsonImportText}
                                onChange={(e) => setJsonImportText(e.target.value)}
                                placeholder="Вставьте JSON здесь..."
                                className="mt-2 min-h-[200px]"
                              />
                              <Button 
                                onClick={handleImportFromText}
                                className="mt-2"
                                disabled={!jsonImportText}
                              >
                                Импортировать из текста
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button variant="outline" onClick={handleJsonExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                  
                  <LanguageSelector languages={LANGUAGES} activeLanguage={activeLanguage} onChange={handleLanguageChange} />
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="default" disabled={isExporting}>
                        {isExporting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting {Math.round(exportingProgress)}%
                          </>
                        ) : (
                          <>
                            <ArrowDownToLine className="mr-2 h-4 w-4" />
                            Export All Images
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Экспорт изображений</DialogTitle>
                        <DialogDescription>
                          Выберите локали для экспорта изображений
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="flex justify-between mb-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => toggleAllLocales(true)}
                          >
                            Выбрать все
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => toggleAllLocales(false)}
                          >
                            Отменить все
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {LANGUAGES.map(lang => (
                            <div key={lang.code} className="flex items-center space-x-2">
                              <input 
                                type="checkbox" 
                                id={`lang-${lang.code}`}
                                checked={selectedLocales[lang.code]}
                                onChange={() => toggleLocaleSelection(lang.code)}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor={`lang-${lang.code}`} className="text-sm font-medium">
                                {lang.name} ({lang.code})
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          onClick={handleExport}
                          disabled={isExporting || Object.values(selectedLocales).every(v => !v)}
                        >
                          {isExporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Экспорт {Math.round(exportingProgress)}%
                            </>
                          ) : (
                            'Экспортировать'
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </header>

          {/* Add padding to content area to account for fixed header */}
          <div className="flex-grow container mx-auto px-4 py-6 mt-[116px]">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              {/* Left panel - Banners */}
              <div>
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="bg-gray-100 p-6 flex flex-col min-h-[800px]"
                         onClick={(e) => {
                           // Проверяем, что клик был именно по фоновой области
                           if (e.target === e.currentTarget) {
                             setActiveElement("banner");
                           }
                         }}>
                      {/* Horizontal scrollable banners */}
                      <div
                        ref={scrollContainerRef}
                        className="flex overflow-x-auto pb-4 pt-2 px-2 -mx-2 mb-4 snap-x"
                        style={{ scrollbarWidth: "thin" }}
                      >
                        {previewItems.map((item, index) => renderBanner(item, index))}

                        <div
                          className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-gray-50"
                          style={{
                            width: "320px",
                            height: "690px",
                            flexShrink: 0,
                            margin: "0 8px",
                          }}
                          onClick={addPreview}
                        >
                          <Plus className="h-12 w-12 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right panel - Settings */}
              <div>
                {/* Панель настроек, растянутая на всю высоту экрана, но ниже шапки */}
                <div className="fixed top-0 right-0 h-screen w-[320px] z-40" style={{ paddingTop: '65px' }}>
                  <Card className="h-full rounded-none border-l border-t-0 border-r-0 border-b-0">
                    <CardContent className="p-6 h-full overflow-y-auto">
                      {/* Context-sensitive settings panel */}
                      {renderSettingsPanel()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

