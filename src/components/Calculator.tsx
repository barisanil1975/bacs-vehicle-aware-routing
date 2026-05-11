/**
 * BACS Labs · Calculator (Main Island)
 *
 * Tek React island — Astro tarafında client:load ile yüklenir.
 * - Form state (kalkış, varış, araç tipi)
 * - OSRM geocode + rota çekimi
 * - BACS engine ile fiyatlama
 * - RouteMap + ResultPanel render
 */

import { useEffect, useMemo, useState } from 'react';
import { computeQuote } from '../lib/price-engine';
import { resolveRoute } from '../lib/distance-service';
import { VEHICLE_BRIDGE_CLASS, BRIDGE_ROUTE_COLORS } from '../lib/bridge-data';
import type { QuoteResponse, VehicleId } from '../lib/types';
import type { RouteOverlay } from './RouteMap';
import { RouteMap } from './RouteMap';
import { ResultPanel } from './ResultPanel';

type Status = 'idle' | 'loading' | 'success' | 'error';

const VEHICLES: VehicleId[] = [
  'Minivan',
  'Panelvan 3,5-5t',
  'Panelvan 5-7,5t',
  'Panelvan 5-7,5t Kamyon',
  'Kamyon 7,5-12t',
  'Onteker 10-15t',
  'Kırkayak 15-20t',
  'TIR 22-26t',
];

const VEHICLE_LABEL: Record<VehicleId, string> = {
  Minivan: 'Minivan (1. sınıf)',
  'Panelvan 3,5-5t': 'Küçük Panelvan 3,5–5T (2. sınıf)',
  'Panelvan 5-7,5t': 'Büyük Panelvan 5–7,5T · Kamyonet (2. sınıf)',
  'Panelvan 5-7,5t Kamyon': 'Büyük Panelvan 5–7,5T · Kamyon (3. sınıf)',
  'Kamyon 7,5-12t': 'Ağır Ticari 7,5–12T (3. sınıf)',
  'Onteker 10-15t': 'Onteker 6x2 · 10–15T (3. sınıf)',
  'Kırkayak 15-20t': 'Kırkayak 8x4 · 15–20T (4. sınıf)',
  'TIR 22-26t': 'TIR 22–26T (5. sınıf)',
};

interface CalculationResult {
  quote: QuoteResponse;
  distanceKm: number;
  routeOverlay: RouteOverlay;
}

export function Calculator() {
  const [fromText, setFromText] = useState('Mahmutbey, İstanbul');
  const [toText, setToText] = useState('Bursa');
  const [vehicle, setVehicle] = useState<VehicleId>('TIR 22-26t');
  const [fuelPrice, setFuelPrice] = useState(78.6);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);

  // Vehicle bridge class — UI badge için
  const bridgeClass = useMemo(() => VEHICLE_BRIDGE_CLASS[vehicle], [vehicle]);
  const accentColor = BRIDGE_ROUTE_COLORS[bridgeClass];

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg(null);
    setResult(null);

    if (!fromText.trim() || !toText.trim()) {
      setErrorMsg('Kalkış ve varış zorunlu.');
      setStatus('error');
      return;
    }

    try {
      // 1. Engine waypoints — köprü zinciri
      const preliminaryQuote = computeQuote({
        fromText,
        toText,
        km: 1, // geçici, mesafe sonra güncellenecek
        vehicle,
        fuelPrice,
      });
      const waypoints = preliminaryQuote.analysis.waypoints;

      // 2. OSRM routing — gerçek mesafe + polyline
      const routed = await resolveRoute(
        fromText,
        toText,
        waypoints.map((w) => w.location)
      );

      if (!routed) {
        setErrorMsg(
          'Adres çözümlenemedi veya rota bulunamadı. Spesifik bir adres dene (örn. "Bakırköy, İstanbul" veya "Konak, İzmir").'
        );
        setStatus('error');
        return;
      }

      // 3. Engine fiyat hesabı — gerçek km ile
      const finalQuote = computeQuote({
        fromText,
        toText,
        km: routed.route.distanceKm,
        vehicle,
        fuelPrice,
      });

      // 4. Map overlay
      const overlay: RouteOverlay = {
        geometry: routed.route,
        label: `${VEHICLE_LABEL[vehicle]} · ${bridgeClass.toUpperCase()} rotası`,
        color: accentColor,
        waypoints: finalQuote.analysis.waypoints,
      };

      setResult({
        quote: finalQuote,
        distanceKm: routed.route.distanceKm,
        routeOverlay: overlay,
      });
      setStatus('success');
    } catch (err) {
      console.error('[calculate]', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Beklenmedik bir hata oluştu. Tekrar dene.'
      );
      setStatus('error');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* ───── Sol: Form ───── */}
      <form
        onSubmit={handleCalculate}
        className="space-y-5 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-6"
      >
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            01 · Rota
          </div>
          <div className="mt-3 space-y-3">
            <Field label="Kalkış" htmlFor="from">
              <input
                id="from"
                type="text"
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
                placeholder="örn. Bakırköy, İstanbul"
                className="bacs-input"
                required
              />
            </Field>
            <Field label="Varış" htmlFor="to">
              <input
                id="to"
                type="text"
                value={toText}
                onChange={(e) => setToText(e.target.value)}
                placeholder="örn. Bursa"
                className="bacs-input"
                required
              />
            </Field>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            02 · Araç
          </div>
          <div className="mt-3 space-y-3">
            <Field label="Araç tipi" htmlFor="vehicle">
              <select
                id="vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value as VehicleId)}
                className="bacs-input"
              >
                {VEHICLES.map((v) => (
                  <option key={v} value={v}>
                    {VEHICLE_LABEL[v]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex items-center gap-2 rounded-md border border-[var(--color-border-default)] px-3 py-2 text-xs">
              <span className="text-[var(--color-text-muted)]">
                Zorunlu Boğaz köprüsü:
              </span>
              <span
                className="rounded px-2 py-0.5 font-mono font-semibold"
                style={{
                  background: `${accentColor}22`,
                  color: accentColor,
                  border: `1px solid ${accentColor}55`,
                }}
              >
                {bridgeClass.toUpperCase()}
              </span>
              <span className="text-[var(--color-text-muted)]">
                {bridgeClass === 'fsm'
                  ? '· 1.-2. sınıf hafif vasıtalar'
                  : '· 3.-5. sınıf ağır vasıtalar (FSM yasak)'}
              </span>
            </div>

            <Field label="Akaryakıt fiyatı (₺/L)" htmlFor="fuel">
              <input
                id="fuel"
                type="number"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(Number(e.target.value))}
                step="0.01"
                min="0"
                className="bacs-input font-mono"
              />
            </Field>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-md bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
        >
          {status === 'loading' ? 'Hesaplanıyor…' : 'Rotayı çöz, fiyatı hesapla'}
        </button>

        {errorMsg && (
          <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {errorMsg}
          </div>
        )}

        <div className="border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-muted)]">
          Saf TypeScript engine · OSRM (OpenStreetMap) routing · KGM 2026
          tarifeleri. Profesyonel kullanım için gerçek-zamanlı operasyon
          verisiyle entegre çalıştırılır.
        </div>
      </form>

      {/* ───── Sağ: Sonuç ───── */}
      <div className="space-y-4">
        <RouteMap
          routes={result ? [result.routeOverlay] : []}
          autoFit
        />

        {result && (
          <ResultPanel quote={result.quote} distanceKm={result.distanceKm} />
        )}

        {!result && status !== 'loading' && (
          <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-8 text-center">
            <div className="text-sm text-[var(--color-text-secondary)]">
              Formu doldur ve hesapla → rota, köprü zinciri, fiyat bandı burada.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
