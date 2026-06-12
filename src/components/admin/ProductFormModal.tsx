import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { supabase } from '../../lib/supabase';
import { CURRENCY } from '../../lib/vocab';
import { X, Upload, Plus, Trash2, Loader2, Crop } from 'lucide-react';
const ImageCropModal = lazy(() => import('./ImageCropModal'));
import type { Product } from '../../types/product';
import type { Variant } from '../../types/variant';
import {
  normalizeProductColorMedia,
  deriveLegacyProductImages,
} from '../../utils/productColorAssets';
import { useToast } from './ui/Toast';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess?: () => void;
}

// Type interne pour le formulaire des variants
interface FormVariant {
  id?: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
  low_stock_alert: number;
  price?: number | '';
  original_price?: number | '';
}

/** Normalise une couleur hex pour l’aperçu CSS (toujours #RRGGBB). */
function normalizeHex(hex: string): string {
  if (!hex || typeof hex !== 'string') return '#000000';
  let h = hex.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
    const r = h[1];
    const g = h[2];
    const b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return '#000000';
}

function hexMatches(a: string, b: string): boolean {
  return normalizeHex(a).toLowerCase() === normalizeHex(b).toLowerCase();
}

/** Carrés très clairs : bordure / ombre pour rester visibles sur fond blanc. */
function isVeryLightHex(hex: string): boolean {
  const n = normalizeHex(hex).slice(1);
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.82;
}

/** Palette lisible : carrés clairs + contrastes pour chaussures / cuir. */
const VARIANT_COLOR_SWATCHES: ReadonlyArray<{ label: string; hex: string }> = [
  { label: 'Blanc', hex: '#FFFFFF' },
  { label: 'Ivoire', hex: '#FFFFF0' },
  { label: 'Beige', hex: '#D4C4B0' },
  { label: 'Sable', hex: '#DBC8AC' },
  { label: 'Café', hex: '#6F4E37' },
  { label: 'Marron', hex: '#5D4037' },
  { label: 'Noir', hex: '#000000' },
  { label: 'Gris clair', hex: '#D1D5DB' },
  { label: 'Gris', hex: '#9CA3AF' },
  { label: 'Gris anthracite', hex: '#374151' },
  { label: 'Argenté', hex: '#C0C0C0' },
  { label: 'Doré', hex: '#D4AF37' },
  { label: 'Rouge', hex: '#C41E3A' },
  { label: 'Bordeaux', hex: '#722F37' },
  { label: 'Rose', hex: '#FFB6C1' },
  { label: 'Orange', hex: '#EA580C' },
  { label: 'Jaune', hex: '#FFCC00' },
  { label: 'Vert olive', hex: '#556B2F' },
  { label: 'Vert', hex: '#166534' },
  { label: 'Bleu marine', hex: '#001F54' },
  { label: 'Bleu ciel', hex: '#87CEEB' },
  { label: 'Bleu roi', hex: '#4169E1' },
  { label: 'Violet', hex: '#7C3AED' },
  { label: 'Turquoise', hex: '#40E0D0' },
];

const PRODUCT_IMAGES_BUCKET = import.meta.env.VITE_SUPABASE_PRODUCT_IMAGES_BUCKET || 'product-images';

function applyRenamesToColorMedia(
  cm: Record<string, string[]>,
  variants: FormVariant[],
  initialById: Map<string, string>,
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...cm };
  for (const v of variants) {
    if (!v.id) continue;
    const oldC = initialById.get(v.id);
    const newC = v.color.trim();
    if (!oldC || !newC || oldC === newC) continue;
    const oldUrls = next[oldC];
    if (!oldUrls?.length) continue;
    if (!next[newC]?.length) {
      next[newC] = [...oldUrls];
      delete next[oldC];
    } else {
      next[newC] = [...new Set([...(next[newC] ?? []), ...oldUrls])];
      delete next[oldC];
    }
  }
  return next;
}

function restrictMediaToVariantColors(
  cm: Record<string, string[]>,
  allowedColors: Set<string>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  allowedColors.forEach((c) => {
    if (cm[c]?.length) out[c] = [...cm[c]];
  });
  return out;
}

/**
 * Slug ASCII pour clé Supabase Storage : décompose les accents (NFD), supprime les
 * diacritiques, conserve uniquement [a-z0-9_-]. Évite « Invalid key: .../Café/... ».
 */
function slugifyColorForStorage(label: string): string {
  const ascii = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return ascii || 'default';
}

/** PostgREST / Supabase renvoie souvent un plain object, pas `instanceof Error`. */
function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const bits = [o.message, o.details, o.hint].filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0,
    );
    if (bits.length) return [...new Set(bits)].join(' — ');
    if (typeof o.code === 'string' && o.code.trim()) return `Code ${o.code}`;
  }
  try {
    const s = JSON.stringify(err);
    if (s && s !== '{}') return s;
  } catch {
    /* ignore */
  }
  return 'Erreur inconnue';
}

export default function ProductFormModal({ isOpen, onClose, product, onSuccess }: ProductFormModalProps) {
  const { showToast } = useToast();
  const isEditing = !!product;

  // Basic Info State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [category, setCategory] = useState('chaussures');
  const [gender, setGender] = useState('homme');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  /** URLs par libellé de couleur (aligné sur variants.color). */
  const [colorMedia, setColorMedia] = useState<Record<string, string[]>>({});
  const [isUploading, setIsUploading] = useState(false);
  /** État courant de la modale de recadrage. */
  const [cropTarget, setCropTarget] = useState<{ colorKey: string; index: number; url: string } | null>(null);
  const initialVariantColorsRef = useRef<Map<string, string>>(new Map());
  /** ID dossier Storage + insert `products.id` en création ; doit être régénéré à chaque nouvelle fiche (sinon 409 doublon). */
  const [tempProductId, setTempProductId] = useState(() => crypto.randomUUID());

  // Variants State
  const [variants, setVariants] = useState<FormVariant[]>([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  // Global State
  const [isSaving, setIsSaving] = useState(false);

  // Initialize Data (à chaque ouverture : évite réutiliser le même `tempProductId` → conflit 409 sur insert)
  useEffect(() => {
    if (!isOpen) return;
    initialVariantColorsRef.current = new Map();

    if (isEditing && product) {
      setName(product.name || '');
      setDescription(product.description || '');
      setPrice(product.price || '');
      setCategory(product.category || 'chaussures');
      setGender(product.gender || 'homme');
      setIsActive(product.is_active ?? true);
      setIsFeatured(product.is_featured ?? false);

      const load = async () => {
        setIsLoadingVariants(true);
        try {
          const [{ data: rows, error: ve }, { data: prow, error: pe }] = await Promise.all([
            supabase.from('variants').select('*').eq('product_id', product.id),
            supabase.from('products').select('color_media, images').eq('id', product.id).single(),
          ]);
          if (ve) throw ve;
          if (pe) console.warn('products row:', pe);

          const list = rows || [];
          const optPrice = (n: unknown): number | '' => {
            if (n === null || n === undefined) return '';
            const x = Number(n);
            return Number.isFinite(x) ? x : '';
          };
          const mapped: FormVariant[] = list.map((v: Variant) => ({
            id: v.id,
            size: v.size?.toString() || '',
            color: v.color || '',
            color_hex: v.color_hex || '#000000',
            stock: v.stock || 0,
            low_stock_alert: v.low_stock_alert || 3,
            price: optPrice(v.price),
            original_price: optPrice(v.original_price),
          }));
          setVariants(mapped);

          const idMap = new Map<string, string>();
          list.forEach((v: Variant) => idMap.set(v.id, (v.color || '').trim()));
          initialVariantColorsRef.current = idMap;

          // Ne pas recopier products.images sur chaque couleur : cela dupliquait la même galerie
          // (ex. Noir) sur toutes les variantes (ex. Café). Les URLs restent celles de color_media uniquement.
          const cm = normalizeProductColorMedia(prow?.color_media as Record<string, unknown>);
          setColorMedia(cm);
        } catch (err) {
          console.error('Erreur chargement variants:', err);
        } finally {
          setIsLoadingVariants(false);
        }
      };
      void load();
    } else {
      setTempProductId(crypto.randomUUID());
      setName('');
      setDescription('');
      setPrice('');
      setCategory('chaussures');
      setGender('homme');
      setIsActive(true);
      setIsFeatured(false);
      setColorMedia({});
      setVariants([]);
      setDeletedVariantIds([]);
      addEmptyVariant();
    }
  }, [isOpen, product?.id, isEditing]);

  const variantColorKeys = useMemo(
    () =>
      [...new Set(variants.map((v) => v.color.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'fr'),
      ),
    [variants],
  );

  if (!isOpen) return null;

  // Suppression du calcul de réduction global


  // --- Handlers ---

  const handleImageUploadForColor = async (
    colorKey: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const current = colorMedia[colorKey] || [];
    if (current.length + files.length > 5) {
      showToast('Vous pouvez ajouter au maximum 5 images par couleur.', 'error');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    const targetFolderId = isEditing ? product!.id : tempProductId;
    const safeFolder = slugifyColorForStorage(colorKey);

    try {
      const newUrls = [...current];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `products/${targetFolderId}/${safeFolder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(PRODUCT_IMAGES_BUCKET)
          .upload(filePath, file);

        if (uploadError) {
          if (uploadError.message?.toLowerCase().includes('bucket not found')) {
            throw new Error(
              `Bucket "${PRODUCT_IMAGES_BUCKET}" introuvable. Créez-le dans Supabase Storage ou configurez VITE_SUPABASE_PRODUCT_IMAGES_BUCKET.`,
            );
          }
          throw uploadError;
        }

        const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(filePath);
        newUrls.push(data.publicUrl);
      }
      setColorMedia((prev) => ({ ...prev, [colorKey]: newUrls }));
    } catch (err: unknown) {
      const msg = formatUnknownError(err);
      showToast(`Échec de l'import : ${msg}`, 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  /**
   * Recadrage : upload d’un nouveau fichier (rogné), suppression de l’ancien dans le bucket,
   * remplacement de l’URL à la même position dans color_media.
   */
  const applyCroppedImage = async (colorKey: string, index: number, blob: Blob) => {
    const targetFolderId = isEditing ? product!.id : tempProductId;
    const safeFolder = slugifyColorForStorage(colorKey);
    const fileName = `${Math.random().toString(36).substring(2)}.jpg`;
    const filePath = `products/${targetFolderId}/${safeFolder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(filePath, blob, { contentType: 'image/jpeg' });
    if (uploadError) {
      throw uploadError;
    }
    const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(filePath);

    const previousUrl = colorMedia[colorKey]?.[index];
    setColorMedia((prev) => {
      const arr = [...(prev[colorKey] || [])];
      arr[index] = data.publicUrl;
      return { ...prev, [colorKey]: arr };
    });

    if (previousUrl) {
      try {
        const pathMatch = previousUrl.match(new RegExp(`${PRODUCT_IMAGES_BUCKET}/(.*)$`));
        if (pathMatch && pathMatch[1]) {
          await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([pathMatch[1]]);
        }
      } catch (e) {
        console.warn('Suppression de l’ancienne image impossible (non bloquant)', e);
      }
    }
  };

  const removeImageFromColor = async (colorKey: string, indexToRemove: number) => {
    const urls = [...(colorMedia[colorKey] || [])];
    const urlToRemove = urls[indexToRemove];
    urls.splice(indexToRemove, 1);
    setColorMedia((prev) => ({ ...prev, [colorKey]: urls }));

    try {
      const pathMatch = urlToRemove.match(new RegExp(`${PRODUCT_IMAGES_BUCKET}/(.*)$`));
      if (pathMatch && pathMatch[1]) {
        await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([pathMatch[1]]);
      }
    } catch (e) {
      console.error("Impossible de supprimer l'image physiquement", e);
    }
  };

  const addEmptyVariant = () => {
    setVariants(prev => [...prev, {
      size: '40',
      color: '',
      color_hex: '#E7E5E4',
      stock: 0,
      low_stock_alert: 3,
      price: '',
      original_price: ''
    }]);
  };

  const updateVariant = (index: number, field: keyof FormVariant, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const pickVariantPaletteColor = (index: number, label: string, hex: string) => {
    setVariants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], color: label, color_hex: hex };
      return next;
    });
  };

  const removeVariant = (index: number) => {
    const variantToRemove = variants[index];
    if (variantToRemove.id) {
      setDeletedVariantIds(prev => [...prev, variantToRemove.id!]);
    }
    setVariants(variants.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Indiquez un nom pour ce produit.', 'error');
      return;
    }
    if (price === '') {
      showToast('Indiquez un prix de vente.', 'error');
      return;
    }
    if (variants.length === 0) {
      showToast('Ajoutez au moins une variante (pointure et couleur).', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const allowedColors = new Set(variants.map((v) => v.color.trim()).filter(Boolean));
      let cmSave = applyRenamesToColorMedia(
        colorMedia,
        variants,
        initialVariantColorsRef.current,
      );
      cmSave = restrictMediaToVariantColors(cmSave, allowedColors);
      const orderedColors = [...allowedColors];
      const legacyImages = deriveLegacyProductImages(
        cmSave,
        orderedColors,
        isEditing ? product?.images || [] : [],
      );

      const productData = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        category,
        gender,
        is_active: isActive,
        is_featured: isFeatured,
        images: legacyImages,
        color_media: cmSave,
      };

      let savedProductId = isEditing ? product!.id : tempProductId;

      if (isEditing) {
        // UPDATE PRODUCT
        const { error: pError } = await supabase
          .from('products')
          .update({ ...productData, updated_at: new Date().toISOString() })
          .eq('id', savedProductId);
        if (pError) throw pError;
      } else {
        // INSERT PRODUCT
        const { data: newProd, error: pError } = await supabase
          .from('products')
          .insert([{ ...productData, id: tempProductId }])
          .select('id')
          .single();
        if (pError) throw pError;
        savedProductId = newProd.id;
      }

      // UPSERT VARIANTS
      for (const v of variants) {
        if (!v.size.trim() || !v.color.trim()) {
          throw new Error("Toutes les pointures et couleurs doivent être renseignées.");
        }

        const variantData = {
          product_id: savedProductId,
          size: v.size.trim(),
          color: v.color.trim(),
          color_hex: v.color_hex,
          stock: Number(v.stock),
          low_stock_alert: Number(v.low_stock_alert),
          price: v.price !== '' ? Number(v.price) : null,
          original_price: v.original_price !== '' ? Number(v.original_price) : null
        };

        if (v.id) {
          // UPDATE
          const { error } = await supabase.from('variants').update(variantData).eq('id', v.id);
          if (error) throw error;
        } else {
          // INSERT
          const { error } = await supabase.from('variants').insert([variantData]);
          if (error) throw error;
        }
      }

      // DELETE VARIANTS
      if (deletedVariantIds.length > 0) {
        const { error } = await supabase.from('variants').delete().in('id', deletedVariantIds);
        if (error) throw error;
      }

      const nextRef = new Map<string, string>();
      variants.forEach((v) => {
        if (v.id) nextRef.set(v.id, v.color.trim());
      });
      initialVariantColorsRef.current = nextRef;

      showToast(
        isEditing
          ? 'Modifications enregistrées. Le produit est à jour dans le catalogue.'
          : 'Produit créé et enregistré. Il apparaît dans la liste produits.',
        'success',
      );
      if (onSuccess) onSuccess();
      onClose();

    } catch (err: unknown) {
      const msg = formatUnknownError(err);
      showToast(`Enregistrement impossible : ${msg}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-neutral-900 p-5 text-white">
          <div>
            <h2 className="flex items-center gap-3 font-serif text-xl">
              {isEditing ? `Modifier : ${product.name}` : "Nouveau produit"}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50 p-6 space-y-6">
          
          {/* SECTION 1 - Infos de base */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-neutral-900 border-b border-neutral-100 pb-2">Informations de base</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nom du produit <span className="text-red-500">*</span></label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-black outline-none" placeholder="Ex: Air Max 2026" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-black outline-none" placeholder="Description du produit..." />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">{`Prix de vente (${CURRENCY.code})`} <span className="text-red-500">*</span></label>
                <input type="number" required min="0" value={price} onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-black outline-none" placeholder="0" />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Catégorie</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-black outline-none">
                  <option value="chaussures">Chaussures</option>
                  <option value="sandales">Sandales</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Genre</label>
                <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-black outline-none">
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                  <option value="unisex">Unisex</option>
                </select>
              </div>

              <div className="md:col-span-2 flex items-center gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-black focus:ring-black rounded border-neutral-300" />
                  <span className="text-sm font-medium text-neutral-700">Produit Actif (visible)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} className="w-4 h-4 text-black focus:ring-black rounded border-neutral-300" />
                  <span className="text-sm font-medium text-neutral-700">Produit Vedette (page d'accueil)</span>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 2 - Variants */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2 mb-4">
              <h3 className="font-semibold text-neutral-900">Pointures & Couleurs <span className="text-red-500">*</span></h3>
              <button 
                onClick={addEmptyVariant}
                className="text-sm font-medium text-black hover:text-neutral-600 flex items-center gap-1"
              >
                <Plus size={16} /> Ajouter une pointure
              </button>
            </div>

            {isLoadingVariants ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-neutral-400" /></div>
            ) : (
              <div className="space-y-4">
                {variants.map((variant, idx) => {
                  const previewHex = normalizeHex(variant.color_hex);
                  return (
                  <div key={idx} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 shadow-sm">
                    <div className="flex flex-wrap md:flex-nowrap items-end gap-3">
                    <div className="w-24">
                      <label className="block text-xs text-neutral-500 mb-1">Pointure</label>
                      <select value={variant.size} onChange={e => updateVariant(idx, 'size', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded outline-none focus:border-black">
                        {[35,36,37,38,39,40,41,42,43,44,45,46].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs text-neutral-500 mb-1">Nom Couleur</label>
                      <input type="text" required value={variant.color} onChange={e => updateVariant(idx, 'color', e.target.value)} className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded outline-none focus:border-black" placeholder="Ex: Noir" />
                    </div>

                    <div className="w-20">
                      <label className="block text-[10px] text-neutral-500 mb-1">Stock</label>
                      <input type="number" min="0" value={variant.stock} onChange={e => updateVariant(idx, 'stock', Number(e.target.value))} className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded outline-none focus:border-black" />
                    </div>

                    <div className="w-24">
                      <label className="block text-[10px] text-neutral-500 mb-1">Prix (Opt.)</label>
                      <input type="number" min="0" value={variant.price} onChange={e => updateVariant(idx, 'price', e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded outline-none focus:border-black" placeholder="Base" title="Surcharge le prix de base du produit" />
                    </div>

                    <div className="w-24">
                      <label className="block text-[10px] text-neutral-500 mb-1">Barré (Opt.)</label>
                      <input type="number" min="0" value={variant.original_price} onChange={e => updateVariant(idx, 'original_price', e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded outline-none focus:border-black" placeholder="Barré" title="Prix barré pour promotion" />
                    </div>

                    <div className="flex justify-end md:ml-auto">
                      <button type="button" onClick={() => removeVariant(idx)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200/90 pt-4 sm:flex-row sm:items-start">
                      <div className="flex shrink-0 flex-col items-center gap-1 sm:w-[7.5rem]">
                        <span className="text-xs font-medium text-neutral-600">Aperçu</span>
                        <div
                          className="h-14 w-14 shrink-0 rounded-xl border-2 border-neutral-300 shadow-inner"
                          style={{ backgroundColor: previewHex }}
                          title={previewHex}
                          role="img"
                          aria-label={`Couleur actuelle ${previewHex}`}
                        />
                        <span className="font-mono text-[10px] text-neutral-500">{previewHex}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="mb-2 block text-xs font-medium text-neutral-600">Choisir une couleur</span>
                        <div className="flex flex-wrap gap-2">
                          {VARIANT_COLOR_SWATCHES.map((swatch) => {
                            const selected = hexMatches(variant.color_hex, swatch.hex);
                            const isLight = isVeryLightHex(swatch.hex);
                            return (
                              <button
                                key={`${swatch.label}-${swatch.hex}`}
                                type="button"
                                onClick={() => pickVariantPaletteColor(idx, swatch.label, swatch.hex)}
                                title={`${swatch.label} (${swatch.hex})`}
                                className={[
                                  'h-10 w-10 shrink-0 rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2',
                                  selected
                                    ? 'border-neutral-900 ring-2 ring-neutral-900 ring-offset-2 scale-[1.02]'
                                    : 'border-neutral-300 hover:border-neutral-600 hover:scale-[1.02]',
                                  isLight ? 'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]' : '',
                                ].filter(Boolean).join(' ')}
                                style={{ backgroundColor: swatch.hex }}
                              />
                            );
                          })}
                          <label
                            className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-400 bg-white text-xs font-semibold text-neutral-600 transition hover:border-neutral-800 hover:bg-neutral-50"
                            title="Couleur précise (nuancier système)"
                          >
                            <input
                              type="color"
                              value={previewHex.toLowerCase()}
                              onChange={(e) => updateVariant(idx, 'color_hex', normalizeHex(e.target.value))}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              aria-label="Choisir une couleur personnalisée"
                            />
                            +
                          </label>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                          Cliquez sur un carré pour remplir le nom et la teinte. L’aperçu correspond toujours au code hex affiché.
                        </p>
                      </div>
                    </div>
                  </div>
                  );
                })}
                {variants.length === 0 && (
                  <p className="text-sm text-red-500 italic text-center py-4">Vous devez ajouter au moins un variant.</p>
                )}
              </div>
            )}
          </div>

          {/* SECTION 3 - Photos par couleur (clés = libellés variantes) */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="border-b border-neutral-100 pb-2 mb-4">
              <h3 className="font-semibold text-neutral-900">Photos par couleur</h3>
              <p className="mt-1 text-xs text-neutral-500">
                Chaque série correspond au nom de couleur saisi dans les variantes. Première image = visuel principal pour cette couleur (max 5 par couleur). Ajoutez des photos pour chaque couleur : aucune image n’est partagée automatiquement entre les couleurs. Sur la boutique, la grande photo s’affiche dans un <strong className="text-neutral-700">cadre carré (1:1)</strong> sans rogner l’image : les fichiers paysage ou portrait laissent des bandes. Pour remplir le cadre, importez une image déjà carrée ou utilisez <strong className="text-neutral-700">Recadrer</strong> (format 1:1 proposé par défaut).
              </p>
            </div>
            {variantColorKeys.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Renseignez d&apos;abord les noms de couleur dans « Pointures &amp; Couleurs » pour activer les uploads.
              </p>
            ) : (
              <div className="space-y-8">
                {variantColorKeys.map((colorKey) => {
                  const urls = colorMedia[colorKey] || [];
                  return (
                    <div key={colorKey}>
                      <h4 className="mb-3 text-sm font-semibold text-neutral-800">
                        Couleur : <span className="text-neutral-600">{colorKey}</span>{' '}
                        <span className="font-normal text-neutral-400">
                          ({urls.length}/5)
                        </span>
                      </h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {urls.length < 5 && (
                          <label className="relative flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-black hover:bg-neutral-100">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUploadForColor(colorKey, e)}
                              disabled={isUploading}
                            />
                            {isUploading ? (
                              <Loader2 size={24} className="animate-spin text-neutral-400" />
                            ) : (
                              <>
                                <Upload size={24} className="mb-2 text-neutral-400" />
                                <span className="text-sm font-medium text-neutral-600">Ajouter</span>
                              </>
                            )}
                          </label>
                        )}
                        {urls.map((url, idx) => (
                          <div
                            key={`${colorKey}-${idx}-${url.slice(-12)}`}
                            className="group relative h-32 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100"
                          >
                            <img
                              src={url}
                              alt={`${colorKey} ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-all group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => setCropTarget({ colorKey, index: idx, url })}
                                className="rounded-full bg-white/90 p-1.5 text-neutral-700 shadow-sm transition-all hover:bg-neutral-900 hover:text-white"
                                title="Recadrer"
                                aria-label={`Recadrer ${colorKey} image ${idx + 1}`}
                              >
                                <Crop size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeImageFromColor(colorKey, idx)}
                                className="rounded-full bg-white/90 p-1.5 text-red-600 shadow-sm transition-all hover:bg-red-600 hover:text-white"
                                title="Supprimer"
                                aria-label={`Supprimer ${colorKey} image ${idx + 1}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {idx === 0 && (
                              <span className="absolute bottom-2 left-2 rounded bg-black px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm">
                                Principale
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-neutral-200 bg-white rounded-b-2xl flex justify-end gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button 
            onClick={onClose}
            disabled={isSaving || isUploading}
            className="px-5 py-2 text-sm font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors shadow-sm"
          >
            Annuler
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || isUploading || variants.length === 0}
            className="px-6 py-2 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-70 shadow-sm"
          >
            {isSaving ? <><Loader2 size={16} className="animate-spin" /> Enregistrement...</> : "Enregistrer"}
          </button>
        </div>
        
      </div>

      <Suspense fallback={null}>
        <ImageCropModal
          isOpen={!!cropTarget}
          imageUrl={cropTarget?.url ?? null}
          caption={cropTarget ? `Couleur : ${cropTarget.colorKey}` : undefined}
          onClose={() => setCropTarget(null)}
          onConfirm={async (blob) => {
            if (!cropTarget) return;
            try {
              await applyCroppedImage(cropTarget.colorKey, cropTarget.index, blob);
              showToast('Image recadrée enregistrée.', 'success');
              setCropTarget(null);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              showToast(`Recadrage impossible : ${msg}`, 'error');
              throw err;
            }
          }}
        />
      </Suspense>
    </div>
  );
}
