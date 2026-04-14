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
import * as XLSX from 'xlsx';
import {
  EXPENSE_TYPE_LABELS,
  REPORT_EXPENSE_CATEGORIES,
  getFinancialSummaryExtended,
  getMonthlyFinancial,
  getRegistryDataV2,
  getTransactions,
} from '../constants/queries';
import { saveAndShareExcel } from '../utils/exportExcel';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

function getPeriodDates(period: Period): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (period) {
    case 'today':
      return { dateFrom: today, dateTo: today };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
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
  }
}

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState({
    revenue: 0, cashRevenue: 0, noncashRevenue: 0,
    expenses: 0, salary: 0, cost: 0, profit: 0,
    expByType: {} as Record<string, number>,
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getPeriodDates(period);
      const [ext, txData] = await Promise.all([
        getFinancialSummaryExtended(dateFrom, dateTo),
        getTransactions(period),
      ]);
      setSummary({
        revenue: ext.revenue,
        cashRevenue: ext.cashRevenue,
        noncashRevenue: ext.noncashRevenue,
        expenses: ext.totalExpenses,
        salary: ext.totalSalary,
        cost: ext.totalCosts,
        profit: ext.netProfit,
        expByType: ext.expByType,
      });
      setTransactions(txData);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить отчёт');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const periodNames: Record<Period, string> = {
    today: 'Сегодня', week: 'Неделя', month: 'Месяц', quarter: 'Квартал', year: 'Год',
  };

  // ── Excel export ─────────────────────────────────────────────
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { dateFrom, dateTo } = getPeriodDates(period);
      const year = new Date().getFullYear();

      const [trips, monthly] = await Promise.all([
        getRegistryDataV2(dateFrom, dateTo),
        getMonthlyFinancial(year),
      ]);

      const wb = XLSX.utils.book_new();

      // ── ЛИСТ2: детализация рейсов за период ──────────────────
      const expCatHeaders = REPORT_EXPENSE_CATEGORIES.map(
        (c) => EXPENSE_TYPE_LABELS[c] ?? c
      );

      const sheet2Headers = [
        'Дата', 'Номер ТН', 'Номер Машины', 'ФИО водителя', 'Контрагент',
        'Материал', 'Ед', 'Объём', 'Ставка', 'Сумма', 'Нал', 'Безнал',
        '', ...expCatHeaders,
      ];

      const sheet2Rows = trips.map((t: any) => {
        const sum = parseFloat(((t.company_rate ?? 0) * (t.volume ?? 0)).toFixed(2));
        const isCash = t.payment_method === 'cash';
        return [
          t.trip_date,
          t.ttn_number,
          t.car_number,
          t.driver_name,
          t.customer,
          t.material,
          t.unit,
          t.volume,
          t.company_rate,
          sum,
          isCash ? sum : '',
          isCash ? '' : sum,
          '',
          ...REPORT_EXPENSE_CATEGORIES.map(() => ''),
        ];
      });

      // Итоги по рейсам
      if (trips.length > 0) {
        const totVol  = trips.reduce((s: number, r: any) => s + (r.volume ?? 0), 0);
        const totSum  = trips.reduce((s: number, r: any) => s + (r.company_rate ?? 0) * (r.volume ?? 0), 0);
        const totCash = trips.reduce((s: number, r: any) =>
          s + (r.payment_method === 'cash' ? (r.company_rate ?? 0) * (r.volume ?? 0) : 0), 0);
        sheet2Rows.push([] as any);
        sheet2Rows.push([
          `Итого рейсов: ${trips.length}`, '', '', '', '', '', '',
          parseFloat(totVol.toFixed(3)), '',
          parseFloat(totSum.toFixed(2)),
          parseFloat(totCash.toFixed(2)),
          parseFloat((totSum - totCash).toFixed(2)),
          '', ...REPORT_EXPENSE_CATEGORIES.map(() => ''),
        ] as any);
      }

      // Пустая строка-разделитель
      sheet2Rows.push([] as any);
      sheet2Rows.push(['РАСХОДЫ ЗА ПЕРИОД', ...Array(sheet2Headers.length - 1).fill('')] as any);

      // Строки расходов по категориям
      const expRow: any[] = Array(sheet2Headers.length).fill('');
      expRow[0] = 'Категория / Сумма (руб)';
      REPORT_EXPENSE_CATEGORIES.forEach((cat, idx) => {
        expRow[13 + idx] = summary.expByType[cat] ?? 0;
      });
      sheet2Rows.push(expRow);

      // Зарплата водителей
      const salRow: any[] = Array(sheet2Headers.length).fill('');
      salRow[0] = 'Зарплата водителей';
      salRow[9] = summary.salary;
      sheet2Rows.push(salRow);

      const ws2 = XLSX.utils.aoa_to_sheet([sheet2Headers, ...sheet2Rows]);
      ws2['!cols'] = [
        { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 22 }, { wch: 18 },
        { wch: 14 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 4 },
        ...REPORT_EXPENSE_CATEGORIES.map(() => ({ wch: 14 })),
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Лист2');

      // ── ЛИСТ3: помесячная сводка P&L за год ─────────────────
      const sheet3Headers = [
        'Месяц', 'Выручка', 'Нал', 'Безнал',
        ...REPORT_EXPENSE_CATEGORIES.map((c) => EXPENSE_TYPE_LABELS[c] ?? c),
        'Зарплата', 'Итого расходы', 'Прибыль/убыток',
      ];

      const sheet3Rows = monthly.map((m: any) => [
        m.monthName,
        parseFloat(m.totalRevenue.toFixed(2)),
        parseFloat(m.cashRevenue.toFixed(2)),
        parseFloat(m.noncashRevenue.toFixed(2)),
        ...REPORT_EXPENSE_CATEGORIES.map((cat) =>
          parseFloat(((m.byCategory[cat] ?? 0) as number).toFixed(2))
        ),
        parseFloat(m.totalSalary.toFixed(2)),
        parseFloat(m.totalCosts.toFixed(2)),
        parseFloat(m.netProfit.toFixed(2)),
      ]);

      // Итоговая строка по году
      const totals = monthly.reduce(
        (acc: any, m: any) => {
          acc.revenue       += m.totalRevenue;
          acc.cash          += m.cashRevenue;
          acc.noncash       += m.noncashRevenue;
          acc.salary        += m.totalSalary;
          acc.totalCosts    += m.totalCosts;
          acc.netProfit     += m.netProfit;
          REPORT_EXPENSE_CATEGORIES.forEach((cat) => {
            acc.byCategory[cat] = (acc.byCategory[cat] ?? 0) + (m.byCategory[cat] ?? 0);
          });
          return acc;
        },
        { revenue: 0, cash: 0, noncash: 0, salary: 0, totalCosts: 0, netProfit: 0, byCategory: {} }
      );

      sheet3Rows.push([
        `Итого ${year}`,
        parseFloat(totals.revenue.toFixed(2)),
        parseFloat(totals.cash.toFixed(2)),
        parseFloat(totals.noncash.toFixed(2)),
        ...REPORT_EXPENSE_CATEGORIES.map((cat) =>
          parseFloat(((totals.byCategory[cat] ?? 0) as number).toFixed(2))
        ),
        parseFloat(totals.salary.toFixed(2)),
        parseFloat(totals.totalCosts.toFixed(2)),
        parseFloat(totals.netProfit.toFixed(2)),
      ] as any);

      const ws3 = XLSX.utils.aoa_to_sheet([sheet3Headers, ...sheet3Rows]);
      ws3['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        ...REPORT_EXPENSE_CATEGORIES.map(() => ({ wch: 14 })),
        { wch: 12 }, { wch: 14 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws3, 'Лист3');

      const filename = `report_${dateFrom}_${dateTo}.xlsx`;
      await saveAndShareExcel(wb, filename);
    } catch (error: any) {
      console.error('Excel export error:', error);
      Alert.alert('Ошибка экспорта', error.message || 'Не удалось создать Excel файл');
    } finally {
      setExporting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === 'revenue') return 'arrow-up-circle';
    if (type === 'expense') return 'arrow-down-circle';
    return 'cash';
  };
  const getTypeColor = (type: string) => {
    if (type === 'revenue') return '#10b981';
    if (type === 'expense') return '#ef4444';
    return '#f59e0b';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Отчёты</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportExcel} disabled={exporting}>
          {exporting
            ? <ActivityIndicator size="small" color="#2563eb" />
            : <Ionicons name="download-outline" size={26} color="#2563eb" />}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Период */}
        <View style={styles.periodRow}>
          {(['today', 'week', 'month', 'quarter', 'year'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {periodNames[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Сводные карточки */}
            <View style={styles.grid}>
              <View style={styles.card}>
                <Ionicons name="trending-up" size={26} color="#10b981" />
                <Text style={styles.cardLabel}>Выручка</Text>
                <Text style={[styles.cardValue, { color: '#10b981' }]}>{fmt(summary.revenue)} ₽</Text>
                <Text style={styles.cardHint}>ставка × объём</Text>
              </View>
              <View style={styles.card}>
                <Ionicons name="receipt-outline" size={26} color="#ef4444" />
                <Text style={styles.cardLabel}>Расходы</Text>
                <Text style={[styles.cardValue, { color: '#ef4444' }]}>{fmt(summary.expenses)} ₽</Text>
                <Text style={styles.cardHint}>без зарплаты</Text>
              </View>
              <View style={styles.card}>
                <Ionicons name="people-outline" size={26} color="#f59e0b" />
                <Text style={styles.cardLabel}>Зарплата</Text>
                <Text style={[styles.cardValue, { color: '#f59e0b' }]}>{fmt(summary.salary)} ₽</Text>
                <Text style={styles.cardHint}>выплачено</Text>
              </View>
              <View style={styles.card}>
                <Ionicons name="stats-chart" size={26} color="#2563eb" />
                <Text style={styles.cardLabel}>Прибыль</Text>
                <Text style={[styles.cardValue, { color: summary.profit >= 0 ? '#2563eb' : '#ef4444' }]}>
                  {fmt(summary.profit)} ₽
                </Text>
                <Text style={styles.cardHint}>выручка − затраты</Text>
              </View>
            </View>

            {/* Нал / Безнал */}
            <View style={styles.cashRow}>
              <View style={styles.cashItem}>
                <Text style={styles.cashLabel}>💵 Нал</Text>
                <Text style={styles.cashValue}>{fmt(summary.cashRevenue)} ₽</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.cashItem}>
                <Text style={styles.cashLabel}>💳 Безнал</Text>
                <Text style={styles.cashValue}>{fmt(summary.noncashRevenue)} ₽</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.cashItem}>
                <Text style={styles.cashLabel}>📦 Себестоим.</Text>
                <Text style={[styles.cashValue, { color: '#ef4444' }]}>{fmt(summary.cost)} ₽</Text>
              </View>
            </View>

            {/* Расходы по категориям */}
            {Object.keys(summary.expByType).length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Расходы по категориям</Text>
                {Object.entries(summary.expByType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <View key={cat} style={styles.catRow}>
                      <Text style={styles.catLabel}>{EXPENSE_TYPE_LABELS[cat] ?? cat}</Text>
                      <Text style={styles.catValue}>{fmt(amount)} ₽</Text>
                    </View>
                  ))}
              </>
            )}

            {/* Кнопка экспорта */}
            <TouchableOpacity style={styles.xlsBtn} onPress={handleExportExcel} disabled={exporting}>
              {exporting
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name="document-text-outline" size={20} color="white" />}
              <Text style={styles.xlsBtnText}>
                {exporting ? 'Формируется Excel...' : 'Скачать Excel (Лист2 + Лист3)'}
              </Text>
            </TouchableOpacity>

            {/* Операции */}
            <Text style={styles.sectionTitle}>Операции</Text>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>Нет операций за период</Text>
            ) : (
              transactions.map((item) => (
                <View key={item.id} style={styles.txItem}>
                  <View style={styles.txLeft}>
                    <Ionicons name={getTypeIcon(item.type) as any} size={20} color={getTypeColor(item.type)} />
                    <View style={styles.txInfo}>
                      <Text style={styles.txDesc}>{item.description}</Text>
                      <Text style={styles.txDate}>{item.date}</Text>
                      {item.car ? <Text style={styles.txCar}>🚗 {item.car}</Text> : null}
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: item.amount > 0 ? '#10b981' : '#ef4444' }]}>
                    {item.amount > 0 ? '+' : ''}{fmt(Math.abs(item.amount))} ₽
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, marginTop: 8,
  },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  exportBtn: { padding: 8 },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 6 },
  periodBtn: {
    flex: 1, backgroundColor: '#e5e7eb', paddingVertical: 8, borderRadius: 8, alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: '#2563eb' },
  periodBtnText: { fontSize: 13, color: '#1f2937' },
  periodBtnTextActive: { color: 'white', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 14, flex: 1,
    minWidth: '45%', alignItems: 'center', elevation: 2,
  },
  cardLabel: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  cardValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  cardHint: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  cashRow: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 12,
    padding: 14, marginBottom: 16, elevation: 1, alignItems: 'center',
  },
  cashItem: { flex: 1, alignItems: 'center' },
  cashLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  cashValue: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  divider: { width: 1, height: 36, backgroundColor: '#e5e7eb' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10, marginTop: 4, color: '#1f2937' },
  catRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, marginBottom: 6,
  },
  catLabel: { fontSize: 14, color: '#374151' },
  catValue: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  xlsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16a34a', padding: 14, borderRadius: 10, marginVertical: 16, gap: 8,
  },
  xlsBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 20 },
  txItem: {
    backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  txInfo: { marginLeft: 12, flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  txDate: { fontSize: 12, color: '#6b7280' },
  txCar: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '600' },
});
