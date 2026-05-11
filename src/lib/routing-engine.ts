/**
 * BACS Labs · Vehicle-Aware Routing Engine
 * Routing logic — yön-bilinçli waypoint mimarisi, multi-bridge zinciri,
 * Türkiye iç pazarı koridor profilleri.
 *
 * Mimari:
 * 1. getDesiredPaidRouteProfile(from, to) → planChain üretir
 *    (Avrupa↔Anadolu, Avrupa↔Güney Marmara, Trakya↔Ege, vs.)
 * 2. buildBridgeAwareWaypointChain(plan, force, from, to) → Waypoint[] üretir
 *    Forced köprü (1.-2. sınıf FSM, 3.-5. sınıf YSS) ile zincir genişletilir
 * 3. detectBridges(from, to) → heuristik köprü liste tespiti
 *
 * Önceki Megapol kodundan farklar:
 * - Async Google Geocoding bağımlılığı yok (saf text-based)
 * - DOM/UI bağlantıları kaldırıldı
 * - Test edilebilir pure functions
 */

import {
  ANADOLU_GEN,
  ANADOLU_IST,
  AVRUPA_GEN,
  AVRUPA_IST,
  BRIDGE_DIRECTION_WAYPOINTS,
  CAN_ASYA,
  CAN_TRAKYA,
  OSM_GUNEY,
  OSM_KUZEY,
} from './bridge-data';
import type {
  BridgeId,
  ChainDirection,
  LatLng,
  RouteProfile,
  VehicleId,
  Waypoint,
} from './types';
import { VEHICLE_BRIDGE_CLASS } from './bridge-data';
import { detectOfficialKgmCorridor, kgmNormalize } from './kgm-tariff';

/* ────────────────────────────────────────────────────────────
   1) Boğaz/Marmara/Çanakkale geçiş tespiti
   ──────────────────────────────────────────────────────────── */

function hasAnyKeyword(normalizedText: string, keywords: string[]): boolean {
  return keywords.some((k) => normalizedText.includes(kgmNormalize(k)));
}

/**
 * Heuristik köprü tespiti — fromText ve toText'i analiz eder.
 *
 * Öncelik sırası kritik:
 *   1) 1915 Çanakkale (Trakya ↔ Batı Anadolu)
 *   2) Osmangazi (Kuzey Marmara ↔ Güney Marmara)
 *   3) Boğaz (yalnızca yukarıdakiler yoksa)
 *
 * Bu sıralama; rotanın Marmara'yı 1915/Osmangazi ile geçtiği durumlarda
 * yanlışlıkla FSM/YSS eklenmesini önler.
 */
export function detectBridges(fromText: string, toText: string): BridgeId[] {
  if (!fromText || !toText) return [];

  const from = kgmNormalize(fromText);
  const to = kgmNormalize(toText);

  const bridges: BridgeId[] = [];

  // Osmangazi
  const fOK = hasAnyKeyword(from, OSM_KUZEY);
  const tOK = hasAnyKeyword(to, OSM_KUZEY);
  const fOG = hasAnyKeyword(from, OSM_GUNEY);
  const tOG = hasAnyKeyword(to, OSM_GUNEY);
  const hasOsmangazi = (fOK && tOG) || (fOG && tOK);

  // Çanakkale
  const fCT = hasAnyKeyword(from, CAN_TRAKYA);
  const tCT = hasAnyKeyword(to, CAN_TRAKYA);
  const fCA = hasAnyKeyword(from, CAN_ASYA);
  const tCA = hasAnyKeyword(to, CAN_ASYA);
  const hasCanakkale = (fCT && tCA) || (fCA && tCT);

  if (hasCanakkale) bridges.push('canakkale');
  if (hasOsmangazi) bridges.push('osmangazi');

  // Boğaz — yalnızca Çanakkale ve Osmangazi devrede değilse
  const fA = hasAnyKeyword(from, [...ANADOLU_IST, ...ANADOLU_GEN]);
  const fE = hasAnyKeyword(from, [...AVRUPA_IST, ...AVRUPA_GEN]);
  const tA = hasAnyKeyword(to, [...ANADOLU_IST, ...ANADOLU_GEN]);
  const tE = hasAnyKeyword(to, [...AVRUPA_IST, ...AVRUPA_GEN]);

  const needsBosphorus =
    ((fA && tE) || (fE && tA)) && !hasCanakkale && !hasOsmangazi;

  // "bogaz" placeholder — kullanıcı araç sınıfına göre 15temmuz/fsm/yss seçer
  // detectBridges seviyesinde sınıf bilinmediği için generic dönüyor
  if (needsBosphorus) {
    // Default: YSS — long-haul transit için en doğru fallback
    bridges.push('yss');
  }

  return bridges;
}

/* ────────────────────────────────────────────────────────────
   2) getDesiredPaidRouteProfile
   Türkiye iç pazar koridorları için zincir profili üretir.
   ──────────────────────────────────────────────────────────── */

function makeProfile(reason = ''): RouteProfile {
  return {
    preferCorridors: [],
    preferBridges: [],
    requiredCorridors: [],
    requiredBridges: [],
    avoidCorridors: [],
    avoidBridges: [],
    planChain: [],
    reason,
  };
}

/**
 * Verilen kalkış/varış metnine göre ücretli yol/köprü profilini üretir.
 *
 * Profile, ardışık olarak şu cases'leri kontrol eder:
 *  1. Güney Marmara/Ege ↔ Avrupa: Osmangazi + YSS zinciri
 *  2. Anadolu ↔ Çanakkale: YSS + 1915 zinciri
 *  3. Trakya ↔ Batı Anadolu/Ege: 1915 Çanakkale önceliği
 *  4. Marmara ↔ Güney Marmara/Ege: Osmangazi önceliği
 *  5. Transit Boğaz (Avrupa ↔ Anadolu, long-haul varsa YSS, değilse FSM)
 *  6. Default: genel analiz (boş chain)
 */
export function getDesiredPaidRouteProfile(
  fromText: string,
  toText: string
): RouteProfile {
  const from = kgmNormalize(fromText || '');
  const to = kgmNormalize(toText || '');

  const avrupaSide = [...AVRUPA_IST, ...AVRUPA_GEN];
  const anadoluSide = [...ANADOLU_IST, ...ANADOLU_GEN];
  const trakyaLong = [
    'edirne', 'tekirdag', 'kirklareli', 'corlu', 'luleburgaz', 'cerkezkoy',
    'malkara', 'kesan', 'uzunkopru', 'ipsala', 'gelibolu', 'eceabat',
    'enez', 'silivri', 'catalca', 'buyukcekmece', 'hadimkoy', 'arnavutkoy',
  ];
  const canakkaleDemand = [
    'canakkale', 'lapseki', 'biga', 'gelibolu', 'eceabat', 'kilitbahir',
    'bozcaada', 'gokceada', 'gokceada feribot', 'malkara',
  ];
  const canakkaleWest = [
    'canakkale', 'lapseki', 'biga', 'can', 'bayramic', 'ezine', 'yenice',
    'balikesir', 'bandirma', 'gonen', 'edremit', 'burhaniye', 'ayvalik',
    'izmir', 'menemen', 'aliaga', 'manisa', 'aydin', 'mugla', 'denizli',
    'usak', 'kutahya',
  ];
  const osmSouth = [
    'yalova', 'bursa', 'orhangazi', 'gemlik', 'mudanya', 'nilufer', 'inegol',
    'susurluk', 'balikesir', 'manisa', 'izmir', 'aydin', 'mugla', 'denizli',
    'usak', 'kutahya', 'afyon',
  ];
  const osmNorth = OSM_KUZEY;

  const fromAvrupa = hasAnyKeyword(from, avrupaSide);
  const toAvrupa = hasAnyKeyword(to, avrupaSide);
  const fromAnadolu = hasAnyKeyword(from, anadoluSide);
  const toAnadolu = hasAnyKeyword(to, anadoluSide);
  const fromOsmSouth = hasAnyKeyword(from, osmSouth);
  const toOsmSouth = hasAnyKeyword(to, osmSouth);
  const fromOsmNorth = hasAnyKeyword(from, osmNorth);
  const toOsmNorth = hasAnyKeyword(to, osmNorth);
  const fromCanDemand = hasAnyKeyword(from, canakkaleDemand);
  const toCanDemand = hasAnyKeyword(to, canakkaleDemand);
  const fromTrakya = hasAnyKeyword(from, trakyaLong);
  const toTrakya = hasAnyKeyword(to, trakyaLong);

  // 1) Güney Marmara/Ege → Avrupa (Osmangazi + YSS)
  if (fromOsmSouth && toAvrupa) {
    const p = makeProfile(
      'Güney Marmara/Ege → Avrupa hattında Osmangazi + YSS / Kuzey Marmara zinciri'
    );
    p.preferCorridors = ['osmangazi', 'yss_kmo'];
    p.preferBridges = ['osmangazi', 'yss'];
    p.requiredCorridors = ['osmangazi', 'yss_kmo'];
    p.requiredBridges = ['osmangazi', 'yss'];
    p.planChain = [
      { id: 'osmangazi', direction: 'reverse' },
      { id: 'yss_kmo', direction: 'reverse' },
    ];
    return p;
  }

  // 2) Avrupa → Güney Marmara/Ege
  if (fromAvrupa && toOsmSouth) {
    const p = makeProfile(
      'Avrupa → Güney Marmara/Ege hattında YSS / Kuzey Marmara + Osmangazi zinciri'
    );
    p.preferCorridors = ['yss_kmo', 'osmangazi'];
    p.preferBridges = ['yss', 'osmangazi'];
    p.requiredCorridors = ['yss_kmo', 'osmangazi'];
    p.requiredBridges = ['yss', 'osmangazi'];
    p.planChain = [
      { id: 'yss_kmo', direction: 'forward' },
      { id: 'osmangazi', direction: 'forward' },
    ];
    return p;
  }

  // 3) Anadolu → Çanakkale (YSS + 1915)
  if (fromAnadolu && toCanDemand) {
    const p = makeProfile(
      'Anadolu / doğu yakası → Çanakkale hattında YSS / Kuzey Marmara + 1915 Çanakkale zinciri'
    );
    p.preferCorridors = ['yss_kmo', 'canakkale'];
    p.preferBridges = ['yss', 'canakkale'];
    p.requiredCorridors = ['yss_kmo', 'canakkale'];
    p.requiredBridges = ['yss', 'canakkale'];
    p.planChain = [
      { id: 'yss_kmo', direction: 'reverse' },
      { id: 'canakkale', direction: 'forward' },
    ];
    return p;
  }

  // 4) Çanakkale → Anadolu
  if (fromCanDemand && toAnadolu) {
    const p = makeProfile(
      'Çanakkale → Anadolu / doğu yakası hattında 1915 Çanakkale + YSS / Kuzey Marmara zinciri'
    );
    p.preferCorridors = ['canakkale', 'yss_kmo'];
    p.preferBridges = ['canakkale', 'yss'];
    p.requiredCorridors = ['canakkale', 'yss_kmo'];
    p.requiredBridges = ['canakkale', 'yss'];
    p.planChain = [
      { id: 'canakkale', direction: 'reverse' },
      { id: 'yss_kmo', direction: 'forward' },
    ];
    return p;
  }

  // 5) Trakya ↔ Batı Anadolu/Ege (1915 Çanakkale)
  const wantsCanakkale =
    (fromTrakya && hasAnyKeyword(to, canakkaleWest)) ||
    (toTrakya && hasAnyKeyword(from, canakkaleWest));
  if (wantsCanakkale) {
    const p = makeProfile('Trakya ↔ Batı Anadolu/Ege için 1915 Çanakkale önceliği');
    p.preferCorridors = ['canakkale'];
    p.preferBridges = ['canakkale'];
    p.requiredCorridors = ['canakkale'];
    p.requiredBridges = ['canakkale'];
    p.planChain = [
      { id: 'canakkale', direction: fromTrakya ? 'forward' : 'reverse' },
    ];
    return p;
  }

  // 6) Marmara ↔ Güney Marmara/Ege (Osmangazi)
  const wantsOsmangazi =
    (fromOsmNorth && toOsmSouth) || (toOsmNorth && fromOsmSouth);
  if (wantsOsmangazi) {
    const p = makeProfile('Marmara ↔ Güney Marmara/Ege için Osmangazi önceliği');
    p.preferCorridors = ['osmangazi'];
    p.preferBridges = ['osmangazi'];
    p.requiredCorridors = ['osmangazi'];
    p.requiredBridges = ['osmangazi'];
    p.planChain = [
      { id: 'osmangazi', direction: fromOsmNorth ? 'forward' : 'reverse' },
    ];
    return p;
  }

  // 7) Transit Boğaz geçişi (Avrupa ↔ Anadolu)
  const needsBosphorusTransit =
    (fromAvrupa && toAnadolu) || (toAvrupa && fromAnadolu);
  if (needsBosphorusTransit) {
    const p = makeProfile('Transit Boğaz geçişi');
    const hasLongHaul =
      hasAnyKeyword(from, AVRUPA_GEN) ||
      hasAnyKeyword(to, AVRUPA_GEN) ||
      hasAnyKeyword(from, ANADOLU_GEN) ||
      hasAnyKeyword(to, ANADOLU_GEN);

    if (hasLongHaul) {
      p.preferCorridors = ['yss_kmo'];
      p.preferBridges = ['yss'];
      p.requiredCorridors = ['yss_kmo'];
      p.requiredBridges = ['yss'];
      p.planChain = [
        { id: 'yss_kmo', direction: fromAvrupa ? 'forward' : 'reverse' },
      ];
      p.reason = 'Transit Boğaz geçişinde Kuzey Marmara / YSS önceliği';
    } else {
      p.preferBridges = ['fsm', '15temmuz'];
      p.reason = 'Şehir içi Boğaz geçişi';
    }
    return p;
  }

  return makeProfile('Genel ücretli yol analizi');
}

/* ────────────────────────────────────────────────────────────
   3) Yön bazlı waypoint seçimi
   ──────────────────────────────────────────────────────────── */

/**
 * Köprü için yön-bilinçli waypoint koordinatı döner.
 *
 * Öncelik sırası:
 *  1. planChain.direction (forward/reverse) — long-haul için en güvenilir
 *  2. fromCoord/toCoord verilirse koordinat fallback
 *  3. Default (en yaygın yön)
 *
 * @param bridgeId — köprü tanımlayıcısı
 * @param direction — chain'den gelen forward/reverse
 * @returns yön bazlı LatLng veya null
 */
export function getBridgeDirectionWaypoint(
  bridgeId: BridgeId,
  direction: ChainDirection
): LatLng | null {
  const map = BRIDGE_DIRECTION_WAYPOINTS;

  if (bridgeId === 'fsm') {
    return direction === 'forward'
      ? map.fsm.europeanToAsian
      : map.fsm.asianToEuropean;
  }
  if (bridgeId === 'yss') {
    return direction === 'forward'
      ? map.yss.europeanToAsian
      : map.yss.asianToEuropean;
  }
  if (bridgeId === 'osmangazi') {
    return direction === 'forward'
      ? map.osmangazi.northToSouth
      : map.osmangazi.southToNorth;
  }
  if (bridgeId === 'canakkale') {
    // forward = Trakya→Anadolu (westToEast)
    // reverse = Anadolu→Trakya (eastToWest)
    return direction === 'forward'
      ? map.canakkale.westToEast
      : map.canakkale.eastToWest;
  }
  // 15temmuz: yön ayrımı yok, FSM koordinatına yakın yerleştir
  return map.fsm.asianToEuropean;
}

/* ────────────────────────────────────────────────────────────
   4) buildBridgeAwareWaypointChain
   Plan zincirinden + kullanıcının zorladığı köprüden waypoint listesi.
   ──────────────────────────────────────────────────────────── */

/**
 * Plan zincirini gezerek yön-bilinçli waypoint listesi üretir.
 *
 * @param forcedBosphorusBridge — Araç sınıfından çıkartılan Boğaz köprüsü ('fsm' veya 'yss')
 * @param fromText — kalkış metni
 * @param toText — varış metni
 * @returns Waypoint zinciri (sıralı)
 */
export function buildBridgeAwareWaypointChain(
  forcedBosphorusBridge: BridgeId,
  fromText: string,
  toText: string
): Waypoint[] {
  const profile = getDesiredPaidRouteProfile(fromText, toText);
  const planChain = profile.planChain;
  const waypoints: Waypoint[] = [];
  let bosphorusAdded = false;

  for (const item of planChain) {
    if (item.id === 'yss_kmo') {
      // Boğaz geçişini kullanıcının zorladığı köprü ile değiştir
      const wp = getBridgeDirectionWaypoint(forcedBosphorusBridge, item.direction);
      if (wp)
        waypoints.push({
          location: wp,
          stopover: false,
          bridgeId: forcedBosphorusBridge,
        });
      bosphorusAdded = true;
    } else if (item.id === 'osmangazi') {
      const wp = getBridgeDirectionWaypoint('osmangazi', item.direction);
      if (wp)
        waypoints.push({ location: wp, stopover: false, bridgeId: 'osmangazi' });
    } else if (item.id === 'canakkale') {
      const wp = getBridgeDirectionWaypoint('canakkale', item.direction);
      if (wp)
        waypoints.push({ location: wp, stopover: false, bridgeId: 'canakkale' });
    }
    // Diğer corridor'lar — routing engine otomatik ele alır
  }

  // Plan-chain Boğaz içermiyorsa ama kullanıcı bridge zorladıysa
  // (örn. doğrudan Boğaz geçişi: Maslak→Pendik) — standalone ekle
  if (
    !bosphorusAdded &&
    (forcedBosphorusBridge === 'fsm' || forcedBosphorusBridge === 'yss' ||
     forcedBosphorusBridge === '15temmuz')
  ) {
    // Doğrudan Boğaz geçişi tespiti
    const hasFromAvrupa = hasAnyKeyword(
      kgmNormalize(fromText),
      [...AVRUPA_IST, ...AVRUPA_GEN]
    );
    const hasFromAnadolu = hasAnyKeyword(
      kgmNormalize(fromText),
      [...ANADOLU_IST, ...ANADOLU_GEN]
    );
    const hasToAvrupa = hasAnyKeyword(
      kgmNormalize(toText),
      [...AVRUPA_IST, ...AVRUPA_GEN]
    );
    const hasToAnadolu = hasAnyKeyword(
      kgmNormalize(toText),
      [...ANADOLU_IST, ...ANADOLU_GEN]
    );

    const needsBosphorus =
      (hasFromAvrupa && hasToAnadolu) || (hasFromAnadolu && hasToAvrupa);

    if (needsBosphorus) {
      const direction: ChainDirection = hasFromAvrupa ? 'forward' : 'reverse';
      const wp = getBridgeDirectionWaypoint(forcedBosphorusBridge, direction);
      if (wp)
        waypoints.unshift({
          location: wp,
          stopover: false,
          bridgeId: forcedBosphorusBridge,
        });
    }
  }

  return waypoints;
}

/* ────────────────────────────────────────────────────────────
   5) Vehicle helpers
   ──────────────────────────────────────────────────────────── */

/**
 * Araç sınıfına göre Boğaz köprü ID'sini döner.
 * 1.-2. sınıf FSM, 3.-5. sınıf YSS.
 */
export function getForcedBosphorusBridge(vehicle: VehicleId): BridgeId {
  const bridgeClass = VEHICLE_BRIDGE_CLASS[vehicle];
  return bridgeClass === 'fsm' ? 'fsm' : 'yss';
}

/**
 * Tam route analysis — UI tarafının ihtiyacı olan tüm bilgileri toplar.
 */
export function analyzeRoute(
  fromText: string,
  toText: string,
  vehicle: VehicleId
) {
  const profile = getDesiredPaidRouteProfile(fromText, toText);
  const forcedBosphorus = getForcedBosphorusBridge(vehicle);
  const waypoints = buildBridgeAwareWaypointChain(
    forcedBosphorus,
    fromText,
    toText
  );
  const bridges = detectBridges(fromText, toText);
  // Boğaz tespit edildiyse, Boğaz köprüsünü araç sınıfına göre değiştir
  const bridgesNormalized = bridges.map((b) => {
    if (b === 'yss' && VEHICLE_BRIDGE_CLASS[vehicle] === 'fsm') {
      return 'fsm' as BridgeId;
    }
    return b;
  });
  const corridor = detectOfficialKgmCorridor(fromText, toText);

  return {
    profile,
    forcedBosphorus,
    waypoints,
    bridges: bridgesNormalized,
    corridor: corridor ? corridor.id : null,
  };
}
it('routes European Istanbul to İzmir with heavy vehicle through YSS + Osmangazi', () => {
  const analysis = analyzeRoute('Maslak', 'İzmir', 'TIR 22-26t');

  expect(analysis.profile.requiredBridges).toContain('yss');
  expect(analysis.profile.requiredBridges).toContain('osmangazi');
  expect(analysis.waypoints.map((w) => w.bridgeId)).toEqual(['yss', 'osmangazi']);
});
it('recognizes Mahmutbey as European Istanbul for heavy vehicle routes to Bursa', () => {
  const analysis = analyzeRoute('Mahmutbey, İstanbul', 'Bursa', 'TIR 22-26t');

  expect(analysis.waypoints.map((w) => w.bridgeId)).toEqual(['yss', 'osmangazi']);
});
