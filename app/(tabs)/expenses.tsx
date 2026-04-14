import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EXPENSE_TYPE_LABELS,
  addExpense,
  deleteExpense,
  getDrivers,
  getExpenses,
  updateExpense,
} from '../constants/queries';

interface Expense {
  id: number;
  exp_date: string;
  exp_type: string;
  method: 'cash' | 'noncash';
  amount: number;
  comment: string;
  car_number: string | null;
}

type PeriodFilter = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';

// Все доступные типы расходов для формы
const ALL_EXP_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'fuel_card',    label: 'Пополнение топл. карты', icon: '💳' },
  { value: 'fuel',         label: 'Топливо по карте',       icon: '⛽' },
  { value: 'repair',       label: 'Ремонт/Шиномонтаж',      icon: '🔧' },
  { value: 'parts',        label: 'Запчасти/Шины',          icon: '🔩' },
  { value: 'maintenance',  label: 'ТО и сервис',            icon: '🛠' },
  { value: 'platon',       label: 'Платон',                 icon: '🛣' },
  { value: 'wash',         label: 'Мойка',                  icon: '🚿' },
  { value: 'toll',         label: 'Платные дороги',         icon: '🏁' },
  { value: 'fine',         label: 'Штрафы',                 icon: '⚠️' },
  { value: 'lease',        label: 'Аренда/Лизинг',          icon: '🏢' },
  { value: 'bank_fee',     label: 'Банковские комиссии',    icon: '🏦' },
  { value: 'other',        label: 'Прочие расходы',         icon: '📦' },
  { value: 'salary_other', label: 'Зарплата (прочая)',      icon: '👤' },
  { value: 'dividend',     label: 'Дивиденды',              icon: '💰' },
];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  exp_date: today(),
  exp_type: '' as string,
  method: '' as 'cash' | 'noncash' | '',
  amount: '',
  car_number: '',
  comment: '',
};

function getPeriodBounds(p: PeriodFilter): { from?: string; to?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const t = fmt(now);
  switch (p) {
    case 'today': return { from: t, to: t };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { from: fmt(d), to: t };
    }
    case 'month':
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: t };
    case 'quarter': {
      const m = Math.floor(now.getMonth() / 3) * 3;
      return { from: fmt(new Date(now.getFullYear(), m, 1)), to: t };
    }
    case 'year':
      return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: t };
    default: return {};
  }
}

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'Всё', today: 'Сегодня', week: 'Неделя',
  month: 'Месяц', quarter: 'Квартал', year: 'Год',
};

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  // Фильтры
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [carFilter, setCarFilter] = useState<string>(''); // '' = все

  const [formModal, setFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [cars, setCars] = useState<{ car_number: string; driver_name: string }[]>([]);

  useEffect(() => {
    loadExpenses();
    loadCars();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await getExpenses(365);
      setExpenses(data);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить расходы');
    } finally {
      setLoading(false);
    }
  };

  const loadCars = async () => {
    try {
      const drivers = await getDrivers();
      setCars(drivers.filter((d: any) => d.car_number)
        .map((d: any) => ({ car_number: d.car_number, driver_name: d.full_name })));
    } catch (err) { console.error(err); }
  };

  // Применяем фильтры локально
  const displayedExpenses = useMemo(() => {
    const { from, to } = getPeriodBounds(periodFilter);
    return expenses.filter(e => {
      if (from && e.exp_date < from) return false;
      if (to && e.exp_date > to) return false;
      if (typeFilter !== 'all' && e.exp_type !== typeFilter) return false;
      if (carFilter && e.car_number !== carFilter) return false;
      return true;
    });
  }, [expenses, periodFilter, typeFilter, carFilter]);

  // Итоги по отфильтрованным
  const totalShown = displayedExpenses.reduce((s, e) => s + e.amount, 0);

  const openCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, exp_date: today() });
    setFormModal(true);
  };

  const openEdit = (item: Expense) => {
    setIsEditing(true);
    setEditingId(item.id);
    setForm({
      exp_date:   item.exp_date,
      exp_type:   item.exp_type,
      method:     item.method,
      amount:     item.amount.toString(),
      car_number: item.car_number ?? '',
      comment:    item.comment === '—' ? '' : item.comment,
    });
    setFormModal(true);
  };

  const handleSave = async () => {
    if (!form.exp_type) { Alert.alert('Ошибка', 'Выберите тип расхода'); return; }
    if (!form.method) { Alert.alert('Ошибка', 'Выберите способ оплаты'); return; }
    const amountNum = parseFloat(form.amount.replace(',', '.'));
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму'); return;
    }
    if (!form.exp_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Ошибка', 'Дата должна быть в формате ГГГГ-ММ-ДД'); return;
    }

    const payload = {
      exp_date: form.exp_date,
      exp_type: form.exp_type,
      method: form.method,
      amount: amountNum,
      car_number: form.car_number || null,
      comment: form.comment.trim() || '—',
    };

    try {
      if (isEditing && editingId !== null) {
        const updated = await updateExpense(editingId, payload);
        setExpenses(prev => prev.map(e => e.id === editingId ? updated : e));
        Alert.alert('Сохранено', 'Расход обновлён');
      } else {
        const created = await addExpense(payload);
        setExpenses(prev => [created, ...prev]);
        Alert.alert('Добавлено', 'Расход добавлен');
      }
      setFormModal(false);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось сохранить');
    }
  };

  const handleDelete = (item: Expense) => {
    const typeLabel = EXPENSE_TYPE_LABELS[item.exp_type] ?? item.exp_type;
    Alert.alert(
      'Удалить расход?',
      `${typeLabel} — ${item.amount.toFixed(2)} ₽ от ${item.exp_date}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(item.id);
              setExpenses(prev => prev.filter(e => e.id !== item.id));
            } catch (err: any) {
              Alert.alert('Ошибка', err.message || 'Не удалось удалить');
            }
          },
        },
      ]
    );
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const renderExpense = ({ item }: { item: Expense }) => {
    const expDef   = ALL_EXP_TYPES.find(t => t.value === item.exp_type);
    const typeIcon = expDef?.icon ?? '📦';
    const typeText = expDef?.label ?? (EXPENSE_TYPE_LABELS[item.exp_type] ?? item.exp_type);
    const methodText = item.method === 'cash' ? '💵 Нал' : '💳 Безнал';
    const carInfo = item.car_number ? `🚗 ${item.car_number}` : 'Общие';

    return (
      <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <Text style={styles.typeIcon}>{typeIcon}</Text>
            <View>
              <Text style={styles.typeText}>{typeText}</Text>
              <Text style={styles.cardSub}>{item.exp_date} · {methodText} · {carInfo}</Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.amount}>{fmt(item.amount)} ₽</Text>
            <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
        {item.comment && item.comment !== '—' ? (
          <Text style={styles.comment}>📝 {item.comment}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Расходы</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      {/* ── Фильтр: период ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {(['all', 'today', 'week', 'month', 'quarter', 'year'] as PeriodFilter[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, periodFilter === p && styles.chipActive]}
            onPress={() => setPeriodFilter(p)}
          >
            <Text style={[styles.chipText, periodFilter === p && styles.chipTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Фильтр: тип расхода ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        <TouchableOpacity
          style={[styles.chip, typeFilter === 'all' && styles.chipActive]}
          onPress={() => setTypeFilter('all')}
        >
          <Text style={[styles.chipText, typeFilter === 'all' && styles.chipTextActive]}>Все типы</Text>
        </TouchableOpacity>
        {ALL_EXP_TYPES.map(({ value, label, icon }) => (
          <TouchableOpacity
            key={value}
            style={[styles.chip, typeFilter === value && styles.chipActive]}
            onPress={() => setTypeFilter(value)}
          >
            <Text style={[styles.chipText, typeFilter === value && styles.chipTextActive]}>
              {icon} {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Фильтр: машина ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        <TouchableOpacity
          style={[styles.chip, carFilter === '' && styles.chipActive]}
          onPress={() => setCarFilter('')}
        >
          <Text style={[styles.chipText, carFilter === '' && styles.chipTextActive]}>🚛 Все машины</Text>
        </TouchableOpacity>
        {cars.map(car => (
          <TouchableOpacity
            key={car.car_number}
            style={[styles.chip, carFilter === car.car_number && styles.chipActive]}
            onPress={() => setCarFilter(car.car_number)}
          >
            <Text style={[styles.chipText, carFilter === car.car_number && styles.chipTextActive]}>
              {car.car_number}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Итоги */}
      <View style={styles.summaryBar}>
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Записей</Text>
          <Text style={[styles.sumValue, { color: '#2563eb' }]}>{displayedExpenses.length}</Text>
        </View>
        <View style={styles.sumDivider} />
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Итого расходы</Text>
          <Text style={[styles.sumValue, { color: '#ef4444' }]}>{fmt(totalShown)} ₽</Text>
        </View>
      </View>

      <Text style={styles.hint}>Нажмите — редактировать · Удерживайте — удалить</Text>

      <FlatList
        data={displayedExpenses}
        renderItem={renderExpense}
        keyExtractor={item => item.id.toString()}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadExpenses}
        ListEmptyComponent={<Text style={styles.emptyText}>Нет расходов за выбранный период</Text>}
      />

      {/* Модал создания/редактирования */}
      <Modal visible={formModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { maxHeight: '92%' }]}>
            <Text style={styles.sheetTitle}>{isEditing ? 'Редактировать расход' : 'Новый расход'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={styles.fieldLabel}>Дата (ГГГГ-ММ-ДД) *</Text>
              <TextInput
                style={styles.input}
                value={form.exp_date}
                onChangeText={v => setForm(f => ({ ...f, exp_date: v }))}
                placeholder="2026-04-01"
              />

              <Text style={styles.fieldLabel}>Тип расхода *</Text>
              <View style={styles.typeGrid}>
                {ALL_EXP_TYPES.map(({ value, label, icon }) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.typeBtn, form.exp_type === value && styles.typeBtnActive]}
                    onPress={() => setForm(f => ({ ...f, exp_type: value }))}
                  >
                    <Text style={styles.typeBtnIcon}>{icon}</Text>
                    <Text style={[styles.typeBtnText, form.exp_type === value && styles.typeBtnTextActive]}
                      numberOfLines={2}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Способ оплаты *</Text>
              <View style={styles.rowBtns}>
                {([['cash', '💵 Наличные'], ['noncash', '💳 Безнал']] as const).map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.choiceBtn, form.method === val && styles.choiceBtnActive]}
                    onPress={() => setForm(f => ({ ...f, method: val }))}
                  >
                    <Text style={[styles.choiceBtnText, form.method === val && styles.choiceBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Сумма (₽) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="numeric"
                value={form.amount}
                onChangeText={v => setForm(f => ({ ...f, amount: v }))}
              />

              <Text style={styles.fieldLabel}>Машина</Text>
              <TouchableOpacity
                style={[styles.carChip, form.car_number === '' && styles.carChipActive]}
                onPress={() => setForm(f => ({ ...f, car_number: '' }))}
              >
                <Text>Общие (без машины)</Text>
              </TouchableOpacity>
              {cars.map(car => (
                <TouchableOpacity
                  key={car.car_number}
                  style={[styles.carChip, form.car_number === car.car_number && styles.carChipActive]}
                  onPress={() => setForm(f => ({ ...f, car_number: car.car_number }))}
                >
                  <Text>🚗 {car.car_number} ({car.driver_name})</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.fieldLabel}>Комментарий</Text>
              <TextInput
                style={[styles.input, { height: 72 }]}
                placeholder="Необязательно..."
                multiline
                value={form.comment}
                onChangeText={v => setForm(f => ({ ...f, comment: v }))}
              />
            </ScrollView>

            <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>{isEditing ? 'Сохранить изменения' : 'Добавить расход'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormModal(false)}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: 'white', fontWeight: '600' },

  // Фильтры
  filterRow: { marginBottom: 6 },
  filterRowContent: { gap: 6, paddingRight: 8 },
  chip: {
    backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: 'white', fontWeight: '600' },
  typeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4,
  },
  typeBtn: {
    width: '30%', backgroundColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb',
    minHeight: 60, justifyContent: 'center',
  },
  typeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  typeBtnIcon: { fontSize: 18, marginBottom: 3 },
  typeBtnText: { fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 14 },
  typeBtnTextActive: { color: '#2563eb', fontWeight: '600' },

  // Итоги
  summaryBar: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 12,
    padding: 12, marginBottom: 6, justifyContent: 'space-around',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  sumItem: { alignItems: 'center', flex: 1 },
  sumDivider: { width: 1, backgroundColor: '#e5e7eb' },
  sumLabel: { fontSize: 11, color: '#6b7280' },
  sumValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  hint: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 8 },

  // Карточки
  card: {
    backgroundColor: 'white', padding: 14, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#eee',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  typeIcon: { fontSize: 22 },
  typeText: { fontSize: 15, fontWeight: '600' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  amount: { fontSize: 17, fontWeight: 'bold', color: '#ef4444' },
  comment: { fontSize: 12, color: '#4b5563', marginTop: 6, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 },

  // Модал
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'white', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24,
  },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: 'white',
  },
  rowBtns: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  choiceBtn: {
    flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 12,
    borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
  },
  choiceBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  choiceBtnText: { fontSize: 14, color: '#374151' },
  choiceBtnTextActive: { color: 'white', fontWeight: '600' },
  carChip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: 'white', marginBottom: 6,
  },
  carChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  saveBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },
});
