-- ============================================================
-- MIGRATION: Общий доступ для всех администраторов
-- Запустить в Supabase → SQL Editor
-- ============================================================
-- Цель: любой аккаунт с ролью НЕ 'driver' (owner/admin/accountant/
-- chief_accountant/finance_director) должен видеть ВСЕ данные
-- и иметь возможность создавать задачи, как первый учредитель.
-- Водители видят только свои записи.
-- ============================================================

-- ─── 1. Добавляем роль 'admin' в список разрешённых ролей ─
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'owner',
    'admin',
    'driver',
    'accountant',
    'chief_accountant',
    'finance_director'
  ));

-- ─── 2. Helper-функция: является ли текущий пользователь админом ─
-- (любая роль кроме 'driver' считается админом)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IS DISTINCT FROM 'driver'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'driver'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver() TO authenticated;

-- ─── 3. PROFILES: все админы видят всех пользователей ───────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"         ON profiles;
DROP POLICY IF EXISTS "profiles_select_self"        ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"         ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy"      ON profiles;
DROP POLICY IF EXISTS "profiles_admins_all"         ON profiles;
DROP POLICY IF EXISTS "profiles_read_all"           ON profiles;
DROP POLICY IF EXISTS "profiles_self_update"        ON profiles;

-- Все авторизованные видят всех (нужно для списков водителей, исполнителей)
CREATE POLICY "profiles_read_all" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Админы могут менять любой профиль (назначить номер машины и т.д.)
CREATE POLICY "profiles_admins_all" ON profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Пользователь может обновлять свой профиль (водитель ставит свой car_number)
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── 4. CUSTOMERS (справочник контрагентов) ─────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select_own"   ON customers;
DROP POLICY IF EXISTS "customers_insert_own"   ON customers;
DROP POLICY IF EXISTS "customers_update_own"   ON customers;
DROP POLICY IF EXISTS "customers_delete_own"   ON customers;
DROP POLICY IF EXISTS "customers_admin_all"    ON customers;
DROP POLICY IF EXISTS "auth_manage_customers"  ON customers;

CREATE POLICY "customers_admin_all" ON customers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 5. ORDERS (задачи) ─────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own"       ON orders;
DROP POLICY IF EXISTS "orders_insert_own"       ON orders;
DROP POLICY IF EXISTS "orders_update_own"       ON orders;
DROP POLICY IF EXISTS "orders_delete_own"       ON orders;
DROP POLICY IF EXISTS "orders_select_creator"   ON orders;
DROP POLICY IF EXISTS "orders_admin_all"        ON orders;
DROP POLICY IF EXISTS "orders_driver_select"    ON orders;
DROP POLICY IF EXISTS "auth_manage_orders"      ON orders;

-- Админы видят и управляют всеми задачами
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Водитель видит только свои активные задачи
CREATE POLICY "orders_driver_select" ON orders
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- ─── 6. TRIPS (рейсы) ───────────────────────────────────────
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trips_select_own"     ON trips;
DROP POLICY IF EXISTS "trips_insert_own"     ON trips;
DROP POLICY IF EXISTS "trips_update_own"     ON trips;
DROP POLICY IF EXISTS "trips_delete_own"     ON trips;
DROP POLICY IF EXISTS "trips_admin_all"      ON trips;
DROP POLICY IF EXISTS "trips_driver_select"  ON trips;
DROP POLICY IF EXISTS "trips_driver_insert"  ON trips;
DROP POLICY IF EXISTS "auth_manage_trips"    ON trips;

-- Админы видят все рейсы всех водителей
CREATE POLICY "trips_admin_all" ON trips
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Водитель видит и создаёт только свои рейсы
CREATE POLICY "trips_driver_select" ON trips
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "trips_driver_insert" ON trips
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

-- ─── 7. CUSTOMER_PAYMENTS (платежи от заказчиков) ──────────
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_payments_select_own" ON customer_payments;
DROP POLICY IF EXISTS "customer_payments_admin_all"  ON customer_payments;
DROP POLICY IF EXISTS "auth_manage_customer_payments" ON customer_payments;

CREATE POLICY "customer_payments_admin_all" ON customer_payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 8. DRIVER_PAYMENTS (зарплата водителям) ───────────────
ALTER TABLE driver_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_payments_select_own"   ON driver_payments;
DROP POLICY IF EXISTS "driver_payments_admin_all"    ON driver_payments;
DROP POLICY IF EXISTS "driver_payments_self_select"  ON driver_payments;
DROP POLICY IF EXISTS "auth_manage_driver_payments"  ON driver_payments;

CREATE POLICY "driver_payments_admin_all" ON driver_payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Водитель видит только свои выплаты
CREATE POLICY "driver_payments_self_select" ON driver_payments
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- ─── 9. EXPENSES (расходы) ─────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_own"   ON expenses;
DROP POLICY IF EXISTS "expenses_insert_own"   ON expenses;
DROP POLICY IF EXISTS "expenses_update_own"   ON expenses;
DROP POLICY IF EXISTS "expenses_delete_own"   ON expenses;
DROP POLICY IF EXISTS "expenses_admin_all"    ON expenses;
DROP POLICY IF EXISTS "auth_manage_expenses"  ON expenses;

CREATE POLICY "expenses_admin_all" ON expenses
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 10. COMPANY_SETTINGS ───────────────────────────────────
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_manage_settings"        ON company_settings;
DROP POLICY IF EXISTS "company_settings_admin_all"  ON company_settings;

CREATE POLICY "company_settings_admin_all" ON company_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Водители могут читать базовые настройки (название компании и т.д.)
DROP POLICY IF EXISTS "company_settings_driver_read" ON company_settings;
CREATE POLICY "company_settings_driver_read" ON company_settings
  FOR SELECT TO authenticated
  USING (true);

-- ─── 11. TAX_PAYMENTS ──────────────────────────────────────
ALTER TABLE tax_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_manage_tax_payments"  ON tax_payments;
DROP POLICY IF EXISTS "tax_payments_admin_all"    ON tax_payments;

CREATE POLICY "tax_payments_admin_all" ON tax_payments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 12. Убедимся что существующие админы имеют правильную роль ─
-- Пользователи с role=NULL получают роль 'admin'
UPDATE profiles SET role = 'admin' WHERE role IS NULL;

-- ─── 13. АВТО-СОЗДАНИЕ profile при регистрации нового пользователя ─
-- Это критически важный триггер! Без него у новых аккаунтов
-- НЕТ записи в profiles → is_admin() возвращает false → не видят данных.
-- По умолчанию все новые пользователи получают role='admin'.
-- Если регистрируется водитель — измените его роль на 'driver' вручную
-- в Supabase → Table Editor → profiles после регистрации.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 14. ДОЗАПОЛНИТЬ profiles для уже существующих auth.users ─
-- Создаём записи в profiles для всех пользователей auth.users,
-- у которых ещё нет записи в profiles (например, новый админ,
-- которого вы зарегистрировали ранее, но без триггера).
INSERT INTO public.profiles (id, full_name, role)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.email),
       'admin'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ─── ДИАГНОСТИКА ────────────────────────────────────────────
-- Выполните этот SELECT после миграции, чтобы убедиться,
-- что у всех пользователей есть profile с правильной ролью:
--
--   SELECT u.email, p.role, p.full_name, p.car_number
--   FROM auth.users u
--   LEFT JOIN profiles p ON p.id = u.id
--   ORDER BY u.created_at;
--
-- У второго админа должно быть role='admin' или 'owner'
-- (НЕ 'driver' и НЕ NULL).
-- ───────────────────────────────────────────────────────────

-- ─── ГОТОВО ─────────────────────────────────────────────────
-- После выполнения:
-- 1) Регистрируйте нового пользователя в Supabase Dashboard → Auth
-- 2) Триггер автоматически создаст ему запись в profiles с role='admin'
-- 3) Если нужен водитель — поменяйте role на 'driver' вручную
-- 4) Новый админ сразу увидит всех водителей/контрагентов/заказы
-- ============================================================
