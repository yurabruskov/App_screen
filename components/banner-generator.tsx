"use client"

import { useState, useRef, useEffect } from "react"
import {
  Download,
  Plus,
  Trash2,
  ImageIcon,
  Smartphone,
  Upload,
  Copy,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignJustify,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowDownToLine,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { ColorPicker } from "@/components/color-picker"
import { LanguageSelector } from "@/components/language-selector"
import { exportBanners } from "@/lib/export-utils"
import { LANGUAGES, DEFAULT_SETTINGS, DEVICE_POSITIONS } from "@/lib/constants"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import JSZip from "jszip"
import html2canvas from "html2canvas"
// @ts-ignore
import domtoimage from "dom-to-image"
// @ts-ignore
import { saveAs } from "file-saver"

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
  screenshot: {
    file: File | null;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
  };
}

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
  private initDB(): Promise<void> {
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
            
            const imageData = {
              id,
              data: reader.result,
              type: file.type,
              lastModified: new Date().getTime()
            };
            
            const request = store.put(imageData);
            
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event);
          } catch (err) {
            reject(err);
          }
        };
        
        reader.onerror = (event) => reject(event);
        reader.readAsDataURL(file);
      } catch (err) {
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
      <div className="flex items-center gap-2 min-w-[100px]">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const newValue = Number(e.target.value);
            if (!isNaN(newValue)) {
              onChange(Math.min(Math.max(newValue, min), max));
            }
          }}
          className="w-[80px]"
          min={min}
          max={max}
          step={step}
        />
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
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
  const scrollContainerRef = useRef(null)
  const [activeElement, setActiveElement] = useState("banner") // banner, title, description, device
  
  // Создаем экземпляр ImageDB
  const imageDBRef = useRef<ImageDB | null>(null);

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
          const imageId = `preview_${item.id}`;
          
          try {
            const imageFile = await imageDBRef.current.getImage(imageId);
            if (imageFile) {
              console.log(`Loaded image for preview ${imageId}`);
              // Обновляем элемент с загруженным изображением
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
            console.error(`Error loading image for ${imageId}:`, error);
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

  // Update the getPreviewContent function to properly retrieve banner content
  const getPreviewContent = (langCode: string, previewId: number, field: string): string => {
    // Skip if there's no language data
    if (!localizedContent[langCode]) {
      return ""
    }

    // Banner-specific content is stored with key format "preview_<id>_<field>"
    const previewKey = `preview_${previewId}_${field}`
    
    // Check if there's custom content for this preview
    if (localizedContent[langCode][previewKey]) {
      return localizedContent[langCode][previewKey]
    }

    // Fall back to general content
    return localizedContent[langCode]?.[field] || ""
  }

  // Полностью заменяем эту функцию
  const handleScreenshotUpload = (file: File) => {
    // Для отладки
    console.log("Starting upload for preview: ", previewIndex);
    console.log("With position: ", previewItems[previewIndex]?.devicePosition);
    
    // Вместо создания копии, модифицируем существующий элемент
    const newItems = [...previewItems];
    
    if (newItems[previewIndex]) {
      // Сохраняем ссылку на элемент
      const item = newItems[previewIndex];
      
      // Модифицируем только screenshot.file, оставляя все остальные свойства неизменными
      item.screenshot = {
        ...item.screenshot,
        file
      };
      
      // Устанавливаем новое состояние
      setPreviewItems(newItems);
      
      // Сохраняем в IndexedDB
      if (imageDBRef.current) {
        const imageId = `preview_${item.id}`;
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
          transform: `translate(-50%, -50%) translateY(${deviceOffset}px) rotate(${deviceRotation}deg)`
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
      titlePosition = {
        top: "15%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "250px",
      }

      descriptionPosition = {
        bottom: "15%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "250px",
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

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setExportingProgress(0);
    
    try {
      // Create a zip file to hold all banners
      const zip = new JSZip();
      
      // Get supported languages from the content
      const languages = Object.keys(localizedContent);
      const totalBanners = previewItems.length * languages.length;
      let processedBanners = 0;
      
      // Create a folder for each language
      for (const langCode of languages) {
        // Create a folder for this language
        const langFolder = zip.folder(langCode);
        if (!langFolder) continue;
        
        // Export all previews for this language
        for (let i = 0; i < previewItems.length; i++) {
          const item = previewItems[i];
          const preview = document.getElementById(`preview-${item.id}`);
          
          if (preview) {
            // Active language switch temporarily to render correct language
            const originalLang = activeLanguage;
            setActiveLanguage(langCode);
            
            // Force render the banner with this language
            console.log(`Rendering banner ${i} for language ${langCode}`);
            
            // Use domtoimage to capture the banner
            await new Promise<void>(resolve => {
              setTimeout(async () => {
                try {
                  const blob = await domtoimage.toBlob(preview);
                  langFolder.file(`banner_${item.id}.png`, blob);
                  processedBanners++;
                  setExportingProgress((processedBanners / totalBanners) * 100);
                  resolve();
                } catch (error) {
                  console.error("Error generating image:", error);
                  resolve();
                }
              }, 100); // Give time for the language change to apply
            });
            
            // Restore original language
            setActiveLanguage(originalLang);
          }
        }
      }
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "app_banners.zip");
    } catch (error) {
      console.error("Error during export:", error);
      alert("An error occurred during export. Please try again.");
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

  // Обновим функцию renderSettingsPanel, чтобы добавить настройки высоты
  const renderSettingsPanel = () => {
    const currentBanner = previewItems[previewIndex] || {}

    switch (activeElement) {
      case "none":
      case "banner":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Banner Settings</h3>

              <div>
                <Label>Orientation</Label>
                <RadioGroup
                  defaultValue={bannerSettings.orientation}
                  className="flex gap-4 mt-2"
                  onValueChange={(value) => setBannerSettings({ ...bannerSettings, orientation: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="portrait" id="portrait" />
                    <Label htmlFor="portrait">Portrait</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="landscape" id="landscape" />
                    <Label htmlFor="landscape">Landscape</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Background Color</Label>
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
                <h4 className="text-sm font-medium text-gray-500">Localized App Information</h4>
                
                <div>
                  <Label className="text-sm">Promotional Text</Label>
                  <Textarea
                    value={getPreviewContent(activeLanguage, "global", "promotionalText") || ""}
                    onChange={(e) => {
                      updateLocalizedContent(activeLanguage, "promotionalText", e.target.value)
                    }}
                    className="mt-1"
                    rows={4}
                    placeholder={`Promotional text in ${activeLanguage}`}
                  />
                </div>

                <div>
                  <Label className="text-sm">Description</Label>
                  <Textarea
                    value={getPreviewContent(activeLanguage, "global", "description") || ""}
                    onChange={(e) => {
                      updateLocalizedContent(activeLanguage, "description", e.target.value)
                    }}
                    className="mt-1"
                    rows={4}
                    placeholder={`Description in ${activeLanguage}`}
                  />
                </div>

                <div>
                  <Label className="text-sm">What's New in This Version</Label>
                  <Textarea
                    value={getPreviewContent(activeLanguage, "global", "whatsNew") || ""}
                    onChange={(e) => {
                      updateLocalizedContent(activeLanguage, "whatsNew", e.target.value)
                    }}
                    className="mt-1"
                    rows={4}
                    placeholder={`What's new in ${activeLanguage}`}
                  />
                </div>

                <div>
                  <Label className="text-sm">Keywords</Label>
                  <Input
                    value={getPreviewContent(activeLanguage, "global", "keywords") || ""}
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
            <div>
              <Label className="text-sm text-gray-500">{isTitle ? "Title" : "Description"} Text</Label>
              {isTitle ? (
                <Input
                  value={getPreviewContent(activeLanguage, currentBanner.id || 1, "title") || ""}
                  onChange={(e) => {
                    updateLocalizedContent(activeLanguage, "title", e.target.value)
                  }}
                  className="mt-1"
                />
              ) : (
                <Textarea
                  value={getPreviewContent(activeLanguage, currentBanner.id || 1, "description") || ""}
                  onChange={(e) => {
                    updateLocalizedContent(activeLanguage, "description", e.target.value)
                  }}
                  className="mt-1"
                  rows={3}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Select
                  value={bannerSettings.fontFamily}
                  onValueChange={(value) => setBannerSettings({ ...bannerSettings, fontFamily: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Font" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SF Pro">SF Pro</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Roboto">Roboto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div>
                  <Select
                    value={isTitle ? bannerSettings.titleColor : bannerSettings.descriptionColor}
                    onValueChange={(color) => {
                      if (isTitle) {
                        setBannerSettings({ ...bannerSettings, titleColor: color })
                      } else {
                        setBannerSettings({ ...bannerSettings, descriptionColor: color })
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-r-none border-r-0">
                      <SelectValue placeholder="Color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="#FFFFFF">White</SelectItem>
                      <SelectItem value="#000000">Black</SelectItem>
                      <SelectItem value="#FF0000">Red</SelectItem>
                      <SelectItem value="#00FF00">Green</SelectItem>
                      <SelectItem value="#0000FF">Blue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  className="rounded-l-none"
                  value={isTitle ? fontSize.title : fontSize.description}
                  onChange={(e) => {
                    const value = Number.parseInt(e.target.value) || 16
                    setFontSize({
                      ...fontSize,
                      [isTitle ? "title" : "description"]: value,
                    })
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">Line height</div>
                <div className="flex items-center p-2 bg-gray-100 rounded-md">
                  <span className="text-gray-500 mr-2">A</span>
                  <span className="text-gray-700">Auto</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Letter spacing</div>
                <div className="flex items-center p-2 bg-gray-100 rounded-md">
                  <span className="text-gray-500 mr-2">|A|</span>
                  <span className="text-gray-700">0%</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Alignment</div>
              <div className="flex gap-1">
                <Button
                  variant={textAlignment === "left" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTextAlignment("left")}
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={textAlignment === "center" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTextAlignment("center")}
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant={textAlignment === "right" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTextAlignment("right")}
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
                <Button
                  variant={textAlignment === "justify" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTextAlignment("justify")}
                >
                  <AlignJustify className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label>Vertical Position</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={isTitle ? currentBanner.verticalOffset?.title || 0 : currentBanner.verticalOffset?.description || 0}
                    className="w-[80px]"
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(e) => {
                      const value = Number(e.target.value);
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
                  />
                  <span className="text-sm text-gray-500">px</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label>Rotation</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={currentBanner.rotation?.[isTitle ? 'title' : 'description'] || 0}
                    className="w-[80px]"
                    min={-360}
                    max={360}
                    step={1}
                    onChange={(e) => {
                      const value = Number(e.target.value);
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
                  />
                  <span className="text-sm text-gray-500">°</span>
                </div>
              </div>
            </div>
          </div>
        )

      case "text-block":
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-500">Title</Label>
              <Input
                value={getPreviewContent(activeLanguage, currentBanner.id || 1, "title") || ""}
                onChange={(e) => {
                  const previewKey = `preview_${currentBanner.id}_title`;
                  const newLocalizedContent = { ...localizedContent };
                  if (!newLocalizedContent[activeLanguage]) {
                    newLocalizedContent[activeLanguage] = {};
                  }
                  newLocalizedContent[activeLanguage][previewKey] = e.target.value;
                  setLocalizedContent(newLocalizedContent);
                }}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm text-gray-500">Description</Label>
              <Textarea
                value={getPreviewContent(activeLanguage, currentBanner.id || 1, "description") || ""}
                onChange={(e) => {
                  const previewKey = `preview_${currentBanner.id}_description`;
                  const newLocalizedContent = { ...localizedContent };
                  if (!newLocalizedContent[activeLanguage]) {
                    newLocalizedContent[activeLanguage] = {};
                  }
                  newLocalizedContent[activeLanguage][previewKey] = e.target.value;
                  setLocalizedContent(newLocalizedContent);
                }}
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-gray-500">Font</Label>
                <Select
                  value={bannerSettings.fontFamily}
                  onValueChange={(value) => setBannerSettings({ ...bannerSettings, fontFamily: value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONTS.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <span style={{ fontFamily: font.value }}>{font.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Title Color</Label>
                  <ColorPicker
                    color={bannerSettings.titleColor}
                    onChange={(color) => setBannerSettings({ ...bannerSettings, titleColor: color })}
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Description Color</Label>
                  <ColorPicker
                    color={bannerSettings.descriptionColor}
                    onChange={(color) => setBannerSettings({ ...bannerSettings, descriptionColor: color })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Text Alignment</Label>
                <div className="flex gap-1 mt-1">
                  <Button
                    variant={textAlignment === "left" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setTextAlignment("left")}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={textAlignment === "center" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setTextAlignment("center")}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={textAlignment === "right" ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setTextAlignment("right")}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Vertical Position</Label>
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
                min={-100}
                max={100}
                unit="px"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Rotation</Label>
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
                min={-360}
                max={360}
                unit="°"
              />
            </div>
          </div>
        )

      case "device":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Device Settings</h3>

              <div>
                <Label>Position</Label>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {DEVICE_POSITIONS.map((position) => (
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
                      className={`p-1 rounded-md border ${
                        currentBanner.devicePosition === position.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-background hover:bg-muted"
                      }`}
                      title={position.label}
                    >
                      <Smartphone className="h-4 w-4 mx-auto" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Device Scale</Label>
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
                  <Label>Vertical Position</Label>
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
                <h3 className="text-lg font-medium">Border Settings</h3>

                <div className="space-y-3">
                  <div>
                    <Label>Border Color</Label>
                    <div className="mt-2">
                      <ColorPicker
                        color={currentBanner.screenshot?.borderColor || "#000000"}
                        onChange={(color) => updateScreenshotSetting("borderColor", color)}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Border Width</Label>
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
                      <Label>Border Radius</Label>
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
                  <Label>Rotation</Label>
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
    const currentRotation = item.rotation || { device: 0, title: 0, description: 0, textBlock: 0 }

    // Helper function to render editable text
    const renderEditableText = (type, content, elementStyle, additionalStyle = {}) => {
      const isEditing = editingText && editingText.type === type && editingText.bannerId === item.id;
      
      // Calculate consistent dimensions for both view and edit modes
      const containerStyle = {
        ...additionalStyle,
        width: '100%',
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
        key={item.id}
        className={`relative cursor-pointer transition-all ${isActive ? "ring-2 ring-blue-500" : "opacity-90 hover:opacity-100"}`}
        onClick={() => setPreviewIndex(index)}
        style={{
          width: "320px",
          height: "690px",
          flexShrink: 0,
          borderRadius: "16px",
          overflow: "hidden",
          margin: "0 8px",
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
                className={`absolute ${isActive ? "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""}`}
                style={{
                  ...titlePosition,
                  transform: `${titlePosition.transform || ""} translateY(${currentOffset.title}px)`,
                }}
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
                className={`absolute ${isActive ? "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""}`}
                style={{
                  ...descriptionPosition,
                  transform: `${descriptionPosition.transform || ""} translateY(${currentOffset.description}px)`,
                }}
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
              className={`absolute ${isActive ? "hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""}`}
              style={{
                ...titlePosition,
                transform: `${titlePosition.transform || ""} translateY(${currentOffset.combined}px) rotate(${currentRotation.textBlock}deg)`,
              }}
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
            className={`absolute banner-device-target ${isActive ? "cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50" : ""}`}
            data-banner-id={index}
            style={getDevicePositionStyles(item)}
            onDoubleClick={(e) => {
              if (isActive) {
                e.stopPropagation()
                setActiveElement("device")
              }
            }}
          >
            {item.screenshot?.file ? (
              <div
                style={{
                  borderWidth: `${item.screenshot.borderWidth}px`,
                  borderStyle: "solid",
                  borderColor: item.screenshot.borderColor,
                  borderRadius: `${item.screenshot.borderRadius}px`,
                  overflow: "hidden",
                }}
              >
                <img
                  src={URL.createObjectURL(item.screenshot.file) || "/placeholder.svg"}
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
            )}
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
    const exportData = {};
    
    // Get Russian content as the reference language
    const ruContent = localizedContent["ru"] || {
      title: "",
      description: "",
      promotionalText: "",
      whatsNew: "",
      keywords: "",
    };
    
    // Add Russian content to export data
    exportData["ru"] = {
      title: ruContent.title || "",
      description: ruContent.description || "",
      promotionalText: ruContent.promotionalText || "",
      whatsNew: ruContent.whatsNew || "",
      keywords: ruContent.keywords || "",
      previews: {}
    };
    
    // Add preview-specific content for Russian
    previewItems.forEach(preview => {
      const previewKey = `preview_${preview.id}`;
      exportData["ru"].previews[previewKey] = {
        title: getPreviewContent("ru", preview.id, "title") || "",
        description: getPreviewContent("ru", preview.id, "description") || ""
      };
    });
    
    // Create empty placeholders for other languages
    const otherLanguages = LANGUAGES.filter(lang => lang.code !== "ru").map(lang => lang.code);
    
    otherLanguages.forEach(langCode => {
      const langContent = localizedContent[langCode] || {};
      
      exportData[langCode] = {
        title: langContent.title || "",
        description: langContent.description || "",
        promotionalText: langContent.promotionalText || "",
        whatsNew: langContent.whatsNew || "",
        keywords: langContent.keywords || "",
        previews: {}
      };
      
      // Add empty or existing preview-specific content for other languages
      previewItems.forEach(preview => {
        const previewKey = `preview_${preview.id}`;
        exportData[langCode].previews[previewKey] = {
          title: getPreviewContent(langCode, preview.id, "title") || "",
          description: getPreviewContent(langCode, preview.id, "description") || ""
        };
      });
    });
    
    // Create and download file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'localized_content.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      
      .banner-device-target {
        transition: all 0.2s ease-in-out;
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b py-4 px-6 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">App Store Banner Generator</h1>
            
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
                    <div className="grid gap-4">
                      <div>
                        <Label>JSON Content</Label>
                        <Textarea
                          placeholder="Paste your JSON here..."
                          value={jsonImportText}
                          onChange={(e) => setJsonImportText(e.target.value)}
                          className="font-mono min-h-[300px] bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Format</Label>
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p>Your JSON should include translations for all supported languages with the following structure:</p>
                          <pre className="bg-slate-100 p-4 rounded-md overflow-auto text-xs">
{`{
  "ru": {
    "title": "Заголовок на русском",
    "description": "Описание на русском",
    "promotionalText": "Промо-текст на русском",
    "whatsNew": "Что нового в этой версии",
    "keywords": "ключевое слово1, ключевое слово2"
  },
  "en": {
    "title": "English Title",
    "description": "English Description",
    "promotionalText": "Promotional Text in English",
    "whatsNew": "What's New in This Version",
    "keywords": "keyword1, keyword2"
  }
}`}
                          </pre>
                          <div className="mt-4 space-y-2">
                            <p className="font-semibold">Required fields for each language:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              <li><code>title</code>: Main title for the banner</li>
                              <li><code>description</code>: Detailed description</li>
                              <li><code>promotionalText</code>: App Store promotional text</li>
                              <li><code>whatsNew</code>: Update information</li>
                              <li><code>keywords</code>: Comma-separated keywords</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleJsonImport} className="w-full">
                      Import Content
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" onClick={handleJsonExport}>
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
              
              <LanguageSelector languages={LANGUAGES} activeLanguage={activeLanguage} onChange={handleLanguageChange} />
              
              <Button variant="primary" onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting {exportingProgress}%
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Export All Images
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  if (confirm("Это действие сбросит все настройки. Продолжить?")) {
                    // Очищаем localStorage
                    localStorage.clear();
                    
                    // Очищаем IndexedDB
                    if (imageDBRef.current) {
                      imageDBRef.current.clearAll()
                        .then(() => {
                          console.log('IndexedDB успешно очищен');
                          window.location.reload();
                        })
                        .catch(error => {
                          console.error('Ошибка при очистке IndexedDB:', error);
                          window.location.reload();
                        });
                    } else {
                      window.location.reload();
                    }
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Сбросить
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-2">
            Create beautiful banners for your App Store listings
          </p>
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

                  {/* Active banner reference */}
                  <div className="hidden">
                    <div
                      className="relative"
                      ref={canvasRef}
                      style={{
                        width: "320px",
                        height: "690px",
                        backgroundColor: previewItems[previewIndex]?.backgroundColor || "#007AFF",
                        overflow: "hidden",
                      }}
                    >
                      <div className="absolute inset-0">
                        {/* Title and description - position changes based on device position */}
                        {(() => {
                          const currentBanner = previewItems[previewIndex] || {};
                          const { titlePosition, descriptionPosition, separateElements } = getContentPositions(currentBanner.devicePosition || "center");
                          
                          // Render title and description
                          const renderContent = () => {
                            if (separateElements) {
                              return (
                                <>
                                  {/* Title at the top */}
                                  <div
                                    className="absolute"
                                    style={{
                                      ...titlePosition,
                                      transform: `${titlePosition.transform || ""} translateY(${previewItems[previewIndex]?.verticalOffset?.title || 0}px)`,
                                    }}
                                  >
                                    <h2 className="text-2xl font-bold text-center" style={getTextStyle("title")}>
                                      {getPreviewContent(activeLanguage, previewItems[previewIndex]?.id || 1, "title") || "Title"}
                                    </h2>
                                  </div>

                                  {/* Description at the bottom */}
                                  <div
                                    className="absolute"
                                    style={{
                                      ...descriptionPosition,
                                      transform: `${descriptionPosition.transform || ""} translateY(${previewItems[previewIndex]?.verticalOffset?.description || 0}px)`,
                                    }}
                                  >
                                    <p className="text-base text-center" style={getTextStyle("description")}>
                                      {getPreviewContent(activeLanguage, previewItems[previewIndex]?.id || 1, "description") || "Description"}
                                    </p>
                                  </div>
                                </>
                              );
                            } else {
                              return (
                                <div
                                  className="absolute"
                                  style={{
                                    ...titlePosition,
                                    transform: `${titlePosition.transform || ""} translateY(${previewItems[previewIndex]?.verticalOffset?.combined || 0}px)`,
                                  }}
                                >
                                  <h2 className="text-2xl font-bold mb-2 text-center" style={getTextStyle("title")}>
                                    {getPreviewContent(activeLanguage, previewItems[previewIndex]?.id || 1, "title") || "Title"}
                                  </h2>
                                  <p className="text-base text-center" style={getTextStyle("description")}>
                                    {getPreviewContent(activeLanguage, previewItems[previewIndex]?.id || 1, "description") || "Description"}
                                  </p>
                                </div>
                              );
                            }
                          };

                          // Render device/screenshot
                          const renderDevice = () => {
                            return (
                              <div className="absolute" style={getDevicePositionStyles(previewItems[previewIndex] || {})}>
                                {previewItems[previewIndex]?.screenshot?.file ? (
                                  <div
                                    style={{
                                      borderWidth: `${previewItems[previewIndex].screenshot.borderWidth}px`,
                                      borderStyle: "solid",
                                      borderColor: previewItems[previewIndex].screenshot.borderColor,
                                      borderRadius: `${previewItems[previewIndex].screenshot.borderRadius}px`,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <img
                                      src={URL.createObjectURL(previewItems[previewIndex].screenshot.file) || "/placeholder.svg"}
                                      alt={`Screenshot ${previewItems[previewIndex].id}`}
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
                                      borderWidth: `${previewItems[previewIndex]?.screenshot?.borderWidth || 8}px`,
                                      borderStyle: "solid",
                                      borderColor: `${previewItems[previewIndex]?.screenshot?.borderColor || "#000000"}`,
                                      borderRadius: `${previewItems[previewIndex]?.screenshot?.borderRadius || 30}px`,
                                    }}
                                  >
                                    <ImageIcon className="h-12 w-12 text-gray-400" />
                                    <span className="mt-2 text-sm text-gray-500">No screenshot</span>
                                  </div>
                                )}
                              </div>
                            );
                          };

                          return (
                            <>
                              {renderContent()}
                              {renderDevice()}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right panel - Settings */}
          <div>
            {/* Панель настроек, растянутая на всю высоту экрана, но ниже шапки */}
            <div className="fixed top-0 right-0 h-screen w-[320px]" style={{ paddingTop: 'calc(6rem + 1px)' }}>
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
  )
}

