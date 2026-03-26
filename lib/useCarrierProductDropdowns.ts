"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CarrierProductRow = { id: number; name: string };

export type CarrierProductDropdownsOptions = {
  /** When false, product list is cleared and loading stops. */
  open: boolean;
  carrierName: string;
  /** After products load for a carrier, clear invalid product selection (optional). */
  onInvalidateProduct?: (list: CarrierProductRow[], carrierNameSnapshot: string) => void;
};

/**
 * Carriers from `carriers`; products for the selected carrier from `carrier_products` + `products`.
 */
export function useCarrierProductDropdowns(
  supabase: SupabaseClient,
  options: CarrierProductDropdownsOptions,
) {
  const [carriers, setCarriers] = useState<CarrierProductRow[]>([]);
  const [productsForCarrier, setProductsForCarrier] = useState<CarrierProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const onInvalidateRef = useRef(options.onInvalidateProduct);
  onInvalidateRef.current = options.onInvalidateProduct;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("carriers").select("id, name").order("name");
      if (!cancelled && !error && data) setCarriers(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!options.open) {
      setProductsForCarrier([]);
      setLoadingProducts(false);
      return;
    }
    const carrierName = options.carrierName.trim();
    if (!carrierName) {
      setProductsForCarrier([]);
      setLoadingProducts(false);
      return;
    }
    const carrierRow = carriers.find((c) => c.name === carrierName);
    if (!carrierRow) {
      setProductsForCarrier([]);
      setLoadingProducts(false);
      return;
    }

    let cancelled = false;
    setLoadingProducts(true);
    void (async () => {
      const { data, error } = await supabase
        .from("carrier_products")
        .select("products(id, name)")
        .eq("carrier_id", carrierRow.id);
      if (cancelled) return;
      if (error) {
        setProductsForCarrier([]);
        setLoadingProducts(false);
        return;
      }
      const list: CarrierProductRow[] = [];
      const seen = new Set<string>();
      for (const row of data ?? []) {
        const p = (row as { products?: { id?: number; name?: string } | null }).products;
        if (!p || p.name == null) continue;
        const nm = String(p.name);
        if (seen.has(nm)) continue;
        seen.add(nm);
        list.push({ id: Number(p.id), name: nm });
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      if (cancelled) return;
      setProductsForCarrier(list);
      setLoadingProducts(false);
      onInvalidateRef.current?.(list, carrierName);
    })();

    return () => {
      cancelled = true;
    };
  }, [options.open, options.carrierName, carriers, supabase]);

  return { carriers, productsForCarrier, loadingProducts };
}
