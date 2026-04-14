-- ============================================================
-- MIGRATION SCRIPT v1.1 — TransportApp
-- Запустить в Supabase → SQL Editor
-- ============================================================

-- ─── 1. TRIPS: добавить поле оплаты (Нал/Безнал) ──────────
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'noncash'
  CHECK (payment_method IN ('cash', 'noncash'));

-- ─── 2. EXPENSES: расширить типы расходов ──────────────────
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_exp_type_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_exp_type_check
  CHECK (exp_type IN (
    'fuel_card',    -- Пополнение топливной карты
    'fuel',         -- Топливо по карте
    'repair',       -- Ремонт / Шиномонтаж
    'parts',        -- Запчасти / Шины
    'maintenance',  -- ТО и сервис
    'platon',       -- Платон
    'wash',         -- Мойка
    'toll',         -- Платные дороги
    'fine',         -- Штрафы
    'lease',        -- Аренда / Лизинг
    'bank_fee',     -- Банковские комиссии
    'other',        -- Прочие расходы
    'salary_other', -- Зарплата (не водитель)
    'dividend'      -- Дивиденды
  ));

-- Мигрируем старые данные: 'fuel' остаётся 'fuel', 'other' остаётся 'other' — OK

-- ─── 3. PROFILES: расширить роли ───────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'owner',              -- Учредитель (полный доступ)
    'driver',             -- Водитель
    'accountant',         -- Бухгалтер (финансы + платежи)
    'chief_accountant',   -- Главный бухгалтер (+ настройки налогов)
    'finance_director'    -- Финансовый директор (полная аналитика)
  ));

-- ─── 4. COMPANY SETTINGS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name  text        NOT NULL DEFAULT 'Моя компания',
  inn           text,
  kpp           text,
  ogrn          text,
  tax_regime    text        NOT NULL DEFAULT 'usn_15'
                            CHECK (tax_regime IN ('osn', 'usn_6', 'usn_15', 'patent')),
  usn_rate      numeric     DEFAULT 15,    -- % для УСН (6 или 15)
  vat_rate      numeric     DEFAULT 20,    -- Ставка НДС
  has_vat       boolean     DEFAULT false, -- Плательщик НДС
  social_rate   numeric     DEFAULT 30.2,  -- Страховые взносы с ФОТ
  -- Банковские реквизиты
  bank_name     text,
  bik           text,
  account       text,
  corr_account  text,
  -- Контактная информация
  legal_address text,
  actual_address text,
  director_name text,
  accountant_name text,
  phone         text,
  email         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_manage_settings" ON company_settings;
CREATE POLICY "auth_manage_settings" ON company_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Вставить дефолтные настройки, если таблица пустая
INSERT INTO company_settings (company_name, tax_regime)
SELECT 'Моя компания', 'usn_15'
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- ─── 5. TAX PAYMENTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_payments (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_date   date    NOT NULL DEFAULT CURRENT_DATE,
  tax_type       text    NOT NULL
                         CHECK (tax_type IN (
                           'usn', 'vat', 'social',
                           'income_tax', 'property', 'other'
                         )),
  period_year    int     NOT NULL,
  period_quarter int     CHECK (period_quarter BETWEEN 1 AND 4),
  period_month   int     CHECK (period_month BETWEEN 1 AND 12),
  amount         numeric NOT NULL CHECK (amount > 0),
  comment        text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE tax_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_manage_tax_payments" ON tax_payments;
CREATE POLICY "auth_manage_tax_payments" ON tax_payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 6. ФУНКЦИЯ: финансовая сводка за период ───────────────
CREATE OR REPLACE FUNCTION get_financial_summary(
  p_date_from date DEFAULT NULL,
  p_date_to   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_revenue        numeric := 0;
  v_cash           numeric := 0;
  v_noncash        numeric := 0;
  v_expenses       numeric := 0;
  v_salary         numeric := 0;
BEGIN
  -- Выручка из рейсов
  SELECT
    COALESCE(SUM(t.volume * o.company_rate), 0),
    COALESCE(SUM(CASE WHEN t.payment_method = 'cash'    THEN t.volume * o.company_rate ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN t.payment_method != 'cash'   THEN t.volume * o.company_rate ELSE 0 END), 0)
  INTO v_revenue, v_cash, v_noncash
  FROM trips t
  JOIN orders o ON t.order_id = o.id
  WHERE t.stage = 'unloading'
    AND (p_date_from IS NULL OR t.trip_date >= p_date_from)
    AND (p_date_to   IS NULL OR t.trip_date <= p_date_to);

  -- Расходы
  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM expenses
  WHERE (p_date_from IS NULL OR exp_date >= p_date_from)
    AND (p_date_to   IS NULL OR exp_date <= p_date_to);

  -- Зарплата (выплаты водителям)
  SELECT COALESCE(SUM(amount), 0) INTO v_salary
  FROM driver_payments
  WHERE (p_date_from IS NULL OR payment_date >= p_date_from)
    AND (p_date_to   IS NULL OR payment_date <= p_date_to);

  RETURN jsonb_build_object(
    'revenue',       v_revenue,
    'cash',          v_cash,
    'noncash',       v_noncash,
    'expenses',      v_expenses,
    'salary',        v_salary,
    'total_costs',   v_expenses + v_salary,
    'net_profit',    v_revenue - v_expenses - v_salary
  );
END;
$$;

-- ─── 7. ФУНКЦИЯ: помесячная разбивка за год ────────────────
CREATE OR REPLACE FUNCTION get_monthly_breakdown(
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result  jsonb := '[]'::jsonb;
  v_month   int;
  v_df      date;
  v_dt      date;
  v_rev     numeric; v_cash numeric; v_noncash numeric;
  v_exp     numeric; v_sal numeric;
  v_cats    jsonb;
BEGIN
  FOR v_month IN 1..12 LOOP
    v_df := make_date(p_year, v_month, 1);
    v_dt := (v_df + INTERVAL '1 month - 1 day')::date;

    SELECT COALESCE(SUM(t.volume * o.company_rate), 0),
           COALESCE(SUM(CASE WHEN t.payment_method='cash' THEN t.volume*o.company_rate ELSE 0 END),0),
           COALESCE(SUM(CASE WHEN t.payment_method!='cash' THEN t.volume*o.company_rate ELSE 0 END),0)
    INTO v_rev, v_cash, v_noncash
    FROM trips t JOIN orders o ON t.order_id = o.id
    WHERE t.stage = 'unloading'
      AND t.trip_date BETWEEN v_df AND v_dt;

    SELECT COALESCE(SUM(amount), 0) INTO v_exp
    FROM expenses WHERE exp_date BETWEEN v_df AND v_dt;

    SELECT COALESCE(SUM(amount), 0) INTO v_sal
    FROM driver_payments WHERE payment_date BETWEEN v_df AND v_dt;

    -- Расходы по категориям
    SELECT COALESCE(jsonb_object_agg(exp_type, total), '{}'::jsonb)
    INTO v_cats
    FROM (
      SELECT exp_type, SUM(amount) AS total
      FROM expenses WHERE exp_date BETWEEN v_df AND v_dt
      GROUP BY exp_type
    ) s;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'month',       v_month,
      'revenue',     v_rev,
      'cash',        v_cash,
      'noncash',     v_noncash,
      'expenses',    v_exp,
      'salary',      v_sal,
      'total_costs', v_exp + v_sal,
      'net_profit',  v_rev - v_exp - v_sal,
      'by_category', v_cats
    ));
  END LOOP;

  RETURN v_result;
END;
$$;

-- ─── 8. ФУНКЦИЯ: расчёт УСН ────────────────────────────────
CREATE OR REPLACE FUNCTION calc_usn_tax(
  p_date_from date,
  p_date_to   date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_regime   text;
  v_rate     numeric;
  v_revenue  numeric := 0;
  v_expenses numeric := 0;
  v_salary   numeric := 0;
  v_base     numeric;
  v_tax      numeric;
BEGIN
  SELECT tax_regime, usn_rate INTO v_regime, v_rate
  FROM company_settings LIMIT 1;

  SELECT COALESCE(SUM(t.volume * o.company_rate), 0) INTO v_revenue
  FROM trips t JOIN orders o ON t.order_id = o.id
  WHERE t.stage = 'unloading' AND t.trip_date BETWEEN p_date_from AND p_date_to;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM expenses WHERE exp_date BETWEEN p_date_from AND p_date_to;

  SELECT COALESCE(SUM(amount), 0) INTO v_salary
  FROM driver_payments WHERE payment_date BETWEEN p_date_from AND p_date_to;

  IF v_regime = 'usn_6' THEN
    v_base := v_revenue;
    v_tax  := v_base * COALESCE(v_rate, 6) / 100;
  ELSIF v_regime = 'usn_15' THEN
    v_base := GREATEST(v_revenue - v_expenses - v_salary, 0);
    v_tax  := GREATEST(v_base * COALESCE(v_rate, 15) / 100,
                       v_revenue * 0.01);  -- минимальный налог 1%
  ELSE
    v_base := 0; v_tax := 0;
  END IF;

  RETURN jsonb_build_object(
    'regime',   v_regime,
    'rate',     v_rate,
    'revenue',  v_revenue,
    'expenses', v_expenses + v_salary,
    'base',     v_base,
    'tax',      v_tax
  );
END;
$$;
