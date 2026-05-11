# BACS Labs · Vehicle-Aware Routing

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](tsconfig.json)
[![Astro](https://img.shields.io/badge/Astro-5.x-FF5D01.svg)](https://astro.build/)

> **Türkiye iç pazarı için yön-bilinçli rota & fiyatlama motoru.**
> Köprü sınıfı (FSM/YSS), KGM 2026 koridor tarifeleri, akaryakıt + eskalasyon bandı.
> Manuel hesaplanamayacak bir denklemin saf TypeScript implementasyonu.

**Canlı demo:** [labs.barisanil.com](https://labs.barisanil.com)
**Yazar:** [Barış Anıl](https://barisanil.com) · BACS Consultancy
**Vaka:** *Megapol Lojistik için kurduğum Spot Araç motoru — Türkiye'de Koç Holding, Tüpraş, Şişecam, Carrefour SA, NIVEA, Abdi İbrahim, Madame Coco'ya hizmet veren lojistik firması.* Bu repo o motorun **lite + sanitized** versiyonu.

---

## English Executive Summary

A vehicle-aware routing & pricing engine for Turkish freight operations. The problem: in Turkey, freight pricing is not `distance × rate/km`. It is the product of vehicle class (1st–5th KGM), forced bridge selection (light vehicles use FSM, heavy vehicles are legally restricted to YSS), official KGM corridor tariffs (~11 toll motorways with full-line rates), bridge tolls (5 bridges, class-based), and a fuel + escalation pricing model. Manual quoting fails because direction-aware waypoints (which side of FSM, asian→european or reverse) materially change route geometry.

This repository ports the production engine I built for **Megapol Lojistik** into a public, sanitized, zero-runtime-dependency TypeScript module. It is the technical proof behind the message *"I can build this for your operation, too."*

**Use cases:**

- Freight quoting engines (FTL/LTL)
- TMS / 4PL platform integration
- Procurement tender validation
- Logistics consultancy diagnostic

**License:** MIT — fork it, ship it. Production integration consultancy via [barisanil.com](https://barisanil.com).

---

## Türkçe Açıklama

### Problem

Türkiye'de spot araç fiyatı, *"kaç kilometre × kaç TL"* değildir. Yapısal değişkenler:

- **8 araç sınıfı** × **5 KGM tarife sınıfı** taksonomi
- **Köprü zorunluluğu:** 1.-2. sınıf FSM kullanır, 3.-5. sınıf yasal olarak YSS'den geçer
- **Yön bazlı waypoint:** Aynı köprünün iki şeridi farklı koordinat — yanlış yönde routing motoru köprüyü atlar
- **KGM 2026 koridorları:** 11 resmi otoyol koridoru, tam-hat ücreti + prorate
- **5 köprü** × **5 sınıf** × KDV dahil tarife matrisi
- **Multi-bridge zincirleri:** İzmir→Edirne rotası Osmangazi + YSS otomatik ekler
- **Akaryakıt + eskalasyon:** araç tüketim profili + sınıf bazlı eskalasyon TL/km

Manuel hesap bu denklemde başarısız. Excel ile yaklaşık. Standart routing API'leri köprü sınıfını bilmez.

### Çözüm

Saf TypeScript engine — DOM, Google Maps, ağ bağımlılığı yok. Pure functions. 100% test edilebilir.

```ts
import { computeQuote } from '@bacs-labs/routing';

const quote = computeQuote({
  fromText: 'Mahmutbey, İstanbul',
  toText: 'Bursa',
  km: 240,
  vehicle: 'TIR 22-26t',
  fuelPrice: 78.60,
});

// quote.analysis.bridges         → ['osmangazi']
// quote.analysis.waypoints       → [Osmangazi yön-bilinçli LatLng]
// quote.analysis.corridor        → null (multi-corridor)
// quote.analysis.profile.reason  → "Marmara ↔ Güney Marmara/Ege için Osmangazi önceliği"
// quote.price.fuelCost           → 6602.40 (₺)
// quote.price.lower              → 24500 (₺, 500 yuvarlanmış alt band)
// quote.price.upper              → 30500 (₺, 500 yuvarlanmış üst band)
```

---

## Mimari

### Modüller

```
src/lib/
├── types.ts             ← Ortak TypeScript tipleri
├── bridge-data.ts       ← VEHICLE_BRIDGE_CLASS, koordinatlar, sözlükler
├── kgm-tariff.ts        ← HGS_DATA + 11 KGM koridoru + tarife matrisi
├── routing-engine.ts    ← Rota profili + waypoint zinciri + köprü tespiti
└── price-engine.ts      ← Akaryakıt + KGM + fiyat öneri bandı
```

### Çekirdek fonksiyonlar

| Fonksiyon | Sorumluluk |
|---|---|
| `detectBridges(from, to)` | Heuristik köprü tespiti (Çanakkale > Osmangazi > Boğaz öncelik) |
| `getDesiredPaidRouteProfile(from, to)` | Plan chain üretir (multi-bridge zinciri) |
| `getBridgeDirectionWaypoint(bridge, dir)` | Yön bazlı LatLng (asian↔european / north↔south / east↔west) |
| `buildBridgeAwareWaypointChain(forced, from, to)` | Plan + forced köprü → Waypoint[] |
| `getFuelEstimateForVehicle(v, km, price)` | Tüketim profili × km × fiyat |
| `getHgsEstimateForVehicle(v, km, from, to)` | Resmi koridor + köprü ücreti toplamı |
| `getPriceSuggestionForVehicle(v, km, price, from, to)` | Akaryakıt + eskalasyon → 500-yuvarlanmış band |
| `analyzeRoute(from, to, vehicle)` | End-to-end rota analizi |
| `computeQuote(req)` | End-to-end tek çağrı (analiz + fiyat) |

### Data integrity

- **KGM 2026 tarifeleri:** kgm.gov.tr resmi PDF verisi, KDV dahil
- **Köprü koordinatları:** FSM/YSS sahada doğrulanmış precise koordinatlar, Osmangazi/Çanakkale midpoint
- **Vehicle class mapping:** UKOME + KGM yönetmeliği (Mart 2026)

---

## Kurulum

### Gereksinimler

- Node.js 20+
- npm 10+

### Adımlar

```bash
git clone https://github.com/barisanil1975/bacs-vehicle-aware-routing.git
cd bacs-vehicle-aware-routing
npm install
npm run dev          # Dev server: http://localhost:4321
npm test             # Vitest unit testleri
npm run build        # Production build (dist/)
```

---

## Test Sonuçları

```bash
npm test
```

Mevcut test kapsamı:

- `routing.test.ts` — 22 test (köprü tespiti, plan chain, waypoint yönü, end-to-end)
- `pricing.test.ts` — 16 test (yakıt, HGS, fiyat bandı, 500-yuvarlama)

Toleranslar: %70+ line/function/statement coverage.

---

## Lisans

MIT — [LICENSE](LICENSE) bkz.

Production'a koymak istiyorsan: bilgi@barisanil.com — birlikte değerlendirelim.

---

## Hakkında

**Barış Anıl** · BACS Consultancy · 24+ yıl lojistik, tedarik zinciri ve dijital platform liderliği. Boğaz köprüsü algoritmaları, KGM tarife matrisleri ve fleet operasyonel mimarisi yazan; *"sizin için de kurarım"* mesajının kanıt katmanı bu repo.

Daha fazla:
- [barisanil.com](https://barisanil.com) — Üst Düzey Yönetim Danışmanlığı
- [LinkedIn](https://linkedin.com/in/barisanil)
- 30 dakikalık görüşme: [calendly.com/barisanil/30min](https://calendly.com/barisanil/30min)
