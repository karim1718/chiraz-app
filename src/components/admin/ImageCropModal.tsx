import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, RotateCw, Loader2 } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
  /** Aperçu de l’image (label de couleur, nom du fichier, etc.). */
  caption?: string;
}

const ASPECT_PRESETS: Array<{ id: string; label: string; ratio: number | null }> = [
  { id: 'free', label: 'Libre', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
];

/**
 * Charge une URL d’image (Supabase public ou base64) en HTMLImageElement,
 * en activant CORS pour éviter le canvas tainted lors de l’export.
 */
async function loadImageAsCanvasSource(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Découpe l’image source dans un canvas selon la zone (en pixels) renvoyée par
 * react-easy-crop, applique une rotation optionnelle, et exporte un Blob JPEG.
 */
async function getCroppedBlob(
  imageUrl: string,
  pixelCrop: Area,
  rotation: number,
): Promise<Blob> {
  const image = await loadImageAsCanvasSource(imageUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = image.width * cos + image.height * sin;
  const rotH = image.width * sin + image.height * cos;

  // Étape 1 : on dessine l’image rotée sur un canvas intermédiaire.
  const rotated = document.createElement('canvas');
  rotated.width = rotW;
  rotated.height = rotH;
  const rctx = rotated.getContext('2d');
  if (!rctx) throw new Error('Canvas indisponible');
  rctx.translate(rotW / 2, rotH / 2);
  rctx.rotate(radians);
  rctx.drawImage(image, -image.width / 2, -image.height / 2);

  // Étape 2 : on extrait la zone de crop dans un canvas final.
  canvas.width = Math.max(1, Math.round(pixelCrop.width));
  canvas.height = Math.max(1, Math.round(pixelCrop.height));
  ctx.drawImage(
    rotated,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Conversion canvas → blob impossible'));
        else resolve(blob);
      },
      'image/jpeg',
      0.92,
    );
  });
}

export default function ImageCropModal({
  isOpen,
  imageUrl,
  onClose,
  onConfirm,
  caption,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  /** Par défaut 1:1 pour coller au cadre carré de la fiche produit (object-contain). */
  const [aspectId, setAspectId] = useState<string>('1:1');
  const [pixels, setPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setAspectId('1:1');
      setPixels(null);
      setErrorMsg(null);
    }
  }, [isOpen, imageUrl]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  if (!isOpen || !imageUrl) return null;

  const aspect = ASPECT_PRESETS.find((p) => p.id === aspectId)?.ratio ?? undefined;

  const handleConfirm = async () => {
    if (!pixels) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const blob = await getCroppedBlob(imageUrl, pixels, rotation);
      await onConfirm(blob);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Recadrage impossible : ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between bg-neutral-900 px-5 py-4 text-white">
          <div>
            <h2 className="font-serif text-lg">Recadrer l’image</h2>
            {caption && (
              <p className="mt-0.5 truncate text-xs text-neutral-300">{caption}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative flex-1 bg-neutral-100">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            objectFit="contain"
            restrictPosition
          />
        </div>

        <div className="shrink-0 space-y-4 border-t border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap gap-2">
            {ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAspectId(preset.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  aspectId === preset.id
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs text-neutral-700">
              <span className="font-medium">Zoom : {zoom.toFixed(2)}x</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900"
              />
            </label>
            <div className="flex items-end gap-3">
              <label className="flex flex-1 flex-col gap-1.5 text-xs text-neutral-700">
                <span className="font-medium">Rotation : {rotation}°</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900"
                />
              </label>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50"
                title="Rotation 90°"
              >
                <RotateCw size={14} /> 90°
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errorMsg}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving || !pixels}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Application…
                </>
              ) : (
                'Appliquer le recadrage'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
