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

export default function BannerGenerator() {
  const [activeLanguage, setActiveLanguage] = useState("en")
  const [bannerSettings, setBannerSettings] = useState(DEFAULT_SETTINGS)
  const [localizedContent, setLocalizedContent] = useState({
    en: { title: "TEST TITLE", description: "TEST description" },
  })
  const [isExporting, setIsExporting] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [jsonImportText, setJsonImportText] = useState("")
  const [activeElement, setActiveElement] = useState("banner") // banner, title, description, device
  const [textAlignment, setTextAlignment] = useState("center")
  const [fontSize, setFontSize] = useState({ title: 24, description: 16 })
  const [lineHeight, setLineHeight] = useState({ title: "auto", description: "auto" })
  const [letterSpacing, setLetterSpacing] = useState({ title: 0, description: 0 })
  const canvasRef = useRef(null)
  const scrollContainerRef = useRef(null)
  
  // Создаем экземпляр ImageDB
  const imageDBRef = useRef<ImageDB | null>(null);

  // Инициализация imageDB
  useEffect(() => {
    if (typeof window !== 'undefined') {
      imageDBRef.current = new ImageDB();
    }
  }, []);

  // Новая структура данных для баннеров с уникальными настройками
  const [previewItems, setPreviewItems] = useState([
    {
      id: 1,
      name: "Preview 1",
      backgroundColor: "#FFD700",
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
    {
      id: 2,
      name: "Preview 2",
      backgroundColor: "#F5F5DC",
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
    {
      id: 3,
      name: "Preview 3",
      backgroundColor: "#FF6347",
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
    {
      id: 4,
      name: "Preview 4",
      backgroundColor: "#FFDAB9",
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

  // Загрузка данных из localStorage при инициализации
  useEffect(() => {
    // Проверка доступности localStorage
    const isLocalStorageAvailable = () => {
      try {
        const testKey = '__localStorage_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    };

    if (!isLocalStorageAvailable()) {
      console.warn('localStorage is not available');
      return;
    }

    // Загрузка настроек из localStorage
    try {
      const savedSettings = localStorage.getItem('bannerSettings');
      const savedContent = localStorage.getItem('localizedContent');
      const savedPreviews = localStorage.getItem('previewItems');
      const savedTextAlignment = localStorage.getItem('textAlignment');
      const savedFontSize = localStorage.getItem('fontSize');
      
      if (savedSettings) {
        setBannerSettings(JSON.parse(savedSettings));
      }
      
      if (savedContent) {
        setLocalizedContent(JSON.parse(savedContent));
      }
      
      if (savedPreviews) {
        // При загрузке превью, скриншоты теряются, так как File объекты нельзя сериализовать
        const parsedPreviews = JSON.parse(savedPreviews);
        // Восстанавливаем превью без файлов скриншотов
        setPreviewItems(parsedPreviews.map((item: any) => ({
          ...item,
          screenshot: {
            ...item.screenshot,
            file: null // Файлы не могут быть сохранены в localStorage
          }
        })));

        // Загружаем изображения из IndexedDB, если он доступен
        if (typeof window !== 'undefined' && imageDBRef.current) {
          // Загружаем изображения для каждого превью
          parsedPreviews.forEach(async (item: any) => {
            try {
              const imageId = `preview_${item.id}`;
              const file = await imageDBRef.current?.getImage(imageId);
              if (file) {
                const updatedItems = [...parsedPreviews].map((p: any) => 
                  p.id === item.id ? { ...p, screenshot: { ...p.screenshot, file } } : p
                );
                setPreviewItems(updatedItems);
              }
            } catch (error) {
              console.error('Error loading image from IndexedDB:', error);
            }
          });
        }
      }
      
      if (savedTextAlignment) {
        setTextAlignment(savedTextAlignment);
      }
      
      if (savedFontSize) {
        setFontSize(JSON.parse(savedFontSize));
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  }, []);
  
  // Сохранение данных в localStorage при изменении
  useEffect(() => {
    // Проверка доступности localStorage перед сохранением
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      localStorage.setItem('bannerSettings', JSON.stringify(bannerSettings));
    } catch (error) {
      console.error('Error saving banner settings:', error);
    }
  }, [bannerSettings]);
  
  useEffect(() => {
    try {
      localStorage.setItem('localizedContent', JSON.stringify(localizedContent));
    } catch (error) {
      console.error('Error saving localized content:', error);
    }
  }, [localizedContent]);
  
  useEffect(() => {
    try {
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
  
  useEffect(() => {
    try {
      localStorage.setItem('textAlignment', textAlignment);
    } catch (error) {
      console.error('Error saving text alignment:', error);
    }
  }, [textAlignment]);
  
  useEffect(() => {
    try {
      localStorage.setItem('fontSize', JSON.stringify(fontSize));
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  }, [fontSize]);

  // Handle language change
  const handleLanguageChange = (language) => {
    setActiveLanguage(language)

    // Create content for new language if it doesn't exist
    if (!localizedContent[language]) {
      setLocalizedContent({
        ...localizedContent,
        [language]: {
          title: localizedContent.en.title,
          description: localizedContent.en.description,
        },
      })
    }
  }

  // Update content for current language
  const updateLocalizedContent = (field, value) => {
    setLocalizedContent({
      ...localizedContent,
      [activeLanguage]: {
        ...localizedContent[activeLanguage],
        [field]: value,
      },
    })
  }

  // Перехватываем изменение screenshot.file для сохранения в IndexedDB
  const handleScreenshotUpload = (file: File) => {
    const updatedItems = [...previewItems];
    if (updatedItems[previewIndex]) {
      updatedItems[previewIndex] = {
        ...updatedItems[previewIndex],
        screenshot: {
          ...updatedItems[previewIndex].screenshot,
          file,
        },
      };
      setPreviewItems(updatedItems);
      
      // Сохраняем в IndexedDB
      if (imageDBRef.current) {
        const imageId = `preview_${updatedItems[previewIndex].id}`;
        imageDBRef.current.saveImage(imageId, file)
          .catch(error => console.error('Error saving image to IndexedDB:', error));
      }
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

  // Get device position styles based on the selected position
  const getDevicePositionStyles = (banner) => {
    // Base width for the device - this will be scaled
    const baseWidth = 220
    const devicePosition = banner.devicePosition
    const deviceScale = banner.deviceScale
    const deviceOffset = banner.verticalOffset?.device || 0

    // Базовые стили в зависимости от позиции
    let baseStyles = {}

    switch (devicePosition) {
      case "top-left":
        baseStyles = {
          top: "20%",
          left: "25%",
        }
        break
      case "top-center":
        baseStyles = {
          top: "20%",
          left: "50%",
        }
        break
      case "top-right":
        baseStyles = {
          top: "20%",
          right: "25%",
        }
        break
      case "center-left":
        baseStyles = {
          top: "50%",
          left: "25%",
        }
        break
      case "center":
        baseStyles = {
          top: "50%",
          left: "50%",
        }
        break
      case "center-right":
        baseStyles = {
          top: "50%",
          right: "25%",
        }
        break
      case "bottom-left":
        baseStyles = {
          bottom: "20%",
          left: "25%",
        }
        break
      case "bottom-center":
        baseStyles = {
          bottom: "20%",
          left: "50%",
        }
        break
      case "bottom-right":
        baseStyles = {
          bottom: "20%",
          right: "25%",
        }
        break
      default:
        baseStyles = {
          top: "50%",
          left: "50%",
        }
    }

    // Создаем трансформацию с учетом позиции, масштаба и вертикального смещения
    let transform = ""

    // Добавляем translate в зависимости от позиции
    if (devicePosition.includes("left")) {
      transform += "translateX(-50%) "
    } else if (devicePosition.includes("right")) {
      transform += "translateX(50%) "
    } else {
      transform += "translateX(-50%) "
    }

    if (devicePosition.includes("top")) {
      transform += "translateY(-50%) "
    } else if (devicePosition.includes("bottom")) {
      transform += "translateY(50%) "
    } else {
      transform += "translateY(-50%) "
    }

    // Добавляем масштаб
    transform += `scale(${deviceScale / 100}) `

    // Добавляем вертикальное смещение
    if (deviceOffset !== 0) {
      transform += `translateY(${deviceOffset}px)`
    }

    return {
      ...baseStyles,
      transform,
      transformOrigin: "center",
      width: `${baseWidth}px`,
    }
  }

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
      if (typeof importedData === "object") {
        // If it's a language-based structure
        if (Object.keys(importedData).some((key) => LANGUAGES.some((lang) => lang.code === key))) {
          setLocalizedContent(importedData)
        }
        // If it's a preview-based structure with languages
        else if (Array.isArray(importedData) && importedData.length > 0 && importedData[0].languages) {
          // Create a new localized content object
          const newLocalizedContent = { ...localizedContent }

          // Process each preview item
          importedData.forEach((item, index) => {
            const previewId = index + 1

            // Process each language for this preview
            if (item.languages && typeof item.languages === "object") {
              Object.keys(item.languages).forEach((langCode) => {
                // Create language if it doesn't exist
                if (!newLocalizedContent[langCode]) {
                  newLocalizedContent[langCode] = {}
                }

                // Add content for this preview
                newLocalizedContent[langCode][`preview_${previewId}_title`] = item.languages[langCode].title || ""
                newLocalizedContent[langCode][`preview_${previewId}_description`] =
                  item.languages[langCode].description || ""
              })
            }
          })

          setLocalizedContent(newLocalizedContent)
        } else {
          alert("Invalid JSON format. Please check the structure.")
        }
      } else {
        alert("Invalid JSON format. Please provide a valid object.")
      }
    } catch (error) {
      alert(`Error parsing JSON: ${error.message}`)
    }
  }

  // Handle drag and drop for the entire application
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e) => {
      e.preventDefault()
      e.stopPropagation()

      // If we have a file, add it to the current banner
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleScreenshotUpload(e.dataTransfer.files[0])
      }
    }

    // Add event listeners to the window
    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("drop", handleDrop)

    // Clean up
    return () => {
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("drop", handleDrop)
    }
  }, [previewIndex])

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    console.log('Starting export process...');
    
    try {
      // Создаем временный канвас для экспорта, чтобы не полагаться на скрытый элемент
      const tempCanvas = document.createElement('div');
      tempCanvas.style.width = '320px';
      tempCanvas.style.height = '690px';
      tempCanvas.style.position = 'absolute';
      tempCanvas.style.left = '-9999px';
      tempCanvas.style.top = '-9999px';
      document.body.appendChild(tempCanvas);
      
      // Создаем один общий ZIP-архив для всех баннеров
      const zip = new JSZip();
      console.log('Preparing to export', previewItems.length, 'banners to a single ZIP archive');
      
      for (const banner of previewItems) {
        console.log('Exporting banner', banner.id, 'with name', banner.name);
        
        // Готовим индивидуальный контент для каждого баннера
        const bannerContent: Record<string, { title: string; description: string }> = {};
        
        // Собираем контент для всех доступных языков
        Object.keys(localizedContent).forEach(langCode => {
          bannerContent[langCode] = {
            title: getPreviewContent(langCode, banner.id, "title") || "",
            description: getPreviewContent(langCode, banner.id, "description") || ""
          };
        });
        
        console.log('Content prepared for languages:', Object.keys(bannerContent));
        
        // Настраиваем временный канвас для текущего баннера
        tempCanvas.innerHTML = '';
        tempCanvas.style.backgroundColor = banner.backgroundColor;
        
        // Создаем структуру канваса соответствующую структуре оригинального баннера
        const { titlePosition, descriptionPosition, separateElements } = getContentPositions(banner.devicePosition);
        const currentOffset = banner.verticalOffset || { combined: 0, title: 0, description: 0, device: 0 };
        
        // Добавляем текстовые элементы
        if (separateElements) {
          // Титул
          const titleDiv = document.createElement('div');
          titleDiv.style.position = 'absolute';
          Object.assign(titleDiv.style, titlePosition);
          titleDiv.style.transform = `${titlePosition.transform || ""} translateY(${currentOffset.title}px)`;
          
          const titleH2 = document.createElement('h2');
          titleH2.textContent = getPreviewContent(activeLanguage, banner.id, "title") || "Title";
          titleH2.className = "text-2xl font-bold text-center";
          Object.assign(titleH2.style, getTextStyle("title"));
          
          titleDiv.appendChild(titleH2);
          tempCanvas.appendChild(titleDiv);
          
          // Описание
          const descDiv = document.createElement('div');
          descDiv.style.position = 'absolute';
          Object.assign(descDiv.style, descriptionPosition);
          descDiv.style.transform = `${descriptionPosition.transform || ""} translateY(${currentOffset.description}px)`;
          
          const descP = document.createElement('p');
          descP.textContent = getPreviewContent(activeLanguage, banner.id, "description") || "Description";
          descP.className = "text-base text-center";
          Object.assign(descP.style, getTextStyle("description"));
          
          descDiv.appendChild(descP);
          tempCanvas.appendChild(descDiv);
        } else {
          // Комбинированный блок
          const textDiv = document.createElement('div');
          textDiv.style.position = 'absolute';
          Object.assign(textDiv.style, titlePosition);
          textDiv.style.transform = `${titlePosition.transform || ""} translateY(${currentOffset.combined}px)`;
          
          const titleH2 = document.createElement('h2');
          titleH2.textContent = getPreviewContent(activeLanguage, banner.id, "title") || "Title";
          titleH2.className = "text-2xl font-bold mb-2 text-center";
          Object.assign(titleH2.style, getTextStyle("title"));
          
          const descP = document.createElement('p');
          descP.textContent = getPreviewContent(activeLanguage, banner.id, "description") || "Description";
          descP.className = "text-base text-center";
          Object.assign(descP.style, getTextStyle("description"));
          
          textDiv.appendChild(titleH2);
          textDiv.appendChild(descP);
          tempCanvas.appendChild(textDiv);
        }
        
        // Добавляем устройство/скриншот
        const deviceDiv = document.createElement('div');
        deviceDiv.style.position = 'absolute';
        Object.assign(deviceDiv.style, getDevicePositionStyles(banner));
        
        if (banner.screenshot?.file) {
          const deviceContainer = document.createElement('div');
          deviceContainer.style.borderWidth = `${banner.screenshot.borderWidth}px`;
          deviceContainer.style.borderStyle = 'solid';
          deviceContainer.style.borderColor = banner.screenshot.borderColor;
          deviceContainer.style.borderRadius = `${banner.screenshot.borderRadius}px`;
          deviceContainer.style.overflow = 'hidden';
          
          const img = document.createElement('img');
          img.src = URL.createObjectURL(banner.screenshot.file);
          img.style.width = '100%';
          img.style.display = 'block';
          
          deviceContainer.appendChild(img);
          deviceDiv.appendChild(deviceContainer);
        } else {
          deviceDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center p-4" style="
              width: 100%;
              height: 400px;
              border-width: ${banner.screenshot?.borderWidth || 8}px;
              border-style: solid;
              border-color: ${banner.screenshot?.borderColor || "#000000"};
              border-radius: ${banner.screenshot?.borderRadius || 30}px;
              background-color: #f9f9f9;
            ">
              <div style="width: 48px; height: 48px; color: #ccc; text-align: center;">📷</div>
              <span style="margin-top: 8px; font-size: 14px; color: #888;">No screenshot</span>
            </div>
          `;
        }
        
        tempCanvas.appendChild(deviceDiv);
        
        console.log('Canvas prepared for banner', banner.id);
        
        // Для каждого языка создаем изображение и добавляем в ZIP
        const languages = Object.keys(bannerContent);
        for (const lang of languages) {
          console.log(`Processing language: ${lang} for banner ${banner.id}`);
          
          // Обновляем текст в соответствии с языком
          const titleElement = tempCanvas.querySelector("h2");
          const descriptionElement = tempCanvas.querySelector("p");
          
          if (titleElement && bannerContent[lang]?.title) {
            titleElement.textContent = bannerContent[lang].title;
          }
          
          if (descriptionElement && bannerContent[lang]?.description) {
            descriptionElement.textContent = bannerContent[lang].description;
          }
          
          try {
            // Создаем изображение из канваса
            const canvas = await html2canvas(tempCanvas, {
              scale: 2, // Higher scale for better quality
              useCORS: true,
              allowTaint: true,
              backgroundColor: banner.backgroundColor,
            });
            
            // Конвертируем в blob
            const blob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('Failed to create blob from canvas'));
                }
              }, "image/png", 1.0);
            });
            
            // Добавляем в общий ZIP-архив
            const bannerName = banner.name || `Banner ${banner.id}`;
            const filename = `${bannerName}_${lang}.png`;
            console.log(`Adding ${filename} to the common ZIP`);
            zip.file(filename, blob);
          } catch (error) {
            console.error(`Error processing banner ${banner.id} for language ${lang}:`, error);
          }
        }
        
        console.log('Banner', banner.id, 'exported successfully');
        
        // Очищаем URL объекты
        if (banner.screenshot?.file) {
          URL.revokeObjectURL(URL.createObjectURL(banner.screenshot.file));
        }
      }
      
      // Генерируем и скачиваем общий ZIP-архив
      try {
        console.log('Generating final ZIP file with all banners');
        const content = await zip.generateAsync({ 
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6
          } 
        });
        console.log(`ZIP file created with size: ${content.size} bytes, downloading...`);
        
        // Функция для скачивания
        const saveBlob = (blob: Blob, fileName: string) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        };
        
        saveBlob(content, "app_store_banners.zip");
      } catch (error) {
        console.error("Error generating final ZIP file:", error);
      }
      
      // Удаляем временный канвас
      document.body.removeChild(tempCanvas);
      console.log('Export process completed successfully');
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Get preview-specific content
  const getPreviewContent = (langCode, previewId, field) => {
    // Try to get preview-specific content first
    const specificKey = `preview_${previewId}_${field}`
    if (localizedContent[langCode] && localizedContent[langCode][specificKey] !== undefined) {
      return localizedContent[langCode][specificKey]
    }

    // Fall back to general content
    return localizedContent[langCode]?.[field] || ""
  }

  // Обновим функцию getTextStyle, чтобы учитывать вертикальное смещение
  const getTextStyle = (elementType) => {
    const baseStyle = {
      color: elementType === "title" ? bannerSettings.titleColor : bannerSettings.descriptionColor,
      fontFamily: bannerSettings.fontFamily,
      textAlign: textAlignment,
      fontSize: `${elementType === "title" ? fontSize.title : fontSize.description}px`,
      lineHeight: elementType === "title" ? lineHeight.title : lineHeight.description,
      letterSpacing: `${elementType === "title" ? letterSpacing.title : letterSpacing.description}%`,
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
                      setLocalizedContent({
                        ...localizedContent,
                        [activeLanguage]: {
                          ...localizedContent[activeLanguage],
                          promotionalText: e.target.value,
                        },
                      })
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
                      setLocalizedContent({
                        ...localizedContent,
                        [activeLanguage]: {
                          ...localizedContent[activeLanguage],
                          description: e.target.value,
                        },
                      })
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
                      setLocalizedContent({
                        ...localizedContent,
                        [activeLanguage]: {
                          ...localizedContent[activeLanguage],
                          whatsNew: e.target.value,
                        },
                      })
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
                      setLocalizedContent({
                        ...localizedContent,
                        [activeLanguage]: {
                          ...localizedContent[activeLanguage],
                          keywords: e.target.value,
                        },
                      })
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
                    const previewId = currentBanner.id || 1
                    const specificKey = `preview_${previewId}_title`

                    setLocalizedContent({
                      ...localizedContent,
                      [activeLanguage]: {
                        ...localizedContent[activeLanguage],
                        [specificKey]: e.target.value,
                      },
                    })
                  }}
                  className="mt-1"
                />
              ) : (
                <Textarea
                  value={getPreviewContent(activeLanguage, currentBanner.id || 1, "description") || ""}
                  onChange={(e) => {
                    const previewId = currentBanner.id || 1
                    const specificKey = `preview_${previewId}_description`

                    setLocalizedContent({
                      ...localizedContent,
                      [activeLanguage]: {
                        ...localizedContent[activeLanguage],
                        [specificKey]: e.target.value,
                      },
                    })
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
              <div className="flex justify-between">
                <div className="text-xs text-gray-500">Vertical Position</div>
                <span className="text-xs text-gray-500">
                  {isTitle ? currentBanner.verticalOffset?.title || 0 : currentBanner.verticalOffset?.description || 0}
                  px
                </span>
              </div>
              <Slider
                value={[
                  isTitle ? currentBanner.verticalOffset?.title || 0 : currentBanner.verticalOffset?.description || 0,
                ]}
                min={-100}
                max={100}
                step={1}
                className="mt-2"
                onValueChange={(value) => {
                  const updatedItems = [...previewItems]
                  if (updatedItems[previewIndex]) {
                    updatedItems[previewIndex] = {
                      ...updatedItems[previewIndex],
                      verticalOffset: {
                        ...updatedItems[previewIndex].verticalOffset,
                        [isTitle ? "title" : "description"]: value[0],
                      },
                    }
                    setPreviewItems(updatedItems)
                  }
                }}
              />
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
                  const previewId = currentBanner.id || 1
                  const specificKey = `preview_${previewId}_title`

                  setLocalizedContent({
                    ...localizedContent,
                    [activeLanguage]: {
                      ...localizedContent[activeLanguage],
                      [specificKey]: e.target.value,
                    },
                  })
                }}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm text-gray-500">Description</Label>
              <Textarea
                value={getPreviewContent(activeLanguage, currentBanner.id || 1, "description") || ""}
                onChange={(e) => {
                  const previewId = currentBanner.id || 1
                  const specificKey = `preview_${previewId}_description`

                  setLocalizedContent({
                    ...localizedContent,
                    [activeLanguage]: {
                      ...localizedContent[activeLanguage],
                      [specificKey]: e.target.value,
                    },
                  })
                }}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <div className="flex justify-between">
                <div className="text-xs text-gray-500">Vertical Position</div>
                <span className="text-xs text-gray-500">{currentBanner.verticalOffset?.combined || 0}px</span>
              </div>
              <Slider
                value={[currentBanner.verticalOffset?.combined || 0]}
                min={-100}
                max={100}
                step={1}
                className="mt-2"
                onValueChange={(value) => {
                  const updatedItems = [...previewItems]
                  if (updatedItems[previewIndex]) {
                    updatedItems[previewIndex] = {
                      ...updatedItems[previewIndex],
                      verticalOffset: {
                        ...updatedItems[previewIndex].verticalOffset,
                        combined: value[0],
                      },
                    }
                    setPreviewItems(updatedItems)
                  }
                }}
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
                <div className="flex justify-between">
                  <Label>Device Scale</Label>
                  <span className="text-sm text-gray-500">{currentBanner.deviceScale || 100}%</span>
                </div>
                <Slider
                  value={[currentBanner.deviceScale || 100]}
                  min={50}
                  max={150}
                  step={5}
                  className="mt-2"
                  onValueChange={(value) => {
                    const updatedItems = [...previewItems]
                    if (updatedItems[previewIndex]) {
                      updatedItems[previewIndex] = {
                        ...updatedItems[previewIndex],
                        deviceScale: value[0],
                      }
                      setPreviewItems(updatedItems)
                    }
                  }}
                />
              </div>

              <div>
                <div className="flex justify-between">
                  <Label>Vertical Position</Label>
                  <span className="text-sm text-gray-500">{currentBanner.verticalOffset?.device || 0}px</span>
                </div>
                <Slider
                  value={[currentBanner.verticalOffset?.device || 0]}
                  min={-100}
                  max={100}
                  step={1}
                  className="mt-2"
                  onValueChange={(value) => {
                    const updatedItems = [...previewItems]
                    if (updatedItems[previewIndex]) {
                      updatedItems[previewIndex] = {
                        ...updatedItems[previewIndex],
                        verticalOffset: {
                          ...updatedItems[previewIndex].verticalOffset,
                          device: value[0],
                        },
                      }
                      setPreviewItems(updatedItems)
                    }
                  }}
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
                    <div className="flex justify-between">
                      <Label>Border Width</Label>
                      <span className="text-sm text-gray-500">{currentBanner.screenshot?.borderWidth || 8}px</span>
                    </div>
                    <Slider
                      value={[currentBanner.screenshot?.borderWidth || 8]}
                      min={0}
                      max={20}
                      step={1}
                      className="mt-2"
                      onValueChange={(value) => updateScreenshotSetting("borderWidth", value[0])}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between">
                      <Label>Border Radius</Label>
                      <span className="text-sm text-gray-500">{currentBanner.screenshot?.borderRadius || 30}px</span>
                    </div>
                    <Slider
                      value={[currentBanner.screenshot?.borderRadius || 30]}
                      min={0}
                      max={60}
                      step={1}
                      className="mt-2"
                      onValueChange={(value) => updateScreenshotSetting("borderRadius", value[0])}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  // Функция для рендеринга баннера
  const renderBanner = (item, index) => {
    const isActive = index === previewIndex
    const { titlePosition, descriptionPosition, separateElements } = getContentPositions(item.devicePosition)
    const currentOffset = item.verticalOffset || { combined: 0, title: 0, description: 0, device: 0 }

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
                className={`absolute ${isActive ? "cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""}`}
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
                <h2 className="text-2xl font-bold text-center" style={getTextStyle("title")}>
                  {getPreviewContent(activeLanguage, item.id, "title") || "Title"}
                </h2>
              </div>

              {/* Description at the bottom */}
              <div
                className={`absolute ${isActive ? "cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""}`}
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
                <p className="text-base text-center" style={getTextStyle("description")}>
                  {getPreviewContent(activeLanguage, item.id, "description") || "Description"}
                </p>
              </div>
            </>
          ) : (
            <div
              className={`absolute ${isActive ? "cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50 rounded-md p-1" : ""}`}
              style={{
                ...titlePosition,
                transform: `${titlePosition.transform || ""} translateY(${currentOffset.combined}px)`,
              }}
              onDoubleClick={(e) => {
                if (isActive) {
                  e.stopPropagation()
                  setActiveElement("text-block")
                }
              }}
            >
              <h2 className="text-2xl font-bold mb-2 text-center" style={getTextStyle("title")}>
                {getPreviewContent(activeLanguage, item.id, "title") || "Title"}
              </h2>
              <p className="text-base text-center" style={getTextStyle("description")}>
                {getPreviewContent(activeLanguage, item.id, "description") || "Description"}
              </p>
            </div>
          )}

          {/* Device/Screenshot */}
          <div
            className={`absolute ${isActive ? "cursor-pointer hover:ring-2 hover:ring-blue-300 hover:ring-opacity-50" : ""}`}
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
                className={`flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 ${isActive ? "cursor-pointer" : ""}`}
                style={{
                  width: "100%",
                  height: "400px",
                  borderWidth: `${item.screenshot?.borderWidth || 8}px`,
                  borderStyle: "solid",
                  borderColor: item.screenshot?.borderColor || "#000000",
                  borderRadius: `${item.screenshot?.borderRadius || 30}px`,
                }}
                onDragOver={
                  isActive
                    ? (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.add("border-primary")
                      }
                    : undefined
                }
                onDragLeave={
                  isActive
                    ? (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.remove("border-primary")
                      }
                    : undefined
                }
                onDrop={
                  isActive
                    ? (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.currentTarget.classList.remove("border-primary")

                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleScreenshotUpload(e.dataTransfer.files[0])
                        }
                      }
                    : undefined
                }
              >
                {isActive && (
                  <input
                    type="file"
                    id={`screenshot-upload-${item.id}`}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Шапка на всю ширину */}
      <header className="w-full bg-white border-b py-4 px-6 z-10">
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
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Localized Content</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Textarea
                      placeholder="Paste your JSON here..."
                      value={jsonImportText}
                      onChange={(e) => setJsonImportText(e.target.value)}
                      rows={10}
                    />
                    <div className="text-xs text-gray-500">
                      <p>Expected format:</p>
                      <pre className="mt-1 bg-gray-100 p-2 rounded overflow-auto">
                        {`{
  "en": { "title": "English Title", "description": "English Description" },
  "fr": { "title": "French Title", "description": "French Description" }
}`}
                      </pre>
                    </div>
                    <Button onClick={handleJsonImport} className="w-full">
                      Import
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <LanguageSelector languages={LANGUAGES} activeLanguage={activeLanguage} onChange={handleLanguageChange} />
              
              <Button onClick={handleExport} disabled={isExporting} title="Экспортирует все баннеры для всех языков в ZIP-архив">
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Экспорт..." : "Экспорт всех баннеров"}
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

      {/* Основное содержимое с отступом от шапки */}
      <div className="flex-grow container mx-auto px-4 py-6">
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500">
                      {previewIndex > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500"
                          onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">Double-click on elements to edit them</div>
                    <div className="text-sm text-gray-500">
                      {previewIndex < previewItems.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-500"
                          onClick={() => setPreviewIndex(Math.min(previewItems.length - 1, previewIndex + 1))}
                        >
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
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
            <div className="fixed top-0 right-0 h-screen pt-[calc(4rem+2px)] w-[320px]" style={{ paddingTop: 'calc(4rem + 1px)' }}>
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

