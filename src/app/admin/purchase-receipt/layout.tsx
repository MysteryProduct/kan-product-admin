import '../purchase-orders/purchase-orders.css';
import './purchase-receipt.css';

/**
 * Loads the receipt pages' stylesheets for the list, receive and detail routes. They share the
 * purchase-order pages' layout parts (header, cards, tables, two-column grid, print) and add their own.
 */
export default function PurchaseReceiptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
