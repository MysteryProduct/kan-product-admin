import { redirect } from 'next/navigation';

/** Lots moved into the stock menu (M2); old links land on the same work. */
export default function StoreLotsRedirect() {
  redirect('/admin/stock?type=product&tab=lots');
}
