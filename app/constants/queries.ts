import { supabase } from './supabase';

// ========== ВОДИТЕЛИ ==========
export const getDrivers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, car_number, role')
    .eq('role', 'driver')
    .order('full_name');
  if (error) throw error;
  return data ?? [];
};

export const addDriver = async (_full_name: string, _car_number: string) => {
  throw new Error('Добавление водителей выполняется через Supabase Dashboard');
};

export const updateDriverCarNumber = async (driverId: string, carNumber: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ car_number: carNumber.trim().toUpperCase() })
    .eq('id', driverId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ========== КОНТРАГЕНТЫ (справочник) ==========
export const getCustomersList = async () => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
};

export const addCustomer = async (customer: {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  inn?: string | null;
  address?: string | null;
  notes?: string | null;
}) => {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCustomer = async (id: string, updates: {
  name?: string;
  contact_name?: string | null;
  phone?: string | null;
  inn?: string | null;
  address?: string | null;
  notes?: string | null;
}) => {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteCustomer = async (id: string) => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
};

export const getCustomers = async (): Promise<string[]> => {
  // For order form autocomplete — combine customers table + existing orders
  const [{ data: cust }, { data: ord }] = await Promise.all([
    supabase.from('customers').select('name').order('name'),
    supabase.from('orders').select('customer').order('customer'),
  ]);
  const names = [
    ...((cust ?? []).map((c: any) => c.name as string)),
    ...((ord ?? []).map((d: any) => d.customer as string)),
  ];
  return [...new Set(names)].filter(Boolean).sort();
};

/**
 * Финансы по контрагентам за период.
 * Выручка = company_rate × volume (ставка за ед × объём рейса).
 * Долг = Выручка − Оплачено.
 */
export const getCustomersWithDebt = async (dateFrom?: string, dateTo?: string) => {
  // Рейсы «выгрузка» — факт оказания услуги
  let tripsQ = supabase
    .from('trips')
    .select('volume, trip_date, order:orders(customer, company_rate)')
    .eq('stage', 'unloading');
  if (dateFrom) tripsQ = tripsQ.gte('trip_date', dateFrom);
  if (dateTo)   tripsQ = tripsQ.lte('trip_date', dateTo);
  const { data: trips, error: tripsError } = await tripsQ;
  if (tripsError) throw tripsError;

  // Платежи от заказчиков за тот же период
  let payQ = supabase
    .from('customer_payments')
    .select('customer_name, amount, payment_date');
  if (dateFrom) payQ = payQ.gte('payment_date', dateFrom);
  if (dateTo)   payQ = payQ.lte('payment_date', dateTo);
  const { data: payments, error: payError } = await payQ;
  if (payError) throw payError;

  // Выручка = ставка компании × объём рейса
  const revenueMap: Record<string, number> = {};
  for (const t of (trips ?? []) as any[]) {
    const customer = t.order?.customer;
    const rate   = t.order?.company_rate ?? 0;
    const volume = t.volume ?? 0;
    if (customer) {
      revenueMap[customer] = (revenueMap[customer] ?? 0) + rate * volume;
    }
  }

  // Оплачено
  const paidMap: Record<string, number> = {};
  for (const p of (payments ?? []) as any[]) {
    if (p.customer_name) {
      paidMap[p.customer_name] = (paidMap[p.customer_name] ?? 0) + (p.amount ?? 0);
    }
  }

  const allNames = [...new Set([...Object.keys(revenueMap), ...Object.keys(paidMap)])];
  return allNames.map((name, idx) => {
    const revenue = revenueMap[name] ?? 0;
    const paid    = paidMap[name] ?? 0;
    return { id: String(idx + 1), name, revenue, paid, debt: revenue - paid };
  });
};

export const addCustomerPayment = async (customer_name: string, amount: number, comment: string) => {
  const { data, error } = await supabase
    .from('customer_payments')
    .insert({
      customer_name,
      amount,
      comment: comment || null,
      payment_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getCustomerPaymentHistory = async (customerName: string) => {
  const { data, error } = await supabase
    .from('customer_payments')
    .select('*')
    .eq('customer_name', customerName)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// ========== ЗАДАЧИ ==========
export const getActiveOrders = async () => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: false });
  if (error) throw error;
  if (!orders || orders.length === 0) return [];

  // Batch-fetch driver profiles
  const driverIds = [...new Set(orders.map((o: any) => o.driver_id).filter(Boolean))];
  let profileMap: Record<string, any> = {};
  if (driverIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, car_number')
      .in('id', driverIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  }

  return orders.map((o: any) => ({
    ...o,
    driver_name: profileMap[o.driver_id]?.full_name ?? null,
  }));
};

export const addOrder = async (orderData: any) => {
  const { data, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateOrder = async (id: number, updateData: any) => {
  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deactivateOrder = async (id: number) => {
  const { error } = await supabase
    .from('orders')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
  return true;
};

export const reactivateOrder = async (id: number) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getArchivedOrders = async () => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('is_active', false)
    .order('id', { ascending: false });
  if (error) throw error;
  if (!orders || orders.length === 0) return [];

  const driverIds = [...new Set(orders.map((o: any) => o.driver_id).filter(Boolean))];
  let profileMap: Record<string, any> = {};
  if (driverIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, car_number')
      .in('id', driverIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  }

  return orders.map((o: any) => ({
    ...o,
    driver_name: profileMap[o.driver_id]?.full_name ?? null,
  }));
};

// ========== ЗАРПЛАТА ==========
// driverId — UUID из таблицы profiles/auth.users
export const getDriverEarnings = async (driverId: string, dateFrom?: string, dateTo?: string) => {
  let query = supabase
    .from('trips')
    .select('order:orders(driver_rate)')
    .eq('driver_id', driverId)
    .eq('stage', 'unloading');
  if (dateFrom) query = query.gte('trip_date', dateFrom);
  if (dateTo) query = query.lte('trip_date', dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reduce((acc: number, t: any) => acc + (t.order?.driver_rate ?? 0), 0);
};

export const getDriverPayments = async (driverId: string, dateFrom?: string, dateTo?: string) => {
  let query = supabase
    .from('driver_payments')
    .select('*')
    .eq('driver_id', driverId)
    .order('payment_date', { ascending: false });
  if (dateFrom) query = query.gte('payment_date', dateFrom);
  if (dateTo)   query = query.lte('payment_date', dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const addDriverPayment = async (paymentData: {
  driver_id: string;
  amount: number;
  payment_type: string;
  comment?: string;
}) => {
  const { data, error } = await supabase
    .from('driver_payments')
    .insert({
      driver_id: paymentData.driver_id,
      amount: paymentData.amount,
      payment_type: paymentData.payment_type,
      comment: paymentData.comment || null,
      payment_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ========== РАСХОДЫ ==========
export const getExpenses = async (days: number = 90) => {
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('exp_date', dateFrom)
    .order('exp_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const addExpense = async (expense: any) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      ...expense,
      exp_date: expense.exp_date ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateExpense = async (id: number, updates: any) => {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteExpense = async (id: number) => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
};

// ========== ОТЧЁТЫ ==========
function getPeriodBounds(period: string): { dateFrom: string | null; dateTo: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (period) {
    case 'today':
      return { dateFrom: today, dateTo: today };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    case 'quarter': {
      const d = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    case 'year': {
      const d = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    default:
      return { dateFrom: null, dateTo: today };
  }
}

/**
 * Финансовая сводка за период.
 * Выручка  = Σ(company_rate × volume) — деньги, заработанные компанией на рейсах.
 * Расходы  = Σ expenses (топливо, прочее).
 * Зарплата = Σ driver_payments (выплаченные суммы водителям).
 * Прибыль  = Выручка − Расходы − Зарплата.
 *
 * Примечание: «Выручка» = начисленная, а не полученная (не учитывает долги заказчиков).
 * Дебиторская задолженность отображается в разделе «Контрагенты».
 */
export const getFinancialSummary = async (period: string = 'month') => {
  const { dateFrom, dateTo } = getPeriodBounds(period);

  let tripsQ = supabase
    .from('trips')
    .select('volume, order:orders(company_rate)')  // нужен объём!
    .eq('stage', 'unloading')
    .lte('trip_date', dateTo);
  if (dateFrom) tripsQ = tripsQ.gte('trip_date', dateFrom);

  let expQ = supabase
    .from('expenses')
    .select('amount')
    .lte('exp_date', dateTo);
  if (dateFrom) expQ = expQ.gte('exp_date', dateFrom);

  let salQ = supabase
    .from('driver_payments')
    .select('amount')
    .lte('payment_date', dateTo);
  if (dateFrom) salQ = salQ.gte('payment_date', dateFrom);

  const [tripsRes, expRes, salRes] = await Promise.all([tripsQ, expQ, salQ]);
  if (tripsRes.error) throw tripsRes.error;
  if (expRes.error) throw expRes.error;
  if (salRes.error) throw salRes.error;

  // Выручка = ставка × объём для каждого рейса
  const revenue = (tripsRes.data ?? []).reduce(
    (acc: number, t: any) => acc + (t.order?.company_rate ?? 0) * (t.volume ?? 0), 0
  );
  const expenses = (expRes.data ?? []).reduce((acc: number, e: any) => acc + (e.amount ?? 0), 0);
  const salary   = (salRes.data ?? []).reduce((acc: number, p: any) => acc + (p.amount ?? 0), 0);

  // Себестоимость = зарплаты водителей + прямые расходы (топливо, прочее)
  const cost = salary + expenses;

  return {
    revenue,          // Выручка (начисленная)
    expenses,         // Прямые расходы
    salary,           // Выплаты водителям
    cost,             // Себестоимость (expenses + salary)
    profit: revenue - cost,  // Валовая прибыль
  };
};

export const getTransactions = async (period: string = 'month') => {
  const { dateFrom, dateTo } = getPeriodBounds(period);

  let tripsQ = supabase
    .from('trips')
    .select('id, trip_date, car_number, volume, order:orders(company_rate, task_name, customer)')
    .eq('stage', 'unloading')
    .lte('trip_date', dateTo);
  if (dateFrom) tripsQ = tripsQ.gte('trip_date', dateFrom);

  let expQ = supabase
    .from('expenses')
    .select('id, exp_date, amount, comment, car_number')
    .lte('exp_date', dateTo);
  if (dateFrom) expQ = expQ.gte('exp_date', dateFrom);

  let salQ = supabase
    .from('driver_payments')
    .select('id, payment_date, amount, comment, driver_id')
    .lte('payment_date', dateTo);
  if (dateFrom) salQ = salQ.gte('payment_date', dateFrom);

  const [tripsRes, expRes, salRes] = await Promise.all([tripsQ, expQ, salQ]);
  if (tripsRes.error) throw tripsRes.error;
  if (expRes.error) throw expRes.error;
  if (salRes.error) throw salRes.error;

  // Batch-fetch profiles for salary entries
  const driverIds = [...new Set((salRes.data ?? []).map((p: any) => p.driver_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (driverIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', driverIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]));
  }

  const trips = (tripsRes.data ?? []).map((t: any) => ({
    id: `trip_${t.id}`,
    date: t.trip_date,
    type: 'revenue',
    description: `${t.order?.customer || t.order?.task_name || 'Рейс'} · ${t.volume ?? 0} ${t.order?.unit ?? 'ед'} × ${t.order?.company_rate ?? 0} ₽`,
    amount: (t.order?.company_rate ?? 0) * (t.volume ?? 0),  // выручка = ставка × объём
    car: t.car_number,
  }));

  const exps = (expRes.data ?? []).map((e: any) => ({
    id: `exp_${e.id}`,
    date: e.exp_date,
    type: 'expense',
    description: e.comment || 'Расход',
    amount: -(e.amount ?? 0),
    car: e.car_number,
  }));

  const salaries = (salRes.data ?? []).map((p: any) => ({
    id: `pay_${p.id}`,
    date: p.payment_date,
    type: 'salary',
    description: `Выплата ${profileMap[p.driver_id] || ''}`.trim(),
    amount: -(p.amount ?? 0),
    car: null,
  }));

  return [...trips, ...exps, ...salaries].sort((a, b) => b.date.localeCompare(a.date));
};

// ========== РЕЕСТР ==========
export const getRegistryData = async (dateFrom: string, dateTo: string, carNumber?: string) => {
  let query = supabase
    .from('trips')
    .select('id, trip_date, ttn_number, car_number, volume, driver_id, order:orders(task_name, material, customer, sender, receiver, load_address, unload_address, distance_km, unit, driver_rate, company_rate)')
    .eq('stage', 'unloading')
    .gte('trip_date', dateFrom)
    .lte('trip_date', dateTo)
    .order('trip_date', { ascending: false });

  if (carNumber) query = query.eq('car_number', carNumber);

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Batch-fetch driver names
  const driverIds = [...new Set((data as any[]).map((t) => t.driver_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (driverIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', driverIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]));
  }

  return (data as any[]).map((t) => ({
    trip_date: t.trip_date,
    ttn_number: t.ttn_number ?? '',
    car_number: t.car_number ?? '',
    driver_name: profileMap[t.driver_id] ?? '',
    material: t.order?.material ?? '',
    customer: t.order?.customer ?? '',
    sender: t.order?.sender ?? '',
    receiver: t.order?.receiver ?? '',
    load_address: t.order?.load_address ?? '',
    unload_address: t.order?.unload_address ?? '',
    distance_km: t.order?.distance_km ?? 0,
    unit: t.order?.unit ?? '',
    volume: t.volume ?? 0,
    driver_rate: t.order?.driver_rate ?? 0,
    company_rate: t.order?.company_rate ?? 0,
  }));
};

// ========== ЗАРПЛАТНЫЙ ТАБЕЛЬ (все водители, все выплаты) ==========
export const getAllDriverPayments = async (dateFrom?: string, dateTo?: string) => {
  let q = supabase
    .from('driver_payments')
    .select('id, driver_id, amount, payment_type, comment, payment_date')
    .order('payment_date', { ascending: false });
  if (dateFrom) q = q.gte('payment_date', dateFrom);
  if (dateTo) q = q.lte('payment_date', dateTo);
  const { data, error } = await q;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const driverIds = [...new Set(data.map((p: any) => p.driver_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (driverIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', driverIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]));
  }

  return data.map((p: any) => ({
    ...p,
    driver_name: profileMap[p.driver_id] ?? p.driver_id,
  }));
};

// ========== ПОЕЗДКИ ==========
export const getDriverOrders = async () => [];

export const addTrip = async (tripData: any) => {
  const { data, error } = await supabase
    .from('trips')
    .insert(tripData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ========== СПРАВОЧНИК ТИПОВ РАСХОДОВ ==========
export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  fuel_card:    'Пополнение топл. карты',
  fuel:         'Топливо по карте',
  repair:       'Ремонт/Шиномонтаж',
  parts:        'Запчасти/шины',
  maintenance:  'ТО и сервис',
  platon:       'Платон',
  wash:         'Мойка',
  toll:         'Платные дороги',
  fine:         'Штрафы',
  lease:        'Аренда/лизинг',
  bank_fee:     'Банковские комиссии',
  other:        'Прочие расходы',
  salary_other: 'Зарплата (прочая)',
  dividend:     'Дивиденды',
};

// Категории для отчёта Лист2/Лист3 (не включают dividend/salary_other — они отдельно)
export const REPORT_EXPENSE_CATEGORIES = [
  'fuel_card', 'fuel', 'repair', 'parts', 'maintenance',
  'platon', 'wash', 'toll', 'fine', 'lease', 'bank_fee', 'other',
] as const;

// ========== ФИНАНСОВАЯ СВОДКА ЗА ПЕРИОД ==========
export const getFinancialSummaryExtended = async (dateFrom?: string, dateTo?: string) => {
  let tripsQ = supabase
    .from('trips')
    .select('volume, payment_method, order:orders(company_rate)')
    .eq('stage', 'unloading');
  if (dateFrom) tripsQ = tripsQ.gte('trip_date', dateFrom);
  if (dateTo)   tripsQ = tripsQ.lte('trip_date', dateTo);

  let expQ = supabase.from('expenses').select('exp_type, amount');
  if (dateFrom) expQ = expQ.gte('exp_date', dateFrom);
  if (dateTo)   expQ = expQ.lte('exp_date', dateTo);

  let salQ = supabase.from('driver_payments').select('amount');
  if (dateFrom) salQ = salQ.gte('payment_date', dateFrom);
  if (dateTo)   salQ = salQ.lte('payment_date', dateTo);

  const [tripsRes, expRes, salRes] = await Promise.all([tripsQ, expQ, salQ]);
  if (tripsRes.error) throw tripsRes.error;
  if (expRes.error)   throw expRes.error;
  if (salRes.error)   throw salRes.error;

  let cashRevenue = 0, noncashRevenue = 0;
  for (const t of (tripsRes.data ?? []) as any[]) {
    const rev = (t.order?.company_rate ?? 0) * (t.volume ?? 0);
    if (t.payment_method === 'cash') cashRevenue += rev;
    else noncashRevenue += rev;
  }

  const expByType: Record<string, number> = {};
  for (const e of (expRes.data ?? []) as any[]) {
    expByType[e.exp_type] = (expByType[e.exp_type] ?? 0) + (e.amount ?? 0);
  }
  const totalExpenses = Object.values(expByType).reduce((a, b) => a + b, 0);
  const totalSalary   = (salRes.data ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  const revenue       = cashRevenue + noncashRevenue;

  return {
    cashRevenue,
    noncashRevenue,
    revenue,
    expByType,
    totalExpenses,
    totalSalary,
    totalCosts:  totalExpenses + totalSalary,
    netProfit:   revenue - totalExpenses - totalSalary,
  };
};

// ========== ПОМЕСЯЧНАЯ РАЗБИВКА ЗА ГОД ==========
export const getMonthlyFinancial = async (year: number) => {
  const MONTH_NAMES = [
    'Январь','Февраль','Март','Апрель','Май','Июнь',
    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
  ];

  const results = [];
  for (let m = 1; m <= 12; m++) {
    const dateFrom = `${year}-${String(m).padStart(2,'0')}-01`;
    const lastDay  = new Date(year, m, 0).getDate();
    const dateTo   = `${year}-${String(m).padStart(2,'0')}-${lastDay}`;

    const [tripsRes, expRes, salRes] = await Promise.all([
      supabase.from('trips').select('volume, payment_method, order:orders(company_rate)')
        .eq('stage', 'unloading').gte('trip_date', dateFrom).lte('trip_date', dateTo),
      supabase.from('expenses').select('exp_type, amount').gte('exp_date', dateFrom).lte('exp_date', dateTo),
      supabase.from('driver_payments').select('amount').gte('payment_date', dateFrom).lte('payment_date', dateTo),
    ]);

    let cash = 0, noncash = 0;
    for (const t of (tripsRes.data ?? []) as any[]) {
      const rev = (t.order?.company_rate ?? 0) * (t.volume ?? 0);
      if (t.payment_method === 'cash') cash += rev; else noncash += rev;
    }

    const byCategory: Record<string, number> = {};
    for (const e of (expRes.data ?? []) as any[]) {
      byCategory[e.exp_type] = (byCategory[e.exp_type] ?? 0) + (e.amount ?? 0);
    }
    const totalExp = Object.values(byCategory).reduce((a, b) => a + b, 0);
    const totalSal = (salRes.data ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0);

    results.push({
      month:         m,
      monthName:     `${MONTH_NAMES[m-1]} ${year}`,
      cashRevenue:   cash,
      noncashRevenue: noncash,
      totalRevenue:  cash + noncash,
      byCategory,
      totalExpenses: totalExp,
      totalSalary:   totalSal,
      totalCosts:    totalExp + totalSal,
      netProfit:     cash + noncash - totalExp - totalSal,
    });
  }
  return results;
};

// ========== РЕЕСТР (с payment_method) ══════════════════════
export const getRegistryDataV2 = async (dateFrom: string, dateTo: string, carNumber?: string) => {
  let query = supabase
    .from('trips')
    .select(`
      id, trip_date, ttn_number, car_number, volume, driver_id, payment_method,
      order:orders(task_name, material, customer, sender, receiver,
                   load_address, unload_address, distance_km, unit, driver_rate, company_rate)
    `)
    .eq('stage', 'unloading')
    .gte('trip_date', dateFrom)
    .lte('trip_date', dateTo)
    .order('trip_date', { ascending: true });

  if (carNumber) query = query.eq('car_number', carNumber);
  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const driverIds = [...new Set((data as any[]).map(t => t.driver_id).filter(Boolean))];
  let profileMap: Record<string, string> = {};
  if (driverIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', driverIds);
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name]));
  }

  return (data as any[]).map(t => ({
    trip_date:      t.trip_date,
    ttn_number:     t.ttn_number ?? '',
    car_number:     t.car_number ?? '',
    driver_name:    profileMap[t.driver_id] ?? '',
    material:       t.order?.material ?? '',
    customer:       t.order?.customer ?? '',
    load_address:   t.order?.load_address ?? '',
    unload_address: t.order?.unload_address ?? '',
    distance_km:    t.order?.distance_km ?? 0,
    unit:           t.order?.unit ?? '',
    volume:         t.volume ?? 0,
    driver_rate:    t.order?.driver_rate ?? 0,
    company_rate:   t.order?.company_rate ?? 0,
    payment_method: t.payment_method ?? 'noncash',
  }));
};

// ========== НАСТРОЙКИ КОМПАНИИ ==========
export const getCompanySettings = async () => {
  const { data, error } = await supabase.from('company_settings').select('*').single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
};

export const upsertCompanySettings = async (settings: Record<string, any>) => {
  const existing = await getCompanySettings();
  if (existing?.id) {
    const { data, error } = await supabase
      .from('company_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('company_settings')
      .insert(settings)
      .select().single();
    if (error) throw error;
    return data;
  }
};

// ========== НАЛОГОВЫЕ ПЛАТЕЖИ ==========
export const getTaxPayments = async (year?: number) => {
  let q = supabase.from('tax_payments').select('*').order('payment_date', { ascending: false });
  if (year) q = q.eq('period_year', year);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

export const addTaxPayment = async (payment: {
  payment_date: string;
  tax_type: string;
  period_year: number;
  period_quarter?: number;
  period_month?: number;
  amount: number;
  comment?: string;
}) => {
  const { data, error } = await supabase
    .from('tax_payments').insert(payment).select().single();
  if (error) throw error;
  return data;
};

export const deleteTaxPayment = async (id: string) => {
  const { error } = await supabase.from('tax_payments').delete().eq('id', id);
  if (error) throw error;
};

// ========== УСН РАСЧЁТ ==========
export const calcUsnTax = async (dateFrom: string, dateTo: string) => {
  const settings = await getCompanySettings();
  const summary  = await getFinancialSummaryExtended(dateFrom, dateTo);
  const regime   = settings?.tax_regime ?? 'usn_15';
  const rate     = settings?.usn_rate ?? (regime === 'usn_6' ? 6 : 15);

  let base = 0, tax = 0;
  if (regime === 'usn_6') {
    base = summary.revenue;
    tax  = base * rate / 100;
  } else if (regime === 'usn_15') {
    base = Math.max(summary.revenue - summary.totalCosts, 0);
    tax  = Math.max(base * rate / 100, summary.revenue * 0.01);
  }

  return { regime, rate, ...summary, base, tax };
};
