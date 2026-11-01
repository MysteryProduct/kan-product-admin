'use client';

import { useEffect, useState } from 'react';
import { ProductUnitModel } from '@/models/product-unit';
import type { UnitNames } from '../lib/pr-display';

const productUnitModel = new ProductUnitModel();
const EMPTY: UnitNames = new Map();

/**
 * Unit names by id, loaded once. The order queue and the receipt list carry only `product_unit_id`;
 * until the names arrive (or if they cannot load) quantities read "หน่วย".
 */
export function useUnitNames(): UnitNames {
  const [names, setNames] = useState<UnitNames>(EMPTY);
  useEffect(() => {
    let active = true;
    productUnitModel
      .getAllProductUnits()
      .then((response) => {
        if (active) setNames(new Map(response.data.map((unit) => [Number(unit.product_unit_id), unit.product_unit_name])));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return names;
}
