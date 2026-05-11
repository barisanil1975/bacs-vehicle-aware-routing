/**
 * BACS Labs · Vehicle-Aware Routing Engine
 * KGM tarife verisi — 2026 resmi tarifeleri.
 *
 * İçerik:
 * - HGS_DATA: araç → KGM sınıfı + fallback ₺/km
 * - OFFICIAL_KGM_CORRIDORS: 11 resmi koridor (Anadolu/Avrupa/Çukurova/Aydın/Menemen)
 * - OTOYOL_RATIO: toplam km içinde tipik otoyol km payı (heuristik fallback)
 *
 * Kaynak: KGM 2026 PDF tarifeleri (kgm.gov.tr).
 */

import type {
  HgsProfile,
  KgmClass,
  KgmCorridor,
  VehicleId,
} from './types';

/* ────────────────────────────────────────────────────────────
   1) HGS verisi — araç → KGM sınıfı, fallback ₺/km
   ──────────────────────────────────────────────────────────── */

export const HGS_DATA: Record<VehicleId, HgsProfile> = {
  Minivan: { sinif: 1, label: '1. Sınıf', perKm: 0.9 },
  'Panelvan 3,5-5t': { sinif: 2, label: '2. Sınıf', perKm: 1.05 },
  'Panelvan 5-7,5t': { sinif: 2, label: '2. Sınıf', perKm: 1.05 },
  'Panelvan 5-7,5t Kamyon': { sinif: 3, label: '3. Sınıf', perKm: 1.35 },
  'Kamyon 7,5-12t': { sinif: 3, label: '3. Sınıf', perKm: 1.35 },
  'Onteker 10-15t': { sinif: 3, label: '3. Sınıf', perKm: 1.35 },
  'Kırkayak 15-20t': { sinif: 4, label: '4. Sınıf', perKm: 1.75 },
  'TIR 22-26t': { sinif: 5, label: '5. Sınıf', perKm: 2.15 },
};

/**
 * Toplam km'nin otoyol km'sine oranlanması için heuristik.
 * Tipik Türkiye uzun mesafe rotalarında %65 otoyol, %35 devlet yolu.
 * Resmi koridor tespit edilemediğinde kullanılır.
 */
export const OTOYOL_RATIO = 0.65;

/* ────────────────────────────────────────────────────────────
   2) KGM 2026 koridor tabloları
   Tam hat ücretleri PDF'ten; km bazlı ücret tespit edilen
   otoyol km'sine prorate edilir.
   ──────────────────────────────────────────────────────────── */

export const OFFICIAL_KGM_CORRIDORS: KgmCorridor[] = [
  {
    id: 'anadolu',
    name: 'KGM Anadolu Otoyolu (Çamlıca-Akıncı)',
    fullKm: 380.68,
    rates: { 1: 338, 2: 390, 3: 522, 4: 675, 5: 811 },
    sideA: [
      'istanbul', 'umraniye', 'atasehir', 'uskudar', 'kadikoy', 'kartal',
      'pendik', 'tuzla', 'samandira', 'sultanbeyli', 'kurtkoy', 'orhanli',
      'gebze', 'dilovasi', 'izmit', 'kocaeli', 'sakarya', 'adapazari',
      'duzce', 'bolu',
    ],
    sideB: ['ankara', 'kizilcahamam', 'camlidere', 'celtikci', 'gerede', 'akinci'],
  },
  {
    id: 'avrupa',
    name: 'KGM Avrupa Otoyolu (Mahmutbey-Edirne)',
    fullKm: 211.9,
    rates: { 1: 168, 2: 193, 3: 256, 4: 338, 5: 378 },
    sideA: [
      'istanbul', 'mahmutbey', 'basaksehir', 'avcilar', 'esenyurt', 'hadimkoy',
      'kinali', 'arnavutkoy', 'buyukcekmece', 'silivri',
    ],
    sideB: [
      'edirne', 'havsa', 'babaeski', 'luleburgaz', 'corlu', 'cerkezkoy',
      'tekirdag', 'saray', 'kirklareli',
    ],
  },
  {
    id: 'izmir_cesme',
    name: 'KGM İzmir-Çeşme Otoyolu',
    fullKm: 56.3,
    rates: { 1: 53, 2: 56, 3: 102, 4: 115, 5: 148 },
    sideA: ['izmir', 'guzelbahce', 'seferihisar'],
    sideB: ['urla', 'karaburun', 'alacati', 'cesme'],
  },
  {
    id: 'izmir_aydin',
    name: 'KGM İzmir-Aydın Otoyolu',
    fullKm: 99.6,
    rates: { 1: 73, 2: 82, 3: 115, 4: 148, 5: 168 },
    sideA: [
      'izmir', 'gaziemir', 'menderes', 'isikent', 'havalimani', 'torbali',
      'belevi', 'selcuk',
    ],
    sideB: ['aydin', 'germencik', 'incirliova', 'aydin bati'],
  },
  {
    id: 'adana_gaziantep',
    name: 'KGM Çukurova Otoyolu (Adana Doğu-Gaziantep Batı)',
    fullKm: 157,
    rates: { 1: 102, 2: 120, 3: 156, 4: 205, 5: 256 },
    sideA: [
      'adana', 'ceyhan', 'toprakkale', 'osmaniye', 'erzın', 'erzin',
      'payas', 'iskenderun', 'duzici', 'bahce', 'nurdagi',
    ],
    sideB: ['gaziantep'],
  },
  {
    id: 'gaziantep_sanliurfa',
    name: 'KGM Çukurova Otoyolu (Gaziantep Doğu-Şanlıurfa)',
    fullKm: 120,
    rates: { 1: 102, 2: 120, 3: 156, 4: 177, 5: 237 },
    sideA: ['gaziantep', 'nizip'],
    sideB: ['birecik', 'suruc', 'sanliurfa', 'şanliurfa'],
  },
  {
    id: 'nigde_adana',
    name: 'KGM Çukurova Otoyolu (Niğde-Adana Batı)',
    fullKm: 187.17,
    rates: { 1: 193, 2: 237, 3: 289, 4: 370, 5: 452 },
    sideA: ['nigde', 'nigde guney', 'nigde kuzey', 'ulukisla', 'pozanti'],
    sideB: ['adana', 'adana bati', 'yenice'],
  },
  {
    id: 'nigde_mersin',
    name: 'KGM Çukurova Otoyolu (Niğde-Mersin)',
    fullKm: 201.17,
    rates: { 1: 197, 2: 237, 3: 305, 4: 370, 5: 459 },
    sideA: ['nigde', 'nigde guney', 'nigde kuzey', 'ulukisla', 'pozanti'],
    sideB: ['mersin', 'tarsus', 'tarsus osb'],
  },
  {
    id: 'ankara_nigde',
    name: 'Ankara-Niğde Otoyolu',
    fullKm: 330,
    rates: { 1: 740, 2: 840, 3: 1010, 4: 1300, 5: 1560 },
    sideA: ['ankara', 'karagedik', 'ahiboz', 'emirler'],
    sideB: ['nigde', 'alayhan', 'derinkuyu', 'ciftlik'],
  },
  {
    id: 'aydin_denizli',
    name: 'Aydın-Denizli Otoyolu',
    fullKm: 163,
    rates: { 1: 500, 2: 635, 3: 760, 4: 910, 5: 1010 },
    sideA: ['aydin', 'kosk', 'yenipazar', 'nazilli', 'kuyucak', 'buharkent'],
    sideB: ['denizli', 'saraykoy', 'kumkisik', 'pamukkale', 'kocabas'],
  },
  {
    id: 'menemen_candarli',
    name: 'Menemen-Aliağa-Çandarlı Otoyolu',
    fullKm: 80,
    rates: { 1: 205, 2: 340, 3: 400, 4: 525, 5: 525 },
    sideA: ['menemen'],
    sideB: [
      'eskifoca', 'yenifoca', 'aliaga', 'petkim', 'yenişakran', 'yenisakran',
      'candarli',
    ],
  },
];

/* ────────────────────────────────────────────────────────────
   3) Türkçe karakter normalizasyonu
   substring match için locale-aware lowercasing.
   ──────────────────────────────────────────────────────────── */

/**
 * KGM koridor tespiti için text normalization.
 *
 * KRİTİK: JS default toLowerCase('İ') = 'i' + U+0307 (combining dot)
 * → substring match çuvallar. Türkçe locale doğru davranır.
 * Combining mark stripper güvenlik ağı olarak kalır.
 */
export function kgmNormalize(s: string | null | undefined): string {
  let str = (s ?? '').toString();

  try {
    str = str.toLocaleLowerCase('tr-TR');
  } catch {
    str = str.replace(/İ/g, 'i').toLowerCase();
  }

  return str
    .replace(/[\u0300-\u036f]/g, '') // combining marks (özellikle U+0307)
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

/**
 * Resmi KGM koridoru tespit eder.
 * fromText ve toText farklı koridor uçlarında ise eşleşme döner.
 */
export function detectOfficialKgmCorridor(
  fromText: string,
  toText: string
): KgmCorridor | null {
  const from = kgmNormalize(fromText);
  const to = kgmNormalize(toText);

  for (const corridor of OFFICIAL_KGM_CORRIDORS) {
    const hasAny = (txt: string, arr: string[]) =>
      arr.some((k) => txt.includes(kgmNormalize(k)));

    const fromInA = hasAny(from, corridor.sideA);
    const fromInB = hasAny(from, corridor.sideB);
    const toInA = hasAny(to, corridor.sideA);
    const toInB = hasAny(to, corridor.sideB);

    if ((fromInA && toInB) || (fromInB && toInA)) {
      return corridor;
    }
  }
  return null;
}

/**
 * Koridor için sınıf bazlı tam-hat ücretini, tespit edilen otoyol km'sine prorate eder.
 *
 * Eğer otoyol km, koridor tam-hat km'sinden büyükse (multi-corridor durumu),
 * tam-hat ücretinin tamamını uygula; ardından kalan km için fallback ₺/km.
 *
 * @param corridor — tespit edilen koridor (null ise 0 döner)
 * @param kgmClass — KGM araç sınıfı
 * @param tollKm — rotada hesaplanan toplam otoyol km'si
 */
export function getOfficialCorridorCost(
  corridor: KgmCorridor | null,
  kgmClass: KgmClass,
  tollKm: number
): number {
  if (!corridor || tollKm <= 0) return 0;
  const fullRate = corridor.rates[kgmClass] ?? 0;
  if (fullRate <= 0) return 0;

  if (tollKm >= corridor.fullKm) {
    return fullRate;
  }
  // Prorate
  return (tollKm / corridor.fullKm) * fullRate;
}
