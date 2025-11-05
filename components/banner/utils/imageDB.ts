// Класс для работы с IndexedDB
export class ImageDB {
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
            request.onerror = (event) => {
              console.error('Error putting data in IndexedDB:', event);
              reject(event);
            };
          } catch (err) {
            console.error('Catch error in transaction:', err);
            reject(err);
          }
        };

        reader.onerror = (event) => reject(event);
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Outer catch error:', err);
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
            console.log(`No image found in IndexedDB for id: ${id}`);
            resolve(null);
            return;
          }

          try {
            const dataUrl = result.data as string;
            console.log(`Found image data for ${id}, type: ${result.type}, data length: ${dataUrl.length}`);

            // Преобразование data URL обратно в File
            const parts = dataUrl.split(',');
            if (parts.length !== 2 || !parts[0].startsWith('data:')) {
              console.error(`Invalid data URL format for ${id}:`, dataUrl.substring(0, 100));
              resolve(null);
              return;
            }

            const mimeType = parts[0].match(/:(.*?);/)?.[1] || result.type;
            const binary = atob(parts[1]);
            const array = new Uint8Array(binary.length);

            for (let i = binary.length; i--;) {
              array[i] = binary.charCodeAt(i);
            }

            const blob = new Blob([array], { type: mimeType });
            const file = new File([blob], `preview_${id}.${mimeType.split('/')[1]}`, {
              type: mimeType,
              lastModified: result.lastModified
            });

            console.log(`Successfully reconstructed File for ${id}:`, file.name, file.size, 'bytes');
            resolve(file);
          } catch (error) {
            console.error(`Error reconstructing File for ${id}:`, error);
            resolve(null);
          }
        };

        request.onerror = (event) => {
          console.error(`IndexedDB get error for ${id}:`, event);
          reject(event);
        };
      } catch (err) {
        console.error(`Outer catch error in getImage for ${id}:`, err);
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
