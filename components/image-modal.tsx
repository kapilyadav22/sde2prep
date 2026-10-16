'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';
import styles from './image-modal.module.css';

interface ImageModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImageModal({ src, alt, onClose }: ImageModalProps) {
  const [zoom, setZoom] = useState(1);

  // Reset zoom when image changes
  useEffect(() => {
    setZoom(1);
  }, [src]);

  // Handle ESC key to close
  useEffect(() => {
    if (!src) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)));
      } else if (e.key === '-' || e.key === '_') {
        setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)));
      } else if (e.key === '0') {
        setZoom(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [src, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      onClick={handleBackdropClick}
    >
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <ZoomOut size={16} />
        </button>
        <span className={styles.zoomText}>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <ZoomIn size={16} />
        </button>
        {zoom !== 1 && (
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
            title="Reset zoom (0)"
          >
            <RotateCcw size={15} />
          </button>
        )}
        <span className={styles.divider} />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className={styles.toolButton}
          aria-label="Open in new window"
          title="Open image in new window"
        >
          <ExternalLink size={16} />
        </a>
        <button
          type="button"
          className={`${styles.toolButton} ${styles.closeButton}`}
          onClick={onClose}
          aria-label="Close image preview"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      <div className={styles.imageContainer} onClick={handleBackdropClick}>
        <img
          src={src}
          alt={alt || 'Diagram full view'}
          className={styles.image}
          style={{ transform: `scale(${zoom})` }}
          onClick={e => e.stopPropagation()}
        />
      </div>

      {alt && <div className={styles.caption}>{alt}</div>}
    </div>
  );
}
