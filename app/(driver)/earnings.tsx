import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../constants/supabase';
import { useAuth } from '../context/AuthContext';

type EarningsPeriod = {
  label: string;
  earned: number;
  paid: number;
  trips: number;
};

type TripWithOrder = {
  id: number;
  trip_date: string;
  order: {
    driver_rate: number;
  } | null;
};

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function getShift1Bounds(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month, 15).toISOString().slice(0, 10);
  return { start, end };
}

function getShift2Bounds(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, 16).toISOString().slice(0, 10);
  const end = new Date(year, month, lastDay).toISOString().slice(0, 10);
  return { start, end };
}

function sumEarnings(trips: TripWithOrder[]): number {
  return trips.reduce((acc, t) => acc + (t.order?.driver_rate ?? 0), 0);
}

export default function EarningsScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [todayData, setTodayData] = useState<EarningsPeriod>({
    label: 'Заработок за сегодня',
    earned: 0,
    paid: 0,
    trips: 0,
  });
  const [shift1Data, setShift1Data] = useState<EarningsPeriod>({
    label: 'Вахта №1 (1–15 число)',
    earned: 0,
    paid: 0,
    trips: 0,
  });
  const [shift2Data, setShift2Data] = useState<EarningsPeriod>({
    label: 'Вахта №2 (16–конец месяца)',
    earned: 0,
    paid: 0,
    trips: 0,
  });
  const [allTimeData, setAllTimeData] = useState<EarningsPeriod>({
    label: 'Общий заработок (за всё время)',
    earned: 0,
    paid: 0,
    trips: 0,
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function fetchTrips(dateFrom: string | null, dateTo: string | null): Promise<TripWithOrder[]> {
    if (!user) return [];

    let query = supabase
      .from('trips')
      .select('id, trip_date, order:orders(driver_rate)')
      .eq('driver_id', user.id)
      .eq('stage', 'unloading');

    if (dateFrom) query = query.gte('trip_date', dateFrom);
    if (dateTo) query = query.lte('trip_date', dateTo);

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return (data ?? []) as unknown as TripWithOrder[];
  }

  async function fetchPaid(dateFrom: string | null, dateTo: string | null): Promise<number> {
    if (!user) return 0;

    let query = supabase
      .from('driver_payments')
      .select('amount')
      .eq('driver_id', user.id);

    if (dateFrom) query = query.gte('payment_date', dateFrom);
    if (dateTo) query = query.lte('payment_date', dateTo);

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).reduce((acc, row) => acc + (row.amount ?? 0), 0);
  }

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const today = getTodayString();
      const shift1 = getShift1Bounds();
      const shift2 = getShift2Bounds();

      const [
        todayTrips,
        shift1Trips,
        shift2Trips,
        allTrips,
        todayPaid,
        shift1Paid,
        shift2Paid,
        allPaid,
      ] = await Promise.all([
        fetchTrips(today, today),
        fetchTrips(shift1.start, shift1.end),
        fetchTrips(shift2.start, shift2.end),
        fetchTrips(null, null),
        fetchPaid(today, today),
        fetchPaid(shift1.start, shift1.end),
        fetchPaid(shift2.start, shift2.end),
        fetchPaid(null, null),
      ]);

      setTodayData({
        label: 'Заработок за сегодня',
        earned: sumEarnings(todayTrips),
        paid: todayPaid,
        trips: todayTrips.length,
      });
      setShift1Data({
        label: 'Вахта №1 (1–15 число)',
        earned: sumEarnings(shift1Trips),
        paid: shift1Paid,
        trips: shift1Trips.length,
      });
      setShift2Data({
        label: 'Вахта №2 (16–конец месяца)',
        earned: sumEarnings(shift2Trips),
        paid: shift2Paid,
        trips: shift2Trips.length,
      });
      setAllTimeData({
        label: 'Общий заработок (за всё время)',
        earned: sumEarnings(allTrips),
        paid: allPaid,
        trips: allTrips.length,
      });
    } catch (err: any) {
      Alert.alert('Ошибка', err?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  function formatRub(value: number): string {
    return value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
  }

  function EarningsCard({ data, accent }: { data: EarningsPeriod; accent: string }) {
    const debt = Math.max(0, data.earned - data.paid);
    return (
      <View style={[styles.card, { borderLeftColor: accent, borderLeftWidth: 4 }]}>
        <Text style={styles.cardTitle}>{data.label}</Text>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Рейсов выполнено:</Text>
          <Text style={styles.rowValue}>{data.trips}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Заработано:</Text>
          <Text style={[styles.rowValue, styles.earned]}>{formatRub(data.earned)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Выплачено:</Text>
          <Text style={[styles.rowValue, styles.paid]}>{formatRub(data.paid)}</Text>
        </View>
        <View style={[styles.debtRow, debt > 0 ? styles.debtPositive : styles.debtZero]}>
          <Text style={styles.debtLabel}>К выплате:</Text>
          <Text style={styles.debtValue}>{formatRub(debt)}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Загрузка данных...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Мои заработки</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>Обновить</Text>
        </TouchableOpacity>
      </View>

      <EarningsCard data={todayData} accent="#f59e0b" />
      <EarningsCard data={shift1Data} accent="#2563eb" />
      <EarningsCard data={shift2Data} accent="#2563eb" />
      <EarningsCard data={allTimeData} accent="#16a34a" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  refreshButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  earned: {
    color: '#2563eb',
  },
  paid: {
    color: '#16a34a',
  },
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  debtPositive: {
    backgroundColor: '#fef2f2',
  },
  debtZero: {
    backgroundColor: '#f0fdf4',
  },
  debtLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  debtValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
});
