"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LoadErrorBanner, { loadErrorText } from "@/components/LoadErrorBanner";
import { unavailableText } from "@/components/dashboard/blockLabels";
import type { OpenList } from "@/components/dashboard/DashboardListModal";
import CategoryModel from "@/models/category";
import DashboardModel from "@/models/dashboard";
import type { Category } from "@/types/category";
import type {
  StockFilter,
  StockOverview as StockOverviewData,
  StockStatusFilter,
} from "@/types/dashboard";
import CustomSelect from '@/components/CustomSelect';

const dashboardModel = new DashboardModel();
const categoryModel = new CategoryModel();

const count = (value: number) => new Intl.NumberFormat("th-TH").format(value);

// A typed search waits this long before it asks the server, so one request is not sent per key.
const SEARCH_DELAY_MS = 300;

const SEGMENTS = [
  { key: "normal", label: "ปกติ", tone: "success" },
  { key: "low", label: "เหลือน้อย", tone: "brand" },
  { key: "out", label: "หมด", tone: "danger" },
] as const;

interface StockOverviewProps {
  /** Bumped by the page when a record was changed from a detail view, so the numbers are read again. */
  reloadToken: number;
  onOpen: (list: OpenList) => void;
  /** Where the overview stands, so the page can leave out what it repeats and bring it back if the read failed. */
  onState: (state: "loading" | "shown" | "failed") => void;
}

/**
 * Stock of product variants by the remaining quantity of all lots (TASK-0161): one bar of how many
 * variants are normal, low or out, with the numbers written beside it. The card and the list opened
 * from it ask the server with the same category / search, so their totals are the same. A failed
 * read says so; it is never drawn as 0.
 */
export default function StockOverview({ reloadToken, onOpen, onState }: StockOverviewProps) {
  const [categoryId, setCategoryId] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [overview, setOverview] = useState<StockOverviewData | null>(null);
  // The server said the block is not this person's to see (no `view` on products).
  const [notAllowed, setNotAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Only the newest request may fill the card: a slow answer for an old filter must not
  // overwrite the one asked for after it.
  const latestRequest = useRef(0);

  const filter: StockFilter = {
    ...(categoryId ? { category_id: Number(categoryId) } : {}),
    ...(search ? { q: search } : {}),
  };

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setIsLoading(true);
    try {
      const result = await dashboardModel.getStockOverview({
        ...(categoryId ? { category_id: Number(categoryId) } : {}),
        ...(search ? { q: search } : {}),
      });
      if (request !== latestRequest.current) return;
      if (result.stock_overview) {
        setOverview(result.stock_overview);
        setNotAllowed(false);
        setError(null);
      } else if (result.unavailable?.length) {
        // The block failed on the server. Numbers of another filter must not stay up as if they
        // were this one's, and none is drawn as 0: the bar goes and the retry stays.
        setOverview(null);
        setError(unavailableText(result.unavailable));
      } else {
        setOverview(null);
        setNotAllowed(true);
        setError(null);
      }
    } catch (loadFailure) {
      if (request !== latestRequest.current) return;
      setOverview(null);
      setError(loadErrorText("สต็อกสินค้า", loadFailure));
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [categoryId, search]);

  // Read again when the filter changes (the category at once, the search after a pause) or
  // when the page says a record changed.
  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  // "Not allowed" (the server hid the block) leaves nothing on screen, so the page keeps its own card.
  const state = overview ? "shown" : error || notAllowed ? "failed" : "loading";
  useEffect(() => {
    onState(state);
  }, [state, onState]);

  // This component is only drawn for a person with `view` on products, so the choices load at once
  // and stay available even when the first read of the numbers failed.
  useEffect(() => {
    let active = true;
    categoryModel
      .getAllCategories()
      .then((result) => {
        if (active) setCategories(result.data);
      })
      .catch((failure: unknown) => {
        // The category is only a way to narrow the numbers; the numbers themselves still load.
        if (active) setCategoriesError(loadErrorText("หมวดหมู่", failure));
      });
    return () => {
      active = false;
    };
  }, []);

  if (notAllowed) return null;

  const categoryName = categories.find((item) => String(item.category_id) === categoryId)?.category_name;
  // One title for every list: the list has its own status choice, so a title that named
  // the status would be wrong as soon as it is changed there.
  const open = (status: StockStatusFilter | undefined): OpenList => ({
    key: "stock_variants",
    title: "แบบสินค้าตามสต็อก",
    href: "/admin/products",
    stock: { filter, status, categoryName },
  });
  const filtered = Boolean(categoryId || search);
  const needsCare = overview ? overview.low + overview.out : 0;

  return (
    <section aria-labelledby="dashboard-stock-overview" className="ka-card ka-panel" aria-busy={isLoading || undefined}>
      <div className="ka-panel__head">
        <h2 id="dashboard-stock-overview" className="ka-card__title">สต็อกสินค้า</h2>
        {overview && (
          <button type="button" aria-haspopup="dialog" className="ka-todo__cap ka-kpi__open numeric" onClick={() => onOpen(open(undefined))}>
            {count(overview.variants)} แบบ
          </button>
        )}
      </div>

      <LoadErrorBanner message={error} onRetry={() => void load()} />
      {!overview && !error && isLoading && <span className="ka-skel ka-skel--title" />}

      {overview && (
        <div className={`ka-motion-state grid gap-2 ${isLoading ? "opacity-60" : ""}`}>
          <div
            className="ka-stack"
            role="img"
            aria-label={SEGMENTS.map((segment) => `${segment.label} ${count(overview[segment.key])}`).join(" ")}
          >
            {overview.variants > 0 &&
              SEGMENTS.map((segment) =>
                overview[segment.key] > 0 ? (
                  <span key={segment.key} data-tone={segment.tone} style={{ flexGrow: overview[segment.key] }} />
                ) : null,
              )}
          </div>
          <ul className="ka-legend">
            {SEGMENTS.map((segment) => (
              <li key={segment.key} data-tone={segment.tone}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`${segment.label} ${count(overview[segment.key])} แบบ ดูรายการ`}
                  onClick={() => onOpen(open(segment.key))}
                >
                  <i aria-hidden="true" />
                  {segment.label} <span className="numeric">{count(overview[segment.key])}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="ka-panel__note">
            {overview.threshold === 0 ? "ปิดสถานะเหลือน้อย (เกณฑ์ 0)" : `เหลือน้อย = คงเหลือ 1–${count(overview.threshold)} ชิ้น`} · นับตามแบบสินค้า
            (สี/ขนาด) รวมทุกล็อต
          </p>
          {overview.variants === 0 && !isLoading && (
            <p className="ka-panel__note">{filtered ? "ไม่พบแบบสินค้าตามหมวดหมู่หรือคำค้นที่เลือก" : "ยังไม่มีแบบสินค้าในระบบ"}</p>
          )}
          {needsCare > 0 && (
            <button type="button" aria-haspopup="dialog" className="ka-panel__link ka-kpi__open" onClick={() => onOpen(open("problem"))}>
              ดู {count(needsCare)} แบบที่ต้องดูแล →
            </button>
          )}
        </div>
      )}

      <details className="ka-panel__more">
        <summary className="ka-todo__cap">กรองตามหมวดหมู่หรือชื่อสินค้า{filtered ? " (กำลังกรอง)" : ""}</summary>
        <div className="mt-2 grid gap-2">
          <label htmlFor="stock-category" className="ka-field">
            <span className="ka-label">หมวดหมู่</span>
            <CustomSelect
              id="stock-category"
              value={categoryId}
              onChange={(value) => setCategoryId(value)}
              options={[
                { value: "", label: 'ทุกหมวดหมู่' },
                ...categories.map((item) => ({ value: item.category_id, label: item.category_name })),
              ]}
            />
          </label>
          <label htmlFor="stock-search" className="ka-field">
            <span className="ka-label">ค้นหารหัสหรือชื่อสินค้า</span>
            <input
              id="stock-search"
              type="search"
              className="ka-input"
              maxLength={100}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="เช่น PD-… หรือชื่อสินค้า"
            />
          </label>
          {categoriesError && (
            <p role="status" className="ka-panel__note">
              {categoriesError} (ยังกรองด้วยการค้นหาได้)
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
