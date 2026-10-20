import { test } from "node:test";
import assert from "node:assert/strict";
import sourceLoader from "./load-source.mjs";

test("job detail model returns the raw entity supplied by GET /job-order/:id", async () => {
  const job = { job_order_id: "job-1", job_order_code: "JO202610170001" };
  const calls = [];
  const load = sourceLoader({
    "@/lib/axios": {
      get: async (url) => {
        calls.push(url);
        return { data: job };
      },
    },
  });
  const Model = load("src/models/job-order.ts").default;
  assert.equal(await new Model().getJobOrderById(job.job_order_id), job);
  assert.deepEqual(calls, ["/job-order/job-1"]);
});

test("each CU links to its own job and fulfillment record", () => {
  for (const suffix of ["1", "2"]) {
    const info = {
      code: `CU20261017000${suffix}`,
      status: "produced",
      depositRequired: 20,
      depositPaid: true,
      outstanding: 80,
      jobOrderId: `job-${suffix}`,
      storeOrderId: `order-${suffix}`,
    };
    let state = 0;
    const jsx = (type, props) => ({ type, props });
    const load = sourceLoader({
      react: {
        useEffect: () => {},
        useRef: (value) => ({ current: value }),
        useState: (value) => [state++ === 0 ? info : value, () => {}],
      },
      "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
      "next/link": "a",
      "@/lib/axios": {},
      "@/hooks/usePermissions": {
        usePermissions: () => ({ can: () => false }),
      },
    });
    const Component = load(
      "src/app/admin/sale-orders/components/custom-payment.tsx",
    ).default;
    const hrefs = [];
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (node.props?.href) hrefs.push(node.props.href);
      visit(node.props?.children);
    };
    visit(Component({ orderId: "so", status: "partial" }));
    assert.ok(hrefs.includes(`/admin/job-orders?jobId=job-${suffix}`));
    assert.ok(
      hrefs.includes(`/admin/store-fulfillment?orderId=order-${suffix}`),
    );
  }
});
