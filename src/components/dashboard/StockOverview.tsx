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

const dashboardModel = new DashboardModel();
const categoryModel = new CategoryModel();

const count = (value: number) => new Intl.NumberFormat("th-TH").format(value);

// A typed search waits this long before it asks the server, so one request is not sent per key.
const SEARCH_DELAY_MS = 300;

type Tone = "neutral" | "success" | "warning" | "danger";

const TONE_VALUE: Record<Tone, string> = {
  neutral: "text-[var(--ink)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
};

interface StatCardProps {
  label: string;
  value: number | undefined;
  unit: string;
  hint: string;
  tone?: Tone;
  /** Present for a card whose rows can be opened; a card without it is not a button. */
  onOpen?: () => void;
}

function StatCard({ label, value, unit, hint, tone = "neutral", onOpen }: StatCardProps) {
  const body = (
    <>
      <span className="ka-stat__label">{label}</span>
      <p className={`ka-stat__value ${TONE_VALUE[tone]}`}>
        {value === undefined ? "-" : count(value)}
        <span className="ml-2 text-[14px] font-normal text-[var(--ink-muted)]">{unit}</span>
      </p>
      <p className="ka-stat__foot">{hint}</p>
    </>
  );
  if (!onOpen) return <div className="ka-card ka-stat">{body}</div>;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className="ka-card ka-card--link ka-stat block w-full text-left"
    >
      {body}
    </button>
  );
}

interface StockOverviewProps {
  /** Bumped by the page when a record was changed from a detail view, so the numbers are read again. */
  reloadToken: number;
  onOpen: (list: OpenList) => void;
  /** Where the overview stands, so the page can leave out what it repeats and bring it back if the read failed. */
  onState: (state: "loading" | "shown" | "failed") => void;
}

/**
 * Stock of product variants by the remaining quantity of all lots (TASK-0161): the number of
 * products apart from the number of variants, and how many variants are out, low or normal.
 * The card and the list opened from it ask the server with the same category / search, so
 * their totals are the same. A failed read says so; it is never drawn as 0.
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

  // Only the newest request may fill the cards: a slow answer for an old filter must not
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
        // were this one's, and none is drawn as 0: the cards go and the retry stays.
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
  // One title for every card: the list has its own status choice, so a title that named
  // the status would be wrong as soon as it is changed there.
  const open = (status: StockStatusFilter | undefined): OpenList => ({
    key: "stock_variants",
    title: "แบบสินค้าตามสต็อก",
    href: "/admin/products",
    stock: { filter, status, categoryName },
  });
  const filtered = Boolean(categoryId || search);

  return (
    <section aria-labelledby="dashboard-stock-overview" className="mb-6">
      <h2 id="dashboard-stock-overview" className="mb-1 text-[19px] font-semibold text-[var(--ink)]">
        สต็อกสินค้า
      </h2>
      <p className="mb-3 text-[13px] text-[var(--ink-muted)]">
        นับตามแบบสินค้า (สี/ขนาด) จากจำนวนคงเหลือรวมทุกล็อต ไม่ใช่จำนวนที่ลูกค้าซื้อออนไลน์ได้
        {overview ? ` · เหลือน้อย = เหลือ 1–${count(overview.threshold)} ชิ้น` : ""}
        {overview && overview.threshold === 0 ? " (ปิดสถานะเหลือน้อย)" : ""}
      </p>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl">
        <div>
          <label htmlFor="stock-category" className="mb-1 block text-[13px] font-medium text-[var(--ink)]">
            หมวดหมู่
          </label>
          <select
            id="stock-category"
            className="ka-input"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((item) => (
              <option key={item.category_id} value={item.category_id}>
                {item.category_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stock-search" className="mb-1 block text-[13px] font-medium text-[var(--ink)]">
            ค้นหารหัสหรือชื่อสินค้า
          </label>
          <input
            id="stock-search"
            type="search"
            className="ka-input"
            maxLength={100}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="เช่น PD-… หรือชื่อสินค้า"
          />
        </div>
      </div>
      {categoriesError && (
        <p role="status" className="mb-3 text-[13px] text-[var(--ink-muted)]">
          {categoriesError} (ยังกรองด้วยการค้นหาได้)
        </p>
      )}

      <LoadErrorBanner message={error} onRetry={() => void load()} className="mb-3" />

      {!overview && !error && isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-busy="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="ka-card ka-stat">
              <div className="ka-skel ka-skel--title" />
              <div className="ka-skel mt-3 h-9 w-2/3" />
              <p className="sr-only">กำลังโหลด...</p>
            </div>
          ))}
        </div>
      )}

      {overview && (
        <div
          aria-busy={isLoading}
          className={`ka-motion-state grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 ${
            isLoading ? "opacity-60" : ""
          }`}
        >
          <StatCard
            label="สินค้า (Product)"
            value={overview.products}
            unit="สินค้า"
            hint={`มีแบบที่ต้องดูแล ${count(overview.products_with_issue)} สินค้า`}
          />
          <StatCard
            label="แบบสินค้า (Variant)"
            value={overview.variants}
            unit="แบบ"
            hint="นับแต่ละสี/ขนาด หนึ่งครั้ง ไม่ซ้ำตามล็อต"
            onOpen={() => onOpen(open(undefined))}
          />
          <StatCard
            label="ปกติ"
            value={overview.normal}
            unit="แบบ"
            tone="success"
            hint={`คงเหลือมากกว่า ${count(overview.threshold)} ชิ้น`}
            onOpen={() => onOpen(open("normal"))}
          />
          <StatCard
            label="เหลือน้อย"
            value={overview.low}
            unit="แบบ"
            tone="warning"
            hint={overview.threshold === 0 ? "ปิดสถานะเหลือน้อย (เกณฑ์ 0)" : `เหลือ 1–${count(overview.threshold)} ชิ้น`}
            onOpen={() => onOpen(open("low"))}
          />
          <StatCard
            label="หมด"
            value={overview.out}
            unit="แบบ"
            tone="danger"
            hint="คงเหลือ 0 หรือน้อยกว่า รวมที่ไม่เคยมีสต็อก"
            onOpen={() => onOpen(open("out"))}
          />
        </div>
      )}

      {overview && overview.variants === 0 && !isLoading && (
        <p className="mt-3 text-[14px] text-[var(--ink-muted)]">
          {filtered ? "ไม่พบแบบสินค้าตามหมวดหมู่หรือคำค้นที่เลือก" : "ยังไม่มีแบบสินค้าในระบบ"}
        </p>
      )}
    </section>
  );
}
