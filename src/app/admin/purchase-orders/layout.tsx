import './purchase-orders.css';
import { PathMemory } from './lib/previous-path';

/** Loads the purchase-order pages' stylesheet for the list, detail and form routes. */
export default function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PathMemory />
      {children}
    </>
  );
}
