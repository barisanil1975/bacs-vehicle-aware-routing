/**
 * BACS Labs · Result Panel
 *
 * Hesap sonucu kartları. Single mode'da 3 kart, mixed mode'da iki sütun.
 */

import type { QuoteResponse } from '../lib/types';
import { formatTL } from '../lib/price-engine';
import { bridgeShortName } from '../lib/bridge-data';

interface ResultPanelProps {
  quote: QuoteResponse;
  distanceKm: number;
}

export function ResultPanel({ quote, distanceKm }: ResultPanelProps) {
  const { analysis, price } = quote;
  const { profile } = analysis;

  return (
    <div className="space-y-4">
      {/* Mesafe + profil */}
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
              Mesafe
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold text-[var(--color-text-primary)]">
              {distanceKm.toFixed(1)} km
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
              Köprü zinciri
            </div>
            <div className="mt-1 flex flex-wrap justify-end gap-1.5">
              {analysis.bridges.length === 0 ? (
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Yok
                </span>
              ) : (
                analysis.bridges.map((b) => (
                  <span
                    key={b}
                    className="rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]"
                  >
                    {bridgeShortName(b)}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
        {profile.reason && (
          <div className="mt-3 border-t border-[var(--color-border-default)] pt-3 text-sm italic text-[var(--color-text-secondary)]">
            {profile.reason}
          </div>
        )}
      </div>

      {/* 3-kart sayısal sonuçlar */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card
          eyebrow="Akaryakıt"
          value={formatTL(price.fuelCost)}
          sub={`${(price.fuelCost / distanceKm).toFixed(2)} ₺/km`}
        />
        <Card
          eyebrow="KGM + Köprü"
          value={formatTL(price.hgsCost)}
          sub={`${distanceKm > 0 ? (price.hgsCost / distanceKm).toFixed(2) : '0.00'} ₺/km`}
        />
        <Card
          eyebrow="Fiyat aralığı"
          value={`${formatTL(price.lower)} – ${formatTL(price.upper)}`}
          sub={`Önerilen müzakere bandı`}
          highlight
        />
      </div>

      {/* Açıklama */}
      <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-4">
        <div className="mb-2 text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
          Hesap mantığı
        </div>
        <ul className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
          <li>
            <span className="text-[var(--color-text-primary)]">Akaryakıt-bazlı ipucu:</span>{' '}
            {formatTL(price.akaryakitQuote)} (fuelShare ile geri çözüm)
          </li>
          <li>
            <span className="text-[var(--color-text-primary)]">Eskalasyon-bazlı ipucu:</span>{' '}
            {formatTL(price.escalasyonQuote)} (km × ₺/km, minFloor)
          </li>
          <li>
            <span className="text-[var(--color-text-primary)]">Aralık formülü:</span>{' '}
            alt = (akaryakıt × 0.40) + (eskalasyon × 0.60), aşağı 500 yuvarla. Üst aynısı 0.45/0.55.
          </li>
        </ul>
      </div>
    </div>
  );
}

interface CardProps {
  eyebrow: string;
  value: string;
  sub: string;
  highlight?: boolean;
}

function Card({ eyebrow, value, sub, highlight }: CardProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
          : 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]'
      }`}
    >
      <div className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
        {eyebrow}
      </div>
      <div
        className={`mt-2 font-mono text-xl font-semibold ${
          highlight ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{sub}</div>
    </div>
  );
}
