import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EXPENSE_TYPE_LABELS,
  REPORT_EXPENSE_CATEGORIES,
  getFinancialSummaryExtended,
  getMonthlyFinancial,
} from '../constants/queries';

type Period = 'month' | 'quarter' | 'year' | 'all';

function getPeriodDates(period: Period): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (period) {
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    case 'quarter': {
      const d = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return { dateFrom: d.toISOString().slice(0, 10), dateTo: today };
    }
    case 'year': {
      return { dateFrom: `${now.getFullYear()}-01-01`, dateTo: today };
    }
    default:
      return {};
  }
}

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Месяц', quarter: 'Квартал', year: 'Год', all: 'Всё время',
};

export default function FinanceScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMonthly, setShowMonthly] = useState(false);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getPeriodDates(period);
      const [summaryData, monthlyData] = await Promise.all([
        getFinancialSummaryExtended(dateFrom, dateTo),
        getMonthlyFinancial(new Date().getFullYear()),
      ]);
      setSummary(summaryData);
      setMonthly(monthlyData);
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось загрузить финансовые данные');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ color: '#6b7280', marginTop: 12 }}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Финансы</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Выбор периода */}
        <View style={styles.periodRow}>
          {(['month', 'quarter', 'year', 'all'] as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {summary && (
          <>
            {/* Главные карточки */}
            <View style={styles.grid}>
              <View style={[styles.card, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]}>
                <Text style={styles.cardLabel}>💰 Выручка</Text>
                <Text style={[styles.cardValue, { color: '#10b981' }]}>{fmt(summary.revenue)} ₽</Text>
              </View>
              <View style={[styles.card, { borderLeftColor: '#ef4444', borderLeftWidth: 4 }]}>
                <Text style={styles.cardLabel}>📤 Расходы</Text>
                <Text style={[styles.cardValue, { color: '#ef4444' }]}>{fmt(summary.totalExpenses)} ₽</Text>
              </View>
              <View style={[styles.card, { borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]}>
                <Text style={styles.cardLabel}>👷 Зарплата</Text>
                <Text style={[styles.cardValue, { color: '#f59e0b' }]}>{fmt(summary.totalSalary)} ₽</Text>
              </View>
              <View style={[styles.card, { borderLeftColor: summary.netProfit >= 0 ? '#2563eb' : '#dc2626', borderLeftWidth: 4 }]}>
                <Text style={styles.cardLabel}>📊 Прибыль</Text>
                <Text style={[styles.cardValue, { color: summary.netProfit >= 0 ? '#2563eb' : '#dc2626' }]}>
                  {fmt(summary.netProfit)} ₽
                </Text>
              </View>
            </View>

            {/* Нал / Безнал */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Разбивка выручки</Text>
              <View style={styles.splitRow}>
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>💵 Наличные</Text>
                  <Text style={[styles.splitValue, { color: '#16a34a' }]}>{fmt(summary.cashRevenue)} ₽</Text>
                  <Text style={styles.splitPct}>
                    {summary.revenue > 0 ? Math.round(summary.cashRevenue / summary.revenue * 100) : 0}%
                  </Text>
                </View>
                <View style={styles.splitDivider} />
                <View style={styles.splitItem}>
                  <Text style={styles.splitLabel}>💳 Безналичные</Text>
                  <Text style={[styles.splitValue, { color: '#2563eb' }]}>{fmt(summary.noncashRevenue)} ₽</Text>
                  <Text style={styles.splitPct}>
                    {summary.revenue > 0 ? Math.round(summary.noncashRevenue / summary.revenue * 100) : 0}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Расходы по категориям */}
            {Object.keys(summary.expByType ?? {}).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Расходы по категориям</Text>
                {REPORT_EXPENSE_CATEGORIES
                  .filter(cat => (summary.expByType[cat] ?? 0) > 0)
                  .sort((a, b) => (summary.expByType[b] ?? 0) - (summary.expByType[a] ?? 0))
                  .map(cat => {
                    const amount = summary.expByType[cat] ?? 0;
                    const pct = summary.totalExpenses > 0
                      ? Math.round(amount / summary.totalExpenses * 100) : 0;
                    return (
                      <View key={cat} style={styles.catRow}>
                        <Text style={styles.catName}>{EXPENSE_TYPE_LABELS[cat] ?? cat}</Text>
                        <View style={styles.catRight}>
                          <Text style={styles.catPct}>{pct}%</Text>
                          <Text style={styles.catAmount}>{fmt(amount)} ₽</Text>
                        </View>
                      </View>
                    );
                  })}
                {/* Зарплата отдельно */}
                {summary.totalSalary > 0 && (
                  <View style={[styles.catRow, { backgroundColor: '#fef3c7' }]}>
                    <Text style={styles.catName}>👷 Зарплата водителей</Text>
                    <Text style={[styles.catAmount, { color: '#f59e0b' }]}>{fmt(summary.totalSalary)} ₽</Text>
                  </View>
                )}
              </View>
            )}

            {/* Итоги себестоимости */}
            <View style={styles.costBox}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Итого затраты:</Text>
                <Text style={styles.costValue}>{fmt(summary.totalCosts)} ₽</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Маржа:</Text>
                <Text style={[styles.costValue, { color: summary.netProfit >= 0 ? '#16a34a' : '#dc2626' }]}>
                  {summary.revenue > 0
                    ? `${Math.round(summary.netProfit / summary.revenue * 100)}%`
                    : '—'}
                </Text>
              </View>
            </View>

            {/* Помесячный график */}
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setShowMonthly(!showMonthly)}
            >
              <Text style={styles.toggleBtnText}>
                {showMonthly ? '▲ Скрыть помесячно' : '▼ Показать помесячно'}
              </Text>
            </TouchableOpacity>

            {showMonthly && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>По месяцам ({new Date().getFullYear()})</Text>
                {monthly
                  .filter(m => m.totalRevenue > 0 || m.totalCosts > 0)
                  .map(m => (
                    <View key={m.month} style={styles.monthRow}>
                      <Text style={styles.monthName}>{m.monthName.split(' ')[0]}</Text>
                      <View style={styles.monthRight}>
                        <Text style={[styles.monthVal, { color: '#10b981' }]}>+{fmt(m.totalRevenue)}</Text>
                        <Text style={[styles.monthVal, { color: '#ef4444' }]}>−{fmt(m.totalCosts)}</Text>
                        <Text style={[styles.monthProfit, {
                          color: m.netProfit >= 0 ? '#2563eb' : '#dc2626',
                        }]}>
                          {m.netProfit >= 0 ? '=' : '='}{fmt(Math.abs(m.netProfit))}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: {
    flex: 1, backgroundColor: '#e5e7eb', paddingVertical: 9,
    borderRadius: 8, alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: '#2563eb' },
  periodBtnText: { fontSize: 12, color: '#1f2937', fontWeight: '500' },
  periodBtnTextActive: { color: 'white', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 14,
    flex: 1, minWidth: '45%', elevation: 2,
  },
  cardLabel: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  cardValue: { fontSize: 20, fontWeight: 'bold' },
  section: {
    backgroundColor: 'white', borderRadius: 12, padding: 14,
    marginBottom: 12, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12, color: '#1f2937' },
  splitRow: { flexDirection: 'row', alignItems: 'center' },
  splitItem: { flex: 1, alignItems: 'center' },
  splitLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  splitValue: { fontSize: 18, fontWeight: 'bold' },
  splitPct: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  splitDivider: { width: 1, height: 50, backgroundColor: '#e5e7eb' },
  catRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    paddingHorizontal: 4, borderRadius: 6, marginBottom: 2,
  },
  catName: { fontSize: 13, color: '#374151', flex: 1 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catPct: { fontSize: 12, color: '#9ca3af', minWidth: 30, textAlign: 'right' },
  catAmount: { fontSize: 14, fontWeight: '600', color: '#ef4444', minWidth: 80, textAlign: 'right' },
  costBox: {
    backgroundColor: '#fef3c7', borderRadius: 12, padding: 14,
    marginBottom: 12,
  },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  costLabel: { fontSize: 14, color: '#92400e' },
  costValue: { fontSize: 15, fontWeight: '700', color: '#92400e' },
  toggleBtn: {
    backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12,
    alignItems: 'center', marginBottom: 12,
  },
  toggleBtnText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  monthRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  monthName: { fontSize: 14, fontWeight: '600', color: '#374151', width: 70 },
  monthRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  monthVal: { fontSize: 12, fontWeight: '500', minWidth: 64, textAlign: 'right' },
  monthProfit: { fontSize: 13, fontWeight: '700', minWidth: 64, textAlign: 'right' },
});
