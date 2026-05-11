/**
 * BACS Labs · Vehicle-Aware Routing Engine
 * Price engine — akaryakıt tüketimi, KGM/köprü ücreti, fiyat aralığı önerisi.
 *
 * Üç katmanlı hesap:
 * 1. Akaryakıt: araç tüketim profili × km × yakıt fiyatı
 * 2. KGM/köprü: tespit edilen koridor + köprü ücretleri (sınıf bazlı)
 * 3. Fiyat önerisi: akaryakıt-bazlı ve escalation-bazlı iki ipucunun karışımı
 */

import {
  BRIDGE_DEFS,
  getBosphorusBridgeForKgmClass,
  VEHICLE_BRIDGE_CLASS,
} from './bridge-data';
import type {
  BridgeId,
  FuelProfile,
  KgmClass,
  PriceSuggestion,
  PriceSuggestionModel,
  QuoteRequest,
  QuoteResponse,
  VehicleId,
} from './types';
import {
  detectOfficialKgmCorridor,
  getOfficialCorridorCost,
  HGS_DATA,
  OTOYOL_RATIO,
} from './kgm-tariff';
import { analyzeRoute, detectBridges } from './routing-engine';

/* ────────────────────────────────────────────────────────────
   1) Yakıt tüketim profilleri
   bosMin = boş gidişte L/100km
   yukluMax = yüklü dönüşte L/100km
   Ortalaması (bosMin + yukluMax) / 2 → tipik FTL tek-yön tüketimi
   ──────────────────────────────────────────────────────────── */

export const FUEL_DATA: Record<VehicleId, FuelProfile> = {
  Minivan: { bosMin: 5, yukluMax: 8 },
  'Panelvan 3,5-5t': { bosMin: 8, yukluMax: 13 },
  'Panelvan 5-7,5t': { bosMin: 10, yukluMax: 16 },
  'Panelvan 5-7,5t Kamyon': { bosMin: 12, yukluMax: 19 },
  'Kamyon 7,5-12t': { bosMin: 16, yukluMax: 26 },
  'Onteker 10-15t': { bosMin: 20, yukluMax: 32 },
  'Kırkayak 15-20t': { bosMin: 26, yukluMax: 40 },
  'TIR 22-26t': { bosMin: 28, yukluMax: 42 },
};

/* ────────────────────────────────────────────────────────────
   2) Fiyat öneri modeli
   fuelShare: akaryakıt maliyetinin toplam fiyat içindeki tarihsel payı
   escalationPerKm: km bazında eskalasyon ücreti (₺/km)
   minFloor: minimum taban (kısa mesafeler için)
   ──────────────────────────────────────────────────────────── */

export const PRICE_SUGGESTION_DATA: Record<VehicleId, PriceSuggestionModel> = {
  Minivan: { fuelShare: 0.44, escalationPerKm: 11.5, minFloor: 1500 },
  'Panelvan 3,5-5t': { fuelShare: 0.43, escalationPerKm: 16.0, minFloor: 2500 },
  'Panelvan 5-7,5t': { fuelShare: 0.42, escalationPerKm: 19.0, minFloor: 3500 },
  'Panelvan 5-7,5t Kamyon': {
    fuelShare: 0.41, escalationPerKm: 21.5, minFloor: 4200,
  },
  'Kamyon 7,5-12t': { fuelShare: 0.41, escalationPerKm: 24.0, minFloor: 5000 },
  'Onteker 10-15t': { fuelShare: 0.4, escalationPerKm: 29.0, minFloor: 6500 },
  'Kırkayak 15-20t': { fuelShare: 0.39, escalationPerKm: 37.0, minFloor: 8500 },
  'TIR 22-26t': { fuelShare: 0.38, escalationPerKm: 47.0, minFloor: 10500 },
};

/** Default yakıt fiyatı — fuel API yanıt vermezse fallback */
export const DEFAULT_FUEL_PRICE_TL_PER_LITER = 78.6;

/* ────────────────────────────────────────────────────────────
   3) Yuvarlama yardımcıları
   500'ün altında alt, 500'ün üstünde üst — pazara konulan açık fiyat
   ──────────────────────────────────────────────────────────── */

export function roundDown500(n: number): number {
  return Math.floor(Math.max(0, Number(n) || 0) / 500) * 500;
}

export function roundUp500(n: number): number {
  return Math.ceil(Math.max(0, Number(n) || 0) / 500) * 500;
}

export function formatTL(n: number): string {
  return (
    '₺' +
    new Intl.NumberFormat('tr-TR').format(Math.round(n))
  );
}

/* ────────────────────────────────────────────────────────────
   4) Akaryakıt hesabı
   ──────────────────────────────────────────────────────────── */

/**
 * Araç ve km verilen yakıt fiyatı için tahmini akaryakıt maliyeti.
 *
 * Formül: ortalama tüketim × km / 100 × fiyat
 */
export function getFuelEstimateForVehicle(
  vehicle: VehicleId,
  km: number,
  fuelPriceTLperL: number
): number {
  const d = FUEL_DATA[vehicle];
  if (!d || km <= 0 || !fuelPriceTLperL) return 0;
  const avgConsumption = (d.bosMin + d.yukluMax) / 2;
  const liters = (km * avgConsumption) / 100;
  return liters * fuelPriceTLperL;
}

/* ────────────────────────────────────────────────────────────
   5) KGM + köprü ücreti hesabı
   ──────────────────────────────────────────────────────────── */

/**
 * Verilen rota için HGS toplamı (otoyol + köprü) tahmini.
 *
 * @param vehicle — araç tipi
 * @param totalKm — toplam mesafe (km)
 * @param fromText — kalkış metni
 * @param toText — varış metni
 * @param tollKmHint — varsa kullanıcının verdiği "ücretli km" — yoksa toplamın %65'i
 */
export function getHgsEstimateForVehicle(
  vehicle: VehicleId,
  totalKm: number,
  fromText: string,
  toText: string,
  tollKmHint?: number
): number {
  const h = HGS_DATA[vehicle];
  if (!h || totalKm <= 0) return 0;

  const tollKm = tollKmHint ?? totalKm * OTOYOL_RATIO;

  // 1) Otoyol — resmi koridor tespiti
  const corridor = detectOfficialKgmCorridor(fromText, toText);
  const officialCost = getOfficialCorridorCost(corridor, h.sinif, tollKm);
  const fallbackCost = tollKm * h.perKm;
  const otoyolCost = officialCost > 0 ? officialCost : fallbackCost;

  // 2) Köprü — tespit edilen köprüler için sınıf bazlı ücret
  const bridges = detectBridges(fromText, toText);
  let bridgeCost = 0;

  for (const bridgeId of bridges) {
    // Boğaz köprüsü — araç sınıfına göre seç
    let actualBridge: BridgeId = bridgeId;
    if (bridgeId === 'yss' || bridgeId === 'fsm') {
      // Araç sınıfı 1.-2. ise FSM tercih (yss zorunlu değilse)
      const cls = VEHICLE_BRIDGE_CLASS[vehicle];
      actualBridge =
        cls === 'fsm' ? getBosphorusBridgeForKgmClass(h.sinif) : 'yss';
    }
    const def = BRIDGE_DEFS[actualBridge];
    const rate = def?.rates[h.sinif] ?? 0;
    bridgeCost += rate;
  }

  return otoyolCost + bridgeCost;
}

/* ────────────────────────────────────────────────────────────
   6) Fiyat önerisi
   Akaryakıt-bazlı ve escalation-bazlı iki ipucundan band üretir.
   ──────────────────────────────────────────────────────────── */

/**
 * Tek araç için fiyat önerisi.
 *
 * İki ipucu üretilir:
 *  - Akaryakıt-bazlı: yakıt maliyeti / fuelShare → toplam fiyat tahmini
 *  - Escalation-bazlı: km × escalationPerKm, minFloor altına düşmeyecek
 *
 * Aralık:
 *  - Alt band: (akaryakıt × 0.40) + (escalation × 0.60), aşağı yuvarla
 *  - Üst band: (akaryakıt × 0.45) + (escalation × 0.55), yukarı yuvarla
 */
export function getPriceSuggestionForVehicle(
  vehicle: VehicleId,
  km: number,
  fuelPriceTLperL: number,
  fromText: string,
  toText: string
): PriceSuggestion | null {
  const model = PRICE_SUGGESTION_DATA[vehicle];
  if (!model || km <= 0 || !fuelPriceTLperL) return null;

  const fuelCost = getFuelEstimateForVehicle(vehicle, km, fuelPriceTLperL);
  const hgsCost = getHgsEstimateForVehicle(vehicle, km, fromText, toText);

  const akaryakitQuote = fuelCost / model.fuelShare;
  const escalasyonQuote = Math.max(km * model.escalationPerKm, model.minFloor);

  const lower = roundDown500(
    akaryakitQuote * 0.4 + escalasyonQuote * 0.6
  );
  const upper = roundUp500(
    akaryakitQuote * 0.45 + escalasyonQuote * 0.55
  );

  return {
    vehicle,
    fuelCost,
    hgsCost,
    akaryakitQuote,
    escalasyonQuote,
    lower: Math.min(lower, upper),
    upper: Math.max(lower, upper),
  };
}

/* ────────────────────────────────────────────────────────────
   7) End-to-end quote
   ──────────────────────────────────────────────────────────── */

/**
 * Tek-çağrı: kalkış + varış + araç + km → tam analiz + fiyat.
 *
 * @example
 * const quote = computeQuote({
 *   fromText: 'Mahmutbey, İstanbul',
 *   toText: 'Bursa',
 *   km: 240,
 *   vehicle: 'TIR 22-26t',
 *   fuelPrice: 78.60
 * });
 */
export function computeQuote(req: QuoteRequest): QuoteResponse {
  const fuelPrice = req.fuelPrice ?? DEFAULT_FUEL_PRICE_TL_PER_LITER;

  const analysis = analyzeRoute(req.fromText, req.toText, req.vehicle);
  const price = getPriceSuggestionForVehicle(
    req.vehicle,
    req.km,
    fuelPrice,
    req.fromText,
    req.toText
  );

  return {
    request: req,
    analysis: {
      bridges: analysis.bridges,
      corridor: analysis.corridor as any,
      profile: analysis.profile,
      waypoints: analysis.waypoints,
    },
    price: price ?? {
      vehicle: req.vehicle,
      fuelCost: 0,
      hgsCost: 0,
      akaryakitQuote: 0,
      escalasyonQuote: 0,
      lower: 0,
      upper: 0,
    },
  };
}
