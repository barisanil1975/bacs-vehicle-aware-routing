/**
 * BACS Labs · Vehicle-Aware Routing Engine
 * Bridge data — köprü waypoint koordinatları, vehicle-bridge sınıf haritası, KGM 2026 köprü ücretleri.
 *
 * Kaynak: Karayolları Genel Müdürlüğü 2026 tarifeleri (KDV dahil).
 * Doğrulama: 2026-04-04 itibarıyla resmi KGM PDF verisi.
 */

import type {
  BridgeId,
  BridgeClass,
  BridgeDefinition,
  BridgeDirectionWaypoints,
  LatLng,
  VehicleId,
} from './types';

/* ────────────────────────────────────────────────────────────
   1) Yön bazlı köprü waypoint koordinatları
   ──────────────────────────────────────────────────────────── */

/**
 * Köprü waypoint'leri — yön ayrımı kritik.
 * Google/Leaflet routing motoru, tek bir köprü için iki şerit arasında
 * yanlış tarafa düşerse routing motoru köprüyü tanımıyor; yönü doğru
 * besleyerek bunu garanti ediyoruz.
 *
 * FSM/YSS: precise koordinatlar (sahada doğrulanmış)
 * Osmangazi: tek koordinat her iki yön için yeterli
 * Çanakkale 1915: midpoint yaklaşık — gerekirse precise yapılabilir
 */
export const BRIDGE_DIRECTION_WAYPOINTS: BridgeDirectionWaypoints = {
  fsm: {
    asianToEuropean: { lat: 41.0914417369385, lng: 29.061872507414485 },
    europeanToAsian: { lat: 41.091237520618265, lng: 29.06170780369692 },
  },
  yss: {
    asianToEuropean: { lat: 41.203022713431494, lng: 29.112346150868667 },
    europeanToAsian: { lat: 41.203452085202926, lng: 29.11062690326965 },
  },
  osmangazi: {
    northToSouth: { lat: 40.75558393868838, lng: 29.515924787141646 },
    southToNorth: { lat: 40.75558393868838, lng: 29.515924787141646 },
  },
  canakkale: {
    eastToWest: { lat: 40.252, lng: 26.621 }, // batıya (Trakya yönü)
    westToEast: { lat: 40.251, lng: 26.622 }, // doğuya (Anadolu yönü)
  },
};

/* ────────────────────────────────────────────────────────────
   2) Coğrafi eşik değerleri
   ──────────────────────────────────────────────────────────── */

/** Boğaz'ı longitude bazında ayıran çizgi. <29.055 = Avrupa, ≥29.055 = Anadolu */
export const BOSPHORUS_LNG = 29.055;

/** Osmangazi enlem eşiği — kuzeyi Kocaeli/İzmit, güneyi Yalova/Bursa */
export const OSMANGAZI_LAT = 40.74;

/** Çanakkale Boğazı boylam eşiği — doğusu Anadolu, batısı Trakya */
export const CANAKKALE_LNG = 26.62;

/** İstanbul ana yerleşim bounding box — Boğaz geçişi heuristiği için */
export const ISTANBUL_BOUNDS = {
  minLat: 40.85,
  maxLat: 41.45,
  minLng: 28.2,
  maxLng: 29.55,
};

/* ────────────────────────────────────────────────────────────
   3) Araç → Köprü sınıfı haritası (UKOME / KGM kuralları)
   1.-2. sınıf hafif vasıtalar FSM kullanır.
   3.-4.-5. sınıf ağır vasıtalar (kamyon/TIR) FSM'den geçemez → YSS zorunlu.
   ──────────────────────────────────────────────────────────── */

export const VEHICLE_BRIDGE_CLASS: Record<VehicleId, BridgeClass> = {
  Minivan: 'fsm',
  'Panelvan 3,5-5t': 'fsm',
  'Panelvan 5-7,5t': 'fsm', // Kamyonet/Panelvan tescili (1.-2. sınıf)
  'Panelvan 5-7,5t Kamyon': 'yss', // Kamyon tescilli (3. sınıf, YSS zorunlu)
  'Kamyon 7,5-12t': 'yss',
  'Onteker 10-15t': 'yss',
  'Kırkayak 15-20t': 'yss',
  'TIR 22-26t': 'yss',
};

/** UI renk kodları — FSM kırmızı (rotaA), YSS yeşil (rotaB) */
export const BRIDGE_ROUTE_COLORS: Record<BridgeClass, string> = {
  fsm: '#dc2626', // kırmızı
  yss: '#16a34a', // yeşil
};

/* ────────────────────────────────────────────────────────────
   4) Köprü tarifeleri (2026 KGM, KDV dahil)
   Kaynak: KGM 2026 resmi PDF tarifeleri
   ──────────────────────────────────────────────────────────── */

export const BRIDGE_DEFS: Record<BridgeId, BridgeDefinition> = {
  '15temmuz': {
    name: '15 Temmuz Şehitler Köprüsü',
    rates: { 1: 59 },
  },
  fsm: {
    name: 'Fatih Sultan Mehmet Köprüsü',
    rates: { 1: 59, 2: 75 },
  },
  yss: {
    name: 'Yavuz Sultan Selim Köprüsü',
    rates: { 1: 95, 2: 125, 3: 235, 4: 595, 5: 740 },
  },
  osmangazi: {
    name: 'Osmangazi Köprüsü',
    rates: { 1: 995, 2: 1590, 3: 1890, 4: 2505, 5: 3165 },
  },
  canakkale: {
    name: '1915 Çanakkale Köprüsü',
    rates: { 1: 995, 2: 1245, 3: 2240, 4: 2490, 5: 3755 },
  },
};

/**
 * Araç KGM sınıfına göre İstanbul Boğazı köprüsü seçimi.
 * 1. sınıf → 15 Temmuz tercih edilir (en ucuz)
 * 2. sınıf → FSM
 * 3-5. sınıf → YSS zorunlu (KGM regülasyonu)
 */
export function getBosphorusBridgeForKgmClass(
  kgmClass: 1 | 2 | 3 | 4 | 5
): BridgeId {
  if (kgmClass === 1) return '15temmuz';
  if (kgmClass === 2) return 'fsm';
  return 'yss';
}

/* ────────────────────────────────────────────────────────────
   5) Yön tespiti — text bazlı keyword sözlükleri
   getDesiredPaidRouteProfile ve detectBridges burada okur.
   ──────────────────────────────────────────────────────────── */

/** İstanbul Anadolu yakası ilçeleri */
export const ANADOLU_IST = [
  'tuzla', 'pendik', 'kartal', 'kadıköy', 'üsküdar', 'ümraniye', 'ataşehir',
  'maltepe', 'sultanbeyli', 'çekmeköy', 'beykoz', 'sancaktepe', 'gebze',
  'darıca', 'çayırova', 'dilovası',
];

/** İstanbul Avrupa yakası ilçeleri */
export const AVRUPA_IST = [
  'beylikdüzü', 'esenyurt', 'büyükçekmece', 'silivri', 'çatalca', 'bakırköy',
  'zeytinburnu', 'fatih', 'bayrampaşa', 'eyüp', 'başakşehir', 'küçükçekmece',
  'avcılar', 'arnavutköy', 'sultangazi', 'gaziosmanpaşa', 'kağıthane',
  'beyoğlu', 'şişli', 'sarıyer', 'beşiktaş', 'hadımköy','maslak',
'levent',
'etiler',
'ayazağa',
'istinye',
'zekeriyaköy',
'tarabya',
'kağıthane',
'seyrantepe',
'sanayi mahallesi',
'mahmutbey',
'ikitelli',
'güneşli',
'bağcılar'
];

/** Anadolu geneli — long-haul tespit için */
export const ANADOLU_GEN = [
  'kocaeli', 'izmit', 'sakarya', 'adapazarı', 'düzce', 'bolu', 'ankara',
  'eskişehir', 'konya', 'antalya', 'mersin', 'adana', 'gaziantep', 'kayseri',
  'sivas', 'trabzon', 'erzurum', 'diyarbakır', 'hatay', 'malatya', 'elazığ',
  'rize', 'ordu', 'samsun', 'amasya', 'tokat', 'çorum', 'kastamonu',
  'zonguldak', 'afyon', 'isparta', 'denizli', 'muğla', 'aydın', 'uşak',
  'kütahya', 'bilecik', 'yalova', 'manisa',
];

/** Trakya — long-haul tespit için */
export const AVRUPA_GEN = [
  'edirne', 'tekirdağ', 'kırklareli', 'çorlu', 'lüleburgaz', 'çerkezköy',
  'malkara', 'keşan', 'uzunköprü',
];

/** Osmangazi kuzey yakası (Kocaeli/Sakarya/Ankara hattı) */
export const OSM_KUZEY = [
  'tuzla', 'pendik', 'kartal', 'gebze', 'darıca', 'çayırova', 'dilovası',
  'kocaeli', 'izmit', 'sakarya', 'adapazarı', 'düzce', 'bolu', 'ankara',
  'istanbul',
];

/** Osmangazi güney yakası (Yalova/Bursa/Ege hattı) */
export const OSM_GUNEY = [
  'bursa', 'yalova', 'mudanya', 'gemlik', 'inegöl', 'orhangazi', 'nilüfer',
  'izmir', 'balıkesir', 'manisa', 'aydın', 'muğla', 'denizli', 'uşak',
  'kütahya', 'afyon', 'isparta', 'burdur',
];

/** Çanakkale Trakya yakası */
export const CAN_TRAKYA = [
  'edirne', 'tekirdağ', 'kırklareli', 'çorlu', 'lüleburgaz', 'çerkezköy',
  'malkara', 'keşan', 'uzunköprü', 'gelibolu', 'eceabat', 'enez', 'ipsala',
  'beylikdüzü', 'esenyurt', 'büyükçekmece', 'silivri', 'çatalca', 'bakırköy',
  'arnavutköy', 'hadımköy',
];

/** Çanakkale Anadolu/Ege yakası */
export const CAN_ASYA = [
  'çanakkale', 'lapseki', 'biga', 'can', 'bayramiç', 'ezine', 'yenice',
  'balikesir', 'bandirma', 'gonen', 'edremit', 'burhaniye', 'ayvalik',
  'bursa', 'karacabey', 'susurluk', 'izmir', 'menemen', 'aliaga', 'manisa',
  'aydin', 'mugla', 'denizli', 'usak', 'kutahya',
];

/* ────────────────────────────────────────────────────────────
   6) Geometrik yardımcılar
   ──────────────────────────────────────────────────────────── */

export function isInIstanbulBounds(point: LatLng): boolean {
  return (
    point.lat >= ISTANBUL_BOUNDS.minLat &&
    point.lat <= ISTANBUL_BOUNDS.maxLat &&
    point.lng >= ISTANBUL_BOUNDS.minLng &&
    point.lng <= ISTANBUL_BOUNDS.maxLng
  );
}

/** İki nokta Boğaz'ı geçiyor mu — basit lng karşılaştırma */
export function crossesBosphorus(a: LatLng, b: LatLng): boolean {
  if (!isInIstanbulBounds(a) && !isInIstanbulBounds(b)) return false;
  const aIsEuropean = a.lng < BOSPHORUS_LNG;
  const bIsEuropean = b.lng < BOSPHORUS_LNG;
  return aIsEuropean !== bIsEuropean;
}

export function bridgeShortName(bridgeId: BridgeId): string {
  if (bridgeId === 'fsm') return 'FSM';
  if (bridgeId === 'yss') return 'YSS';
  if (bridgeId === '15temmuz') return '15 Temmuz';
  if (bridgeId === 'osmangazi') return 'Osmangazi';
  if (bridgeId === 'canakkale') return '1915 Çanakkale';
  return String(bridgeId).toUpperCase();
}
