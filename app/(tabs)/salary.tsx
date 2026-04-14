import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as XLSX from 'xlsx';
import { saveAndShareExcel } from '../utils/exportExcel';
import {
  addDriverPayment,
  getAllDriverPayments,
  getDriverEarnings,
  getDriverPayments,
  getDrivers,
} from '../constants/queries';

interface Driver {
  id: string;
  full_name: string;
  car_number: string;
}

interface DriverSalary {
  driver: Driver;
  earned: number;
  paid: number;
  debt: number;
}

type Period = 'month' | 'quarter' | 'year' | 'all' | 'custom';

const PERIOD_LABELS: Record<Period, string> = {
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
  all: 'Всё время',
  custom: 'Свой период',
};

function getPeriodBounds(p: Period, customFrom: string, customTo: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = fmt(now);
  switch (p) {
    case 'month':
      return { dateFrom: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: today };
    case 'quarter': {
      const m = Math.floor(now.getMonth() / 3) * 3;
      return { dateFrom: fmt(new Date(now.getFullYear(), m, 1)), dateTo: today };
    }
    case 'year':
      return { dateFrom: fmt(new Date(now.getFullYear(), 0, 1)), dateTo: today };
    case 'custom':
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    default:
      return {};
  }
}

export default function SalaryScreen() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [salaries, setSalaries] = useState<DriverSalary[]>([]);
  const [loading, setLoading] = useState(false);

  // Фильтр: период
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const appliedFrom = useRef('');
  const appliedTo = useRef('');

  // Фильтр: водитель
  const [driverFilter, setDriverFilter] = useState<string>(''); // '' = все

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [paymentType, setPaymentType] = useState<'salary' | 'advance' | 'bonus'>('salary');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedDriverHistory, setSelectedDriverHistory] = useState<any[]>([]);
  const [historyDriverName, setHistoryDriverName] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (period !== 'custom') {
      const { dateFrom, dateTo } = getPeriodBounds(period, '', '');
      loadData(dateFrom, dateTo);
    }
  }, [period]);

  const applyCustomPeriod = () => {
    if (!customFrom.match(/^\d{4}-\d{2}-\d{2}$/) || !customTo.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Ошибка', 'Введите даты в формате ГГГГ-ММ-ДД\nНапример: 2026-01-01');
      return;
    }
    appliedFrom.current = customFrom;
    appliedTo.current = customTo;
    loadData(customFrom, customTo);
    setShowCustom(false);
  };

  const loadData = async (dateFrom?: string, dateTo?: string) => {
    setLoading(true);
    try {
      const driversData = await getDrivers();
      setDrivers(driversData);

      const salaryData: DriverSalary[] = await Promise.all(
        driversData.map(async (driver: Driver) => {
          const earned = await getDriverEarnings(driver.id, dateFrom, dateTo);
          const payments = await getDriverPayments(driver.id, dateFrom, dateTo);
          const paid = payments.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
          return { driver, earned, paid, debt: earned - paid };
        })
      );
      setSalaries(salaryData);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  // Применяем фильтр по конкретному водителю
  const displayedSalaries = driverFilter
    ? salaries.filter(s => s.driver.id === driverFilter)
    : salaries;

  // Итоги по отображаемым
  const totalEarned = displayedSalaries.reduce((s, r) => s + r.earned, 0);
  const totalPaid   = displayedSalaries.reduce((s, r) => s + r.paid, 0);
  const totalDebt   = displayedSalaries.reduce((s, r) => s + r.debt, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const openPaymentModal = (driver: Driver, type: 'salary' | 'advance' | 'bonus') => {
    setSelectedDriver(driver);
    setPaymentType(type);
    setAmount('');
    setComment('');
    setModalVisible(true);
  };

  const handlePayment = async () => {
    if (!selectedDriver) return;
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму'); return;
    }
    try {
      await addDriverPayment({
        driver_id: selectedDriver.id,
        amount: amountNum,
        payment_type: paymentType,
        comment: comment.trim() || undefined,
      });
      Alert.alert('Успех', 'Платёж сохранён');
      setModalVisible(false);
      const { dateFrom, dateTo } = getPeriodBounds(period, appliedFrom.current, appliedTo.current);
      loadData(dateFrom, dateTo);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить платёж');
    }
  };

  const openHistory = async (driver: Driver) => {
    try {
      const payments = await getDriverPayments(driver.id);
      setSelectedDriverHistory(payments);
      setHistoryDriverName(driver.full_name);
      setHistoryModalVisible(true);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить историю');
    }
  };

  const getPaymentTypeName = (type: string) => {
    switch (type) {
      case 'salary': return 'Зарплата';
      case 'advance': return 'Аванс';
      case 'bonus': return 'Премия';
      default: return type;
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const summaryHeaders = ['Водитель', 'Машина', 'Заработано (руб)', 'Выплачено (руб)', 'Задолженность (руб)'];
      const summaryRows = salaries.map(s => [
        s.driver.full_name, s.driver.car_number, s.earned, s.paid, s.debt,
      ]);
      const totalRow = [
        'ИТОГО', '',
        salaries.reduce((s, r) => s + r.earned, 0),
        salaries.reduce((s, r) => s + r.paid, 0),
        salaries.reduce((s, r) => s + r.debt, 0),
      ];
      const ws1 = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows, [], totalRow]);
      ws1['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];

      const { dateFrom, dateTo } = getPeriodBounds(period, appliedFrom.current, appliedTo.current);
      const allPayments = await getAllDriverPayments(dateFrom, dateTo);
      const payHeaders = ['Дата', 'Водитель', 'Тип', 'Сумма (руб)', 'Комментарий'];
      const payRows = allPayments.map((p: any) => [
        p.payment_date, p.driver_name, getPaymentTypeName(p.payment_type), p.amount, p.comment || '',
      ]);
      const ws2 = XLSX.utils.aoa_to_sheet([payHeaders, ...payRows]);
      ws2['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 30 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Svodka');
      XLSX.utils.book_append_sheet(wb, ws2, 'Vyplaty');

      const filename = `salary_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await saveAndShareExcel(wb, filename);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось создать файл');
    } finally {
      setExporting(false);
    }
  };

  const renderSalaryCard = ({ item }: { item: DriverSalary }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.driver.full_name[0]}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.driverName}>{item.driver.full_name}</Text>
          <Text style={styles.driverCar}>{item.driver.car_number}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Заработано</Text>
          <Text style={styles.statValue}>{fmt(item.earned)} ₽</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Выплачено</Text>
          <Text style={styles.statValue}>{fmt(item.paid)} ₽</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Долг</Text>
          <Text style={[styles.statValue, item.debt > 0 ? styles.debtNegative : styles.debtZero]}>
            {fmt(item.debt)} ₽
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.salaryBtn]} onPress={() => openPaymentModal(item.driver, 'salary')}>
          <Text style={styles.actionBtnText}>Зарплата</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.advanceBtn]} onPress={() => openPaymentModal(item.driver, 'advance')}>
          <Text style={styles.actionBtnText}>Аванс</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.bonusBtn]} onPress={() => openPaymentModal(item.driver, 'bonus')}>
          <Text style={styles.actionBtnText}>Премия</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.historyBtn]} onPress={() => openHistory(item.driver)}>
          <Ionicons name="time-outline" size={16} color="white" />
          <Text style={styles.actionBtnText}>История</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Зарплата</Text>
        <TouchableOpacity onPress={handleExportExcel} disabled={exporting} style={{ padding: 4 }}>
          {exporting
            ? <ActivityIndicator size="small" color="#16a34a" />
            : <Ionicons name="download-outline" size={26} color="#16a34a" />}
        </TouchableOpacity>
      </View>

      {/* ── Фильтр: период ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {(['month', 'quarter', 'year', 'all', 'custom'] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, period === p && styles.chipActive]}
            onPress={() => {
              setPeriod(p);
              if (p === 'custom') setShowCustom(true);
            }}
          >
            <Text style={[styles.chipText, period === p && styles.chipTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Поля свой период */}
      {period === 'custom' && showCustom && (
        <View style={styles.customBox}>
          <Text style={styles.customLabel}>Свой период</Text>
          <View style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { flex: 1 }]}
              placeholder="С (ГГГГ-ММ-ДД)"
              value={customFrom}
              onChangeText={setCustomFrom}
            />
            <Text style={{ paddingHorizontal: 8, color: '#6b7280' }}>—</Text>
            <TextInput
              style={[styles.customInput, { flex: 1 }]}
              placeholder="По (ГГГГ-ММ-ДД)"
              value={customTo}
              onChangeText={setCustomTo}
            />
          </View>
          <TouchableOpacity style={styles.applyBtn} onPress={applyCustomPeriod}>
            <Text style={styles.applyBtnText}>Применить</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Фильтр: водитель ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        <TouchableOpacity
          style={[styles.chip, driverFilter === '' && styles.chipActive]}
          onPress={() => setDriverFilter('')}
        >
          <Text style={[styles.chipText, driverFilter === '' && styles.chipTextActive]}>👥 Все водители</Text>
        </TouchableOpacity>
        {drivers.map(d => (
          <TouchableOpacity
            key={d.id}
            style={[styles.chip, driverFilter === d.id && styles.chipActive]}
            onPress={() => setDriverFilter(driverFilter === d.id ? '' : d.id)}
          >
            <Text style={[styles.chipText, driverFilter === d.id && styles.chipTextActive]}>
              {d.full_name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Итоговая строка */}
      {displayedSalaries.length > 0 && (
        <View style={styles.totalBar}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Заработано</Text>
            <Text style={[styles.totalValue, { color: '#10b981' }]}>{fmt(totalEarned)} ₽</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Выплачено</Text>
            <Text style={[styles.totalValue, { color: '#2563eb' }]}>{fmt(totalPaid)} ₽</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Долг</Text>
            <Text style={[styles.totalValue, { color: totalDebt > 0 ? '#ef4444' : '#10b981' }]}>
              {fmt(totalDebt)} ₽
            </Text>
          </View>
        </View>
      )}

      <FlatList
        data={displayedSalaries}
        renderItem={renderSalaryCard}
        keyExtractor={(item) => item.driver.id}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={() => {
          const { dateFrom, dateTo } = getPeriodBounds(period, appliedFrom.current, appliedTo.current);
          loadData(dateFrom, dateTo);
        }}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
            : <Text style={styles.emptyText}>Нет данных</Text>
        }
      />

      {/* Модал выплаты */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getPaymentTypeName(paymentType)} для {selectedDriver?.full_name}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Сумма (₽)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Комментарий (необязательно)"
              multiline
              value={comment}
              onChangeText={setComment}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handlePayment}>
              <Text style={styles.saveBtnText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модал истории */}
      <Modal visible={historyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>История: {historyDriverName}</Text>
            <FlatList
              data={selectedDriverHistory}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={styles.historyRow}>
                    <Text style={styles.historyDate}>{item.payment_date}</Text>
                    <Text style={styles.historyAmount}>{fmt(item.amount)} ₽</Text>
                  </View>
                  <Text style={styles.historyType}>{getPaymentTypeName(item.payment_type)}</Text>
                  {item.comment ? <Text style={styles.historyComment}>{item.comment}</Text> : null}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Нет выплат</Text>}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setHistoryModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10, marginTop: 8,
  },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },

  filterRow: { marginBottom: 6 },
  filterRowContent: { gap: 6, paddingRight: 8 },
  chip: {
    backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: 'white', fontWeight: '600' },

  customBox: {
    backgroundColor: 'white', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb',
  },
  customLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  customRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  customInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 10, fontSize: 14, backgroundColor: '#f9fafb',
  },
  applyBtn: {
    backgroundColor: '#2563eb', padding: 10, borderRadius: 8, alignItems: 'center',
  },
  applyBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },

  totalBar: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 12,
    padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb',
  },
  totalItem: { flex: 1, alignItems: 'center' },
  totalDivider: { width: 1, backgroundColor: '#e5e7eb' },
  totalLabel: { fontSize: 11, color: '#6b7280' },
  totalValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },

  card: {
    backgroundColor: 'white', padding: 16, borderRadius: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#eee',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  driverCar: { fontSize: 13, color: '#6b7280' },

  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 12,
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 11, color: '#6b7280' },
  statValue: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  debtNegative: { color: '#ef4444' },
  debtZero: { color: '#10b981' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, flex: 1, minWidth: 72,
  },
  salaryBtn: { backgroundColor: '#2563eb' },
  advanceBtn: { backgroundColor: '#f59e0b' },
  bonusBtn: { backgroundColor: '#10b981' },
  historyBtn: { backgroundColor: '#6b7280' },
  actionBtnText: { color: 'white', fontSize: 12, fontWeight: '600', marginLeft: 3 },

  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 12,
  },
  saveBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },

  historyItem: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyDate: { color: '#4b5563' },
  historyAmount: { fontWeight: '600', color: '#10b981' },
  historyType: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  historyComment: { fontSize: 12, color: '#9ca3af' },
});
