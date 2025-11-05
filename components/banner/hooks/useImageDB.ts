import { useRef, useEffect } from 'react';
import { ImageDB } from '../utils/imageDB';

export function useImageDB() {
  const imageDBRef = useRef<ImageDB | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      imageDBRef.current = new ImageDB();
    }
  }, []);

  return imageDBRef.current;
}
