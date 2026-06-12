import { supabase } from '../lib/supabase';
import type { Order, PaymentStatus } from '../types/order';

// Erreur personnalisée pour le domaine du Stock
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

export interface OrderData {
  productId: string;
  selectedSize: number;
  selectedColor: string | null;
  fullName: string;
  phone: string;
  city: string;
  /** Prix unitaire de la ligne (une variante). */
  price: number;
  quantity?: number;
  /** Frais de livraison TTC ajoutés au total (défaut 0). */
  deliveryCost?: number;
  source?: string;
  /** Fiche client existante (vente directe B2B / Boutique). */
  customerId?: string | null;
  /** Statut logistique initial (ex. livré pour vente magasin). */
  initialOrderStatus?: string | null;
  /** Statut comptable initial (ex. en_attente_encaissement). */
  initialPaymentStatus?: string | null;
}

/**
 * Crée une nouvelle commande dans Supabase.
 * Combine de manière pseudo-atomique :
 * 1. Vérification du stock
 * 2. Création de l'ordre global (orders)
 * 3. Création des lignes de l'ordre (order_items)
 * 4. Décrémentation du stock disponible
 */
export async function createOrder(data: OrderData): Promise<string> {
  const quantity = data.quantity || 1;
  const delivery = Math.max(0, Number(data.deliveryCost ?? 0));

  // Nouveau chemin atomique côté DB (préféré)
  const { data: rpcOrderId, error: rpcError } = await supabase.rpc('create_order_with_stock', {
    p_product_id: data.productId,
    p_size: data.selectedSize,
    p_color: data.selectedColor,
    p_customer_name: data.fullName,
    p_phone: data.phone,
    p_city: data.city,
    p_total: data.price,
    p_quantity: quantity,
    p_source: data.source || 'web',
    p_customer_id: data.customerId ?? null,
    p_order_status: data.initialOrderStatus ?? null,
    p_payment_status: data.initialPaymentStatus ?? null,
    p_delivery_cost: delivery,
  });

  if (!rpcError && rpcOrderId) {
    return rpcOrderId as string;
  }

  if (rpcError) {
    throw new Error(rpcError.message || 'Impossible de créer la commande.');
  }

  // --- Fallback legacy (admin session uniquement) ---
  const { data: sessionData } = await supabase.auth.getSession();
  const isAdmin = sessionData.session?.user?.app_metadata?.role === 'admin';
  if (!isAdmin) {
    throw new Error('Impossible de créer la commande. Réessayez plus tard.');
  }

  // --- ÉTAPE 1 : VÉRIFICATION DU STOCK ---
  let query = supabase
    .from('variants')
    .select('id, stock, products(name)')
    .eq('product_id', data.productId)
    .eq('size', data.selectedSize);

  if (data.selectedColor) {
    query = query.eq('color', data.selectedColor);
  }

  const { data: variants, error: variantError } = await query.single();

  if (variantError || !variants) {
    throw new Error('Impossible de trouver la variante exacte (pointure/couleur).');
  }

  const pName = (variants.products as any)?.name || 'Ce produit';
  // Fallback legacy: quantité fournie (par défaut 1).

  if (variants.stock === 0) {
    throw new StockError(`Rupture de stock : ${pName} pointure ${data.selectedSize} est épuisée.`);
  }

  if (variants.stock < quantity) {
    throw new StockError(`Stock insuffisant : il reste ${variants.stock} paire(s) de ${pName} ${data.selectedSize}.`);
  }

  const variantId = variants.id;

  // --- ÉTAPE 2 : insertion dans la table orders ---
  const src = data.source || 'web';
  const paymentStatus =
    data.initialPaymentStatus ||
    (src === 'web' || src === 'online' ? 'en_attente_encaissement' : 'non_paye');
  const orderStatus = data.initialOrderStatus?.trim() || 'nouveau';
  const subtotal = data.price * quantity;
  const orderGrandTotal = subtotal + delivery;

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert([
      {
        customer_name: data.fullName,
        phone: data.phone,
        city: data.city,
        subtotal,
        delivery_cost: delivery,
        total: orderGrandTotal,
        status: orderStatus,
        source: src,
        customer_id: data.customerId ?? null,
        payment_status: paymentStatus as PaymentStatus,
      },
    ])
    .select()
    .single();

  if (orderError || !newOrder) {
    throw new Error('Une erreur s\'est produite lors de la sauvegarde de votre commande.');
  }

  const orderId = newOrder.id;

  try {
    // --- ÉTAPE 3 : insertion dans la table order_items ---
    const { error: itemsError } = await supabase.from('order_items').insert([
      {
        order_id: orderId,
        variant_id: variantId,
        quantity: quantity,
        price: data.price,
      },
    ]);

    if (itemsError) throw itemsError;

    // --- ÉTAPE 4 : UPDATE VARIANTS (Décrémentation) ---
    const { error: updateError } = await supabase
      .from('variants')
      .update({ stock: variants.stock - quantity })
      .eq('id', variantId);

    if (updateError) throw updateError;

    // --- ÉTAPE 4.5 : INSERT STOCK_MOVEMENTS ---
    const { error: stockMovementError } = await supabase
      .from('stock_movements')
      .insert([
        {
          variant_id: variantId,
          type: 'sortie',
          quantity: quantity,
          reason: 'Commande client',
          order_id: orderId
        }
      ]);
      
    if (stockMovementError) throw stockMovementError;

    if (data.customerId) {
      const { error: acctUpsertErr } = await supabase
        .from('customer_accounts')
        .upsert({ customer_id: data.customerId }, { onConflict: 'customer_id' });
      if (acctUpsertErr) throw acctUpsertErr;
      const { data: acct } = await supabase
        .from('customer_accounts')
        .select('total_du, solde')
        .eq('customer_id', data.customerId)
        .maybeSingle();
      const { error: acctUpdErr } = await supabase
        .from('customer_accounts')
        .update({
          total_du: Number(acct?.total_du || 0) + orderGrandTotal,
          solde: Number(acct?.solde || 0) + orderGrandTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', data.customerId);
      if (acctUpdErr) throw acctUpdErr;
    }

    // --- ÉTAPE 5 : SUCCÈS ! ---
    return orderId;
  } catch (error: any) {
    // --- GESTION DU ROLLBACK (Transaction Pseudo-Atomique) ---
    // Si la création des lignes de commande ou la décrémentation a échoué,
    // on annule la création de l'ordre global précédent pour éviter les commandes fantômes.
    console.error('Erreur critique pendant la transaction. Rollback en cours.', error);
    await supabase.from('orders').delete().eq('id', orderId);
    throw new Error("Erreur système. Nous n'avons pas pu valider votre commande.");
  }
}

/** Vente magasin : commande livrée, à encaisser, liée au client CRM. */
export async function createDirectSale(data: OrderData): Promise<string> {
  return createOrder({
    ...data,
    source: 'direct',
    quantity: data.quantity || 1,
    deliveryCost: data.deliveryCost ?? 0,
    initialOrderStatus: data.initialOrderStatus ?? 'livré',
    initialPaymentStatus: data.initialPaymentStatus ?? 'en_attente_encaissement',
  });
}

function mapChirazUpdateOrderStatusRpcError(raw: string | undefined, code?: string): string {
  if (code === 'PGRST202' || (raw || '').includes('schema cache')) {
    return (
      'L’API ne voit pas la fonction chiraz_update_order_status (cache PostgREST ou ancienne version en base). ' +
      '1) Dans l’éditeur SQL du même projet que VITE_SUPABASE_URL, exécutez tout le fichier ' +
      'supabase/migrations/20260430180000_chiraz_update_order_status_rpc.sql (il commence par DROP FUNCTION… et RETURNS json). ' +
      '2) Puis : NOTIFY pgrst, \'reload schema\'; attendez ~30 s. ' +
      '3) Si ça persiste : Project Settings → General → Pause project puis Resume, ou la doc Supabase « refresh PostgREST schema ».'
    );
  }
  const m = (raw || '').toUpperCase();
  if (m.includes('ORDER_NOT_FOUND')) {
    return 'Impossible de trouver la commande (introuvable ou accès refusé).';
  }
  if (m.includes('ORDER_UPDATE_FAILED')) {
    return 'La mise à jour du statut a échoué côté serveur.';
  }
  if (m.includes('INVALID_ARGS')) {
    return 'Paramètres de mise à jour invalides.';
  }
  if ((raw || '').includes('JWT') || m.includes('UNAUTHORIZED')) {
    return "Session expirée ou accès refusé. Reconnectez-vous à l'admin.";
  }
  return (
    raw ||
    "Erreur lors de la mise à jour du statut. Vérifiez que la migration Supabase « chiraz_update_order_status » est appliquée."
  );
}

/**
 * Met à jour le statut d'une commande et gère l'historique et le stock.
 * Utilise la RPC SECURITY DEFINER pour contourner le cas où RLS « anon » bloque UPDATE sur orders.
 */
export async function updateOrderStatus(orderId: string, newStatus: string, reason?: string): Promise<{ success: boolean; order: Order }> {
  const { error: rpcError } = await supabase.rpc('chiraz_update_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_reason: reason ?? null,
  });

  if (rpcError) {
    throw new Error(mapChirazUpdateOrderStatusRpcError(rpcError.message, (rpcError as { code?: string }).code));
  }

  // Étape stock : annulé / refusé / retourné (inchangé ; RPC a déjà mis à jour orders + historique)
  if (['annulé', 'refusé', 'retourné'].includes(newStatus)) {
    const movementType = newStatus === 'retourné' ? 'retour' : 'annulation';
    
    // SELECT order_items WHERE order_id = orderId
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('variant_id, quantity')
      .eq('order_id', orderId);

    if (!itemsError && items) {
      for (const item of items) {
        // Obtenir le stock actuel de la variante
        const { data: variant } = await supabase
          .from('variants')
          .select('stock')
          .eq('id', item.variant_id)
          .maybeSingle();
          
        if (variant) {
          // UPDATE variants SET stock = stock + quantity
          await supabase
            .from('variants')
            .update({ stock: variant.stock + item.quantity })
            .eq('id', item.variant_id);

          // INSERT stock_movements
          await supabase
            .from('stock_movements')
            .insert([
              {
                variant_id: item.variant_id,
                type: movementType,
                quantity: item.quantity,
                reason: reason || `Statut passé à ${newStatus}`,
                order_id: orderId
              }
            ]);
        }
      }
    }
  }

  const { data: fullOrder, error: readError } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();

  if (readError || !fullOrder) {
    throw new Error("Impossible de relire la commande après mise à jour du statut.");
  }

  return { success: true, order: fullOrder as Order };
}
