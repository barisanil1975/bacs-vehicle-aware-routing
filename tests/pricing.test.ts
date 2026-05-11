/**
 * BACS Labs · Vehicle-Aware Routing Engine
 * Price engine unit tests
 *
 * Test edilen yapılar:
 * - getFuelEstimateForVehicle (akaryakıt hesabı)
 * - getHgsEstimateForVehicle (KGM + köprü ücreti)
 * - getPriceSuggestionForVehicle (fiyat aralığı bandı)
 * - computeQuote (end-to-end)
 * - roundDown500 / roundUp500 (yuvarlama)
 */

import { describe, it, expect } from 'vitest';
import {
  computeQuote,
  DEFAULT_FUEL_PRICE_TL_PER_LITER,
  FUEL_DATA,
  getFuelEstimateForVehicle,
  getHgsEstimateForVehicle,
  getPriceSuggestionForVehicle,
  PRICE_SUGGESTION_DATA,
  roundDown500,
  roundUp500,
} from '../src/lib/price-engine';

describe('roundDown500 / roundUp500', () => {
  it('roundDown500: aşağı 500 yuvarlama', () => {
    expect(roundDown500(0)).toBe(0);
    expect(roundDown500(499)).toBe(0);
    expect(roundDown500(500)).toBe(500);
    expect(roundDown500(749)).toBe(500);
    expect(roundDown500(1000)).toBe(1000);
    expect(roundDown500(1234)).toBe(1000);
  });

  it('roundUp500: yukarı 500 yuvarlama', () => {
    expect(roundUp500(0)).toBe(0);
    expect(roundUp500(1)).toBe(500);
    expect(roundUp500(500)).toBe(500);
    expect(roundUp500(501)).toBe(1000);
    expect(roundUp500(1234)).toBe(1500);
  });

  it('Negatif/null: 0 döner', () => {
    expect(roundDown500(-100)).toBe(0);
    expect(roundUp500(NaN)).toBe(0);
  });
});

describe('getFuelEstimateForVehicle', () => {
  it('TIR 22-26t, 240 km, 78.60 TL/L', () => {
    // Tüketim ortalaması: (28+42)/2 = 35 L/100km
    // 240 km × 35 / 100 = 84 L
    // 84 × 78.60 = 6602.40 TL
    const cost = getFuelEstimateForVehicle('TIR 22-26t', 240, 78.6);
    expect(cost).toBeCloseTo(6602.4, 1);
  });

  it('Minivan, 100 km, 78.60 TL/L', () => {
    // Tüketim ort: (5+8)/2 = 6.5 L/100km
    // 100 × 6.5 / 100 = 6.5 L × 78.60 = 510.90 TL
    const cost = getFuelEstimateForVehicle('Minivan', 100, 78.6);
    expect(cost).toBeCloseTo(510.9, 1);
  });

  it('0 km veya geçersiz fiyat → 0', () => {
    expect(getFuelEstimateForVehicle('TIR 22-26t', 0, 78.6)).toBe(0);
    expect(getFuelEstimateForVehicle('TIR 22-26t', 100, 0)).toBe(0);
  });

  it('Tüm 8 araç sınıfı için pozitif sonuç', () => {
    const vehicles = Object.keys(FUEL_DATA) as Array<keyof typeof FUEL_DATA>;
    for (const v of vehicles) {
      expect(getFuelEstimateForVehicle(v, 100, 78.6)).toBeGreaterThan(0);
    }
  });
});

describe('getHgsEstimateForVehicle', () => {
  it('TIR Mahmutbey → Edirne: Avrupa koridoru yakın tam-hat ücreti', () => {
    // Mahmutbey-Edirne = 211.9 km full corridor, TIR (5. sınıf) = 378 TL
    const cost = getHgsEstimateForVehicle(
      'TIR 22-26t',
      215,
      'Mahmutbey, İstanbul',
      'Edirne'
    );
    expect(cost).toBeGreaterThan(0);
    // Tam-hat 378, biraz altında olabilir (corridor tespitine göre)
    expect(cost).toBeLessThanOrEqual(500);
  });

  it('Bakırköy → Kadıköy Minivan: sadece köprü ücreti (15 Temmuz beklentisi)', () => {
    const cost = getHgsEstimateForVehicle(
      'Minivan',
      35,
      'Bakırköy',
      'Kadıköy'
    );
    // Köprü 59 TL + otoyol fallback (35 × 0.65 × 0.90 ≈ 20.5)
    expect(cost).toBeGreaterThan(50);
    expect(cost).toBeLessThan(150);
  });

  it('Ankara → Konya: koridor yok, sadece fallback', () => {
    const cost = getHgsEstimateForVehicle(
      'TIR 22-26t',
      260,
      'Ankara',
      'Konya'
    );
    // Toll km ≈ 260 × 0.65 = 169, × 2.15 ≈ 363
    expect(cost).toBeGreaterThan(200);
    expect(cost).toBeLessThan(500);
  });
});

describe('getPriceSuggestionForVehicle', () => {
  it('TIR 22-26t, Bursa → Edirne (~400 km): geniş bant', () => {
    const sug = getPriceSuggestionForVehicle(
      'TIR 22-26t',
      400,
      78.6,
      'Bursa',
      'Edirne'
    );
    expect(sug).not.toBeNull();
    expect(sug!.lower).toBeGreaterThan(10000);
    expect(sug!.upper).toBeGreaterThan(sug!.lower);
    // 500 yuvarlama doğrulanması
    expect(sug!.lower % 500).toBe(0);
    expect(sug!.upper % 500).toBe(0);
  });

  it('Minivan kısa mesafe minFloor uygulanmalı', () => {
    // 5 km × 11.5 = 57.50 — minFloor 1500 devreye girer
    const sug = getPriceSuggestionForVehicle(
      'Minivan',
      5,
      78.6,
      'Kadıköy',
      'Üsküdar'
    );
    expect(sug).not.toBeNull();
    expect(sug!.escalasyonQuote).toBeGreaterThanOrEqual(1500);
  });

  it('Tüm 8 araç sınıfı için 100 km bandı sıralı (Minivan < TIR)', () => {
    const vehicles = Object.keys(PRICE_SUGGESTION_DATA) as Array<
      keyof typeof PRICE_SUGGESTION_DATA
    >;
    let prev = 0;
    for (const v of vehicles) {
      const sug = getPriceSuggestionForVehicle(v, 100, 78.6, 'Bursa', 'Yalova');
      expect(sug).not.toBeNull();
      // En azından minFloor seviyesinde olmalı, ve sınıf büyüdükçe artmalı
      expect(sug!.lower).toBeGreaterThanOrEqual(prev * 0.9); // hafif tolerance
      prev = sug!.lower;
    }
  });

  it('0 km veya geçersiz fiyat → null', () => {
    expect(
      getPriceSuggestionForVehicle('TIR 22-26t', 0, 78.6, 'A', 'B')
    ).toBeNull();
    expect(
      getPriceSuggestionForVehicle('TIR 22-26t', 100, 0, 'A', 'B')
    ).toBeNull();
  });
});

describe('computeQuote end-to-end', () => {
  it('Mahmutbey → Bursa TIR: tam yanıt', () => {
    const quote = computeQuote({
      fromText: 'Mahmutbey, İstanbul',
      toText: 'Bursa',
      km: 240,
      vehicle: 'TIR 22-26t',
      fuelPrice: 78.6,
    });

    // Analiz: Osmangazi köprüsü tespit edilmiş olmalı
    expect(quote.analysis.bridges).toContain('osmangazi');
    expect(quote.analysis.waypoints.length).toBeGreaterThan(0);

    // Fiyat: bant pozitif
    expect(quote.price.lower).toBeGreaterThan(0);
    expect(quote.price.upper).toBeGreaterThan(quote.price.lower);
    expect(quote.price.fuelCost).toBeGreaterThan(0);
  });

  it('Default fuelPrice (78.60) varsayımı', () => {
    const quote = computeQuote({
      fromText: 'Ankara',
      toText: 'Konya',
      km: 260,
      vehicle: 'Kamyon 7,5-12t',
    });
    expect(quote.price.fuelCost).toBeGreaterThan(0);
    expect(DEFAULT_FUEL_PRICE_TL_PER_LITER).toBe(78.6);
  });

  it('Bakırköy → Pendik Minivan: Boğaz tespiti', () => {
    const quote = computeQuote({
      fromText: 'Bakırköy',
      toText: 'Pendik',
      km: 35,
      vehicle: 'Minivan',
    });
    expect(quote.analysis.bridges.length).toBeGreaterThan(0);
    expect(quote.analysis.profile.reason).toBeTruthy();
  });
});
