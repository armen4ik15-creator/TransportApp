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

// ========== КОНТРАГЕНТЫ ==========
export const getCustomers = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('customer')
    .order('customer');
  if (error) throw error;
  const unique = [...new Set((data ?? []).map((d: any) => d.customer as string))];
  return unique;
};

export const getCustomersWithDebt = async () => {
  // Get all unloading trips with their order's company_rate
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('order:orders(customer, company_rate)')
    .eq('stage', 'unloading');
  if (tripsError) throw tripsError;

  // Get all customer payments
  const { data: payments, error: payError } = await supabase
    .from('customer_payments')
    .select('customer_name, amount');
  if (payError) throw payError;

  // Aggregate revenue per customer
  const revenueMap: Record<string, number> = {};
  for (const t of (trips ?? []) as any[]) {
    const customer = t.order?.customer;
    const rate = t.order?.company_rate ?? 0;
    if (customer) {
      revenueMap[customer] = (revenueMap[customer] ?? 0) + rate;
    }
  }

  // Aggregate paid per customer
  const paidMap: Record<string, number> = {};
  for (const p of (payments ?? []) as any[]) {
    if (p.customer_name) {
      paidMap[p.customer_name] = (paidMap[p.customer_name] ?? 0) + (p.amount ?? 0);
    }
  }

  const allNames = [...new Set([...Object.keys(revenueMap), ...Object.keys(paidMap)])];
  return allNames.map((name, idx) => {
    const revenue = revenueMap[name] ?? 0;
    const paid = paidMap[name] ?? 0;
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

export const getDriverPayments = async (driverId: string) => {
  const { data, error } = await supabase
    .from('driver_payments')
    .select('*')
    .eq('driver_id', driverId)
    .order('payment_date', { ascending: false });
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
export const getExpenses = async (days: number = 30) => {
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

export const getFinancialSummary = async (period: string = 'month') => {
  const { dateFrom, dateTo } = getPeriodBounds(period);

  let tripsQ = supabase
    .from('trips')
    .select('order:orders(company_rate)')
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

  const revenue = (tripsRes.data ?? []).reduce((acc: number, t: any) => acc + (t.order?.company_rate ?? 0), 0);
  const expenses = (expRes.data ?? []).reduce((acc: number, e: any) => acc + (e.amount ?? 0), 0);
  const salary = (salRes.data ?? []).reduce((acc: number, p: any) => acc + (p.amount ?? 0), 0);
  return { revenue, expenses, salary, profit: revenue - expenses - salary };
};

export const getTransactions = async (period: string = 'month') => {
  const { dateFrom, dateTo } = getPeriodBounds(period);

  let tripsQ = supabase
    .from('trips')
    .select('id, trip_date, car_number, order:orders(company_rate, task_name, customer)')
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
    description: `Рейс: ${t.order?.task_name || t.order?.customer || 'Без названия'}`,
    amount: t.order?.company_rate ?? 0,
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
