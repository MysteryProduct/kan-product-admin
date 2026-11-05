-- TASK-0346 V1: the cases the capture needs, tagged so a rerun replaces them. Development database only.
BEGIN;
DELETE FROM payment_receipts WHERE sale_order_id IN (SELECT sale_order_id FROM sale_order WHERE sale_order_name LIKE 'ทดสอบ TASK-0346%');
DELETE FROM sale_order WHERE sale_order_name LIKE 'ทดสอบ TASK-0346%';

DO $$
DECLARE
  account uuid := (SELECT account_id FROM bank_account LIMIT 1);
  who uuid := (SELECT employee_id FROM employee WHERE employee_username = 'demo_audit');
  full_license uuid := (SELECT license_id FROM employee WHERE employee_username = 'demo_audit');
  view_license uuid;
BEGIN
  INSERT INTO sale_order (sale_order_id, sale_order_code, shipping_address_name, sale_order_name, sale_order_type, sale_order_status, vat_type, vat_rate, sale_order_vat_amount, sale_order_subtotal, sale_order_total, create_by, create_date)
  SELECT gen_random_uuid(), code, customer, 'ทดสอบ TASK-0346 ' || label, kind, state, 'none', 0, 0, amount, amount, who, now() - (age || ' days')::interval
  FROM (VALUES
    ('SO209911030001', 'ร้านกาแฟบ้านสวน', 'approved ไม่มีใบเสร็จ', 'order', 'approved', 18400, 40),
    ('SO209911030002', 'คุณมานพ ศรีสุข', 'partial มัดจำ', 'order', 'partial', 36000, 39),
    ('SO209911030003', 'ร้านดอกไม้ริมทาง', 'paid', 'order', 'paid', 7450, 38),
    ('SO209911030004', 'คุณวรรณา แก้วมณี', 'ยกเลิกภายหลัง', 'order', 'cancelled', 6000, 37),
    ('SO209911030005', 'บริษัท สยามเทรดดิ้ง จำกัด', 'สองใบเสร็จ', 'order', 'partial', 85500, 36),
    ('SO209911030006', 'คุณพิมพ์ชนก ทองดี', 'ยกเลิกเอง', 'order', 'cancelled', 1200, 35),
    ('SO209911030007', 'ร้านกาแฟบ้านสวน', 'ลบใบเสร็จ', 'order', 'partial', 36000, 34),
    ('SO209911030008', 'ร้านกาแฟบ้านสวน', 'แก้ไขใบ deposit', 'order', 'partial', 36000, 33),
    ('SO209911030009', 'คุณมานพ ศรีสุข', 'ฟอร์มตรวจยอด', 'order', 'approved', 1000, 32),
    ('SO209911030010', 'คุณมานพ ศรีสุข', 'pending', 'order', 'pending', 500, 31),
    ('SO209911030011', 'ร้านดอกไม้ริมทาง', 'ใบ full ยอดไม่เท่าใบ', 'order', 'partial', 1000, 30),
    ('SO209911030012', 'ร้านดอกไม้ริมทาง', 'โอนเป็นเงินสด', 'order', 'partial', 2000, 29)
  ) AS seed(code, customer, label, kind, state, amount, age);

  INSERT INTO payment_receipts (payment_receipt_id, sale_order_id, payment_receipt_code, payment_receipt_type, payment_method, amount_paid, payment_date, payment_status, payment_receipt_remark, account_id, create_by, create_date)
  SELECT gen_random_uuid(), so.sale_order_id, code, kind, method, amount, now() - (age || ' days')::interval, 'paid', remark, CASE WHEN method = 'bank' THEN account END, who, now()
  FROM (VALUES
    ('RE209911030001', 'SO209911030002', 'deposit', 'bank', 10800, 2, 'โอนเข้า 10:42 น. อ้างอิง 6110-2283'),
    ('RE209911030002', 'SO209911030003', 'full', 'bank', 7450, 3, ''),
    ('RE209911030003', 'SO209911030004', 'partial', 'cash', 3000, 4, ''),
    ('RE209911030004', 'SO209911030005', 'deposit', 'bank', 20000, 6, ''),
    ('RE209911030005', 'SO209911030005', 'partial', 'cash', 22750, 5, ''),
    ('RE209911030006', 'SO209911030007', 'deposit', 'bank', 10800, 1, ''),
    ('RE209911030007', 'SO209911030008', 'deposit', 'bank', 10800, 1, ''),
    ('RE209911030008', 'SO209911030011', 'full', 'cash', 600, 1, ''),
    ('RE209911030009', 'SO209911030012', 'partial', 'bank', 500, 1, '')
  ) AS seed(code, order_code, kind, method, amount, age, remark)
  JOIN sale_order so ON so.sale_order_code = seed.order_code;

  -- Orders past the first twenty options of the picker (A9): the newest is SO209911030150.
  INSERT INTO sale_order (sale_order_id, sale_order_code, shipping_address_name, sale_order_name, sale_order_type, sale_order_status, vat_type, vat_rate, sale_order_vat_amount, sale_order_subtotal, sale_order_total, create_by, create_date)
  SELECT gen_random_uuid(), 'SO2099110301' || lpad(n::text, 2, '0'), 'ลูกค้าทดสอบ', 'ทดสอบ TASK-0346 เติม ' || n, 'order', 'approved', 'none', 0, 0, 100, 100, who, now() - (n || ' seconds')::interval * -1
  FROM generate_series(21, 50) AS n;

  -- A view-only employee: every menu the full license has, with view alone. Signs in with the demo_audit password.
  SELECT license_id INTO view_license FROM employee_license WHERE license_name = 'TASK-0346 view only';
  IF view_license IS NULL THEN
    view_license := gen_random_uuid();
    INSERT INTO employee_license (license_id, license_name) VALUES (view_license, 'TASK-0346 view only');
    INSERT INTO employee_permission (permission_id, license_id, menu_id, permission_view, permission_add, permission_edit, permission_delete, permission_approve, permission_reject)
    SELECT gen_random_uuid(), view_license, menu_id, true, false, false, false, false, false FROM employee_permission WHERE license_id = full_license;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM employee WHERE employee_username = 'demo_view_0346') THEN
    INSERT INTO employee (employee_id, employee_username, employee_password, employee_firstname, employee_lastname, employee_address, employee_phone, employee_email, license_id)
    SELECT gen_random_uuid(), 'demo_view_0346', employee_password, 'View', 'Only', 'Development only', '0000000000', 'demo_view_0346@local.test', view_license FROM employee WHERE employee_id = who;
  END IF;
END $$;
COMMIT;
SELECT count(*) AS orders FROM sale_order WHERE sale_order_name LIKE 'ทดสอบ TASK-0346%';
SELECT count(*) AS receipts FROM payment_receipts WHERE payment_receipt_code LIKE 'RE2099%';

-- A receipts-only employee: view of everything but the sale orders menu (G6).
DO $$
DECLARE
  who uuid := (SELECT employee_id FROM employee WHERE employee_username = 'demo_audit');
  view_license uuid := (SELECT license_id FROM employee WHERE employee_username = 'demo_view_0346');
  no_orders uuid;
BEGIN
  SELECT license_id INTO no_orders FROM employee_license WHERE license_name = 'TASK-0346 no sale orders';
  IF no_orders IS NULL THEN
    no_orders := gen_random_uuid();
    INSERT INTO employee_license (license_id, license_name) VALUES (no_orders, 'TASK-0346 no sale orders');
    INSERT INTO employee_permission (permission_id, license_id, menu_id, permission_view, permission_add, permission_edit, permission_delete, permission_approve, permission_reject)
    SELECT gen_random_uuid(), no_orders, p.menu_id, true, false, false, false, false, false
    FROM employee_permission p JOIN employee_menu m USING (menu_id)
    WHERE p.license_id = view_license AND m.menu_url NOT LIKE '%sale-orders%';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM employee WHERE employee_username = 'demo_noso_0346') THEN
    INSERT INTO employee (employee_id, employee_username, employee_password, employee_firstname, employee_lastname, employee_address, employee_phone, employee_email, license_id)
    SELECT gen_random_uuid(), 'demo_noso_0346', employee_password, 'No', 'Orders', 'Development only', '0000000000', 'demo_noso_0346@local.test', no_orders FROM employee WHERE employee_id = who;
  END IF;
END $$;
SELECT count(*) AS menus_kept FROM employee_permission p JOIN employee_license l USING (license_id) WHERE l.license_name = 'TASK-0346 no sale orders';
