import { useEffect, useState } from 'react';
import SettingsModel from '@/models/settings';
import { DEFAULT_VAT_RATE_PERCENT } from '@/lib/vat';

const settingsModel = new SettingsModel();

export default function useVatRate(initialVatRate: number = DEFAULT_VAT_RATE_PERCENT): number {
  const [vatRate, setVatRate] = useState<number>(initialVatRate);

  useEffect(() => {
    let isMounted = true;

    const loadVatRate = async () => {
      try {
        const settings = await settingsModel.getSettings();
        const parsedVatRate = Number(settings?.vat_rate);
        const nextVatRate = Number.isFinite(parsedVatRate)
          ? parsedVatRate
          : DEFAULT_VAT_RATE_PERCENT;
        
        if (isMounted) {
          setVatRate(nextVatRate);
        }
      } catch {
        // Keep fallback VAT rate when settings API is unavailable.
      }
    };

    void loadVatRate();

    return () => {
      isMounted = false;
    };
  }, []);

  return vatRate;
}
