/**
 * BACS Labs · Vehicle-Aware Routing Engine
 * Core types — engine ve UI tarafında ortak tip sözlüğü
 */

/* ────────────────────────────────────────────────────────────
   Araç sınıfı taksonomisi
   8 araç sınıfı, UKOME/KGM kategorileri ile hizalı.
   ──────────────────────────────────────────────────────────── */
export type VehicleId =
  | 'Minivan'
  | 'Panelvan 3,5-5t'
  | 'Panelvan 5-7,5t'
  | 'Panelvan 5-7,5t Kamyon'
  | 'Kamyon 7,5-12t'
  | 'Onteker 10-15t'
  | 'Kırkayak 15-20t'
  | 'TIR 22-26t';

export type BridgeClass = 'fsm' | 'yss';

export type BridgeId =
  | '15temmuz'   // 15 Temmuz Şehitler (sadece 1. sınıf)
  | 'fsm'        // Fatih Sultan Mehmet (1.-2. sınıf)
  | 'yss'        // Yavuz Sultan Selim (tüm sınıflar, 3.-5. zorunlu)
  | 'osmangazi'  // Marmara körfezi geçişi
  | 'canakkale'; // 1915 Çanakkale (Trakya↔Anadolu)

export type CorridorId =
  | 'anadolu'              // Çamlıca-Akıncı
  | 'avrupa'               // Mahmutbey-Edirne
  | 'izmir_cesme'
  | 'izmir_aydin'
  | 'adana_gaziantep'
  | 'gaziantep_sanliurfa'
  | 'nigde_adana'
  | 'nigde_mersin'
  | 'ankara_nigde'
  | 'aydin_denizli'
  | 'menemen_candarli';

/** KGM sınıf indeksi — 1 (en hafif) ile 5 (en ağır) arası. */
export type KgmClass = 1 | 2 | 3 | 4 | 5;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Waypoint {
  location: LatLng;
  /** Stopover false: yalnızca routing hint, durak değil */
  stopover: boolean;
  /** Hangi köprü için yerleştirildi — debugging için */
  bridgeId?: BridgeId;
}

/* ────────────────────────────────────────────────────────────
   Rota profili — getDesiredPaidRouteProfile çıktısı
   ──────────────────────────────────────────────────────────── */

export type ChainDirection = 'forward' | 'reverse';

export interface ChainItem {
  /** Plan zincirinde geçen corridor veya bridge id */
  id: CorridorId | BridgeId | 'yss_kmo';
  direction: ChainDirection;
}

export interface RouteProfile {
  preferCorridors: string[];
  preferBridges: BridgeId[];
  requiredCorridors: string[];
  requiredBridges: BridgeId[];
  avoidCorridors: string[];
  avoidBridges: BridgeId[];
  planChain: ChainItem[];
  reason: string;
}

/* ────────────────────────────────────────────────────────────
   Köprü verileri
   ──────────────────────────────────────────────────────────── */

export interface BridgeDirectionWaypoints {
  fsm: { asianToEuropean: LatLng; europeanToAsian: LatLng };
  yss: { asianToEuropean: LatLng; europeanToAsian: LatLng };
  osmangazi: { northToSouth: LatLng; southToNorth: LatLng };
  canakkale: { eastToWest: LatLng; westToEast: LatLng };
}

export interface BridgeDefinition {
  name: string;
  /** Sınıf bazlı 2026 KGM ücretleri (KDV dahil, ₺) */
  rates: Partial<Record<KgmClass, number>>;
}

/* ────────────────────────────────────────────────────────────
   KGM koridor tanımı
   ──────────────────────────────────────────────────────────── */

export interface KgmCorridor {
  id: CorridorId;
  name: string;
  /** Tam hat km — KGM resmi tarife uzunluğu */
  fullKm: number;
  /** Sınıf bazlı tam-hat ücreti */
  rates: Record<KgmClass, number>;
  /** Bir uçtaki şehirler */
  sideA: string[];
  /** Diğer uçtaki şehirler */
  sideB: string[];
}

/* ────────────────────────────────────────────────────────────
   Fiyat motoru
   ──────────────────────────────────────────────────────────── */

export interface FuelProfile {
  /** Boş gidişte L/100km */
  bosMin: number;
  /** Yüklü dönüşte L/100km */
  yukluMax: number;
}

export interface PriceSuggestionModel {
  /** Akaryakıt maliyetinin toplam fiyat içindeki tarihsel payı (0-1) */
  fuelShare: number;
  /** Sabit + değişken eskalasyon — ₺/km */
  escalationPerKm: number;
  /** Minimum taban — pazara konulan grafiksel alt sınır (₺) */
  minFloor: number;
}

export interface HgsProfile {
  sinif: KgmClass;
  label: string;
  /** Özel/genel otoyolda fallback ₺/km — resmi koridor tespit edilemezse */
  perKm: number;
}

/* ────────────────────────────────────────────────────────────
   Hesaplama çıktıları
   ──────────────────────────────────────────────────────────── */

export interface RouteAnalysis {
  /** Tespit edilen köprüler (yöne göre sıralı) */
  bridges: BridgeId[];
  /** Bilinen koridor (eğer tek bir tane net tespit edildiyse) */
  corridor: CorridorId | null;
  /** Önerilen rota profili */
  profile: RouteProfile;
  /** Yön bazlı waypoint zinciri */
  waypoints: Waypoint[];
}

export interface PriceSuggestion {
  vehicle: VehicleId;
  /** Akaryakıt tutarı (₺) */
  fuelCost: number;
  /** Köprü + otoyol toplamı (₺) */
  hgsCost: number;
  /** Akaryakıt-bazlı kapalı fiyat ipucu */
  akaryakitQuote: number;
  /** Eskalasyon-bazlı (km × ₺/km) kapalı fiyat ipucu */
  escalasyonQuote: number;
  /** Önerilen fiyat aralığı — alt band (₺, 500 yuvarlanmış) */
  lower: number;
  /** Önerilen fiyat aralığı — üst band (₺, 500 yuvarlanmış) */
  upper: number;
}

export interface QuoteRequest {
  fromText: string;
  toText: string;
  km: number;
  vehicle: VehicleId;
  /** Güncel motorin TL/L; verilmezse default (78.60) kullanılır */
  fuelPrice?: number;
}

export interface QuoteResponse {
  request: QuoteRequest;
  analysis: RouteAnalysis;
  price: PriceSuggestion;
}
