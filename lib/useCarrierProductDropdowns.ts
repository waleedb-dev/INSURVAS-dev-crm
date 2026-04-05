"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CarrierProductRow = { id: number; name: string };

export type CarrierProductDropdownsOptions = {
  carrierName: string;
  onInvalidateProduct?: (list: CarrierProductRow[], carrierNameSnapshot: string) => void;
};

const PRODUCT_ORDER: Record<string, string[]> = {
  "Aetna": ["Preferred", "Standard", "Modified"],
  "Mutual of Omaha": ["Level", "Graded"],
  "AMAM": ["Immediate", "Graded", "ROP"],
  "Pioneer": ["Immediate", "Graded", "ROP"],
  "Occidental": ["Immediate", "Graded", "ROP"],
  "Aflac": ["Preferred", "Standard", "Modified"],
  "American Home Life": ["Preferred", "Standard", "Modified"],
  "Transamerica": ["Preferred", "Standard", "Graded"],
  "SSL": ["New Vantage I", "New Vantage II", "New Vantage III"],
};

function sortProductsByCarrierOrder(products: CarrierProductRow[], carrierName: string): CarrierProductRow[] {
  const order = PRODUCT_ORDER[carrierName];
  if (!order) {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }
  
  const orderMap = new Map(order.map((name, idx) => [name, idx]));
  return [...products].sort((a, b) => {
    const aIdx = orderMap.get(a.name) ?? Infinity;
    const bIdx = orderMap.get(b.name) ?? Infinity;
    if (aIdx === Infinity && bIdx === Infinity) {
      return a.name.localeCompare(b.name);
    }
    return aIdx - bIdx;
  });
}

type CarrierProductQueryRow = {
  carrier_id: number;
  products: { id: number; name: string } | null;
};

export function useCarrierProductDropdowns(
  supabase: SupabaseClient,
  options: CarrierProductDropdownsOptions,
) {
  const [carriers, setCarriers] = useState<CarrierProductRow[]>([]);
  const [productsByCarrier, setProductsByCarrier] = useState<Map<number, CarrierProductRow[]>>(new Map());
  const [loadingAll, setLoadingAll] = useState(true);

  const onInvalidateRef = useRef(options.onInvalidateProduct);
  useEffect(() => {
    onInvalidateRef.current = options.onInvalidateProduct;
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingAll(true);
      const { data: carrierData, error: carrierError } = await supabase
        .from("carriers")
        .select("id, name")
        .order("name");
      
      if (cancelled) return;
      if (carrierError || !carrierData) {
        setLoadingAll(false);
        return;
      }

      setCarriers(carrierData);

      const { data: cpData, error: cpError } = await supabase
        .from("carrier_products")
        .select("carrier_id, products(id, name)");

      if (cancelled) return;
      if (cpError || !cpData) {
        setLoadingAll(false);
        return;
      }

      const productsMap = new Map<number, CarrierProductRow[]>();
      for (const carrier of carrierData) {
        const productsForThisCarrier: CarrierProductRow[] = [];
        const seen = new Set<string>();
        
        for (const row of (cpData as unknown as CarrierProductQueryRow[])) {
          if (row.carrier_id !== carrier.id) continue;
          const p = row.products;
          if (!p || p.name == null) continue;
          const nm = String(p.name);
          if (seen.has(nm)) continue;
          seen.add(nm);
          productsForThisCarrier.push({ id: Number(p.id), name: nm });
        }
        
        const sorted = sortProductsByCarrierOrder(productsForThisCarrier, carrier.name);
        productsMap.set(carrier.id, sorted);
      }

      if (!cancelled) {
        setProductsByCarrier(productsMap);
        setLoadingAll(false);
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const productsForCarrier = useMemo(() => {
    const carrierName = options.carrierName.trim();
    if (!carrierName) return [];
    const carrierRow = carriers.find((c) => c.name === carrierName);
    if (!carrierRow) return [];
    return productsByCarrier.get(carrierRow.id) ?? [];
  }, [options.carrierName, carriers, productsByCarrier]);

  const prevCarrierNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevCarrierNameRef.current !== options.carrierName && productsForCarrier.length > 0) {
      onInvalidateRef.current?.(productsForCarrier, options.carrierName);
    }
    prevCarrierNameRef.current = options.carrierName;
  }, [options.carrierName, productsForCarrier]);

  return { 
    carriers, 
    productsForCarrier, 
    loadingProducts: loadingAll 
  };
}