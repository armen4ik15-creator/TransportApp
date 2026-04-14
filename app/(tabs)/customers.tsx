import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  addCustomer,
  addCustomerPayment,
  deleteCustomer,
  getCustomerPaymentHistory,
  getCustomersList,
  getCustomersWithDebt,
  updateCustomer,
} from '../constants/queries';

// ─── Типы ────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  inn: string | null;
  address: string | null;
  notes: string | null;
}
interface MergedCustomer extends Customer {
  revenue: number;
  paid: number;
  debt: number;
}

type Period = 'all' | 'month' | 'quarter' | 'year' | 'custom';

const PERIOD_LABELS: Record<Period, string> = {
  all: 'Все время',
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
  custom: 'Свой период',
};

const EMPTY_FORM = { name: '', contact_name: '', phone: '', inn: '', address: '', notes: '' };

// ─── Утилита: даты по периоду ────────────────────────────
function getPeriodBounds(
  period: Period,
  customFrom: string,
  customTo: string,
): { dateFrom?: string; dateTo?: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (period) {
    case 'month':
      return { dateFrom: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: fmt(today) };
    case 'quarter': {
      const m = Math.floor(today.getMonth() / 3) * 3;
      return { dateFrom: fmt(new Date(today.getFullYear(), m, 1)), dateTo: fmt(today) };
    }
    case 'year':
      return { dateFrom: fmt(new Date(today.getFullYear(), 0, 1)), dateTo: fmt(today) };
    case 'custom':
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    default:
      return {};
  }
}

// ─── Компонент ───────────────────────────────────────────
export default function CustomersScreen() {
  const [allCustomers, setAllCustomers] = useState<MergedCustomer[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Фильтр: период ---
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // --- Фильтр: конкретный контрагент ---
  const [customerFilter, setCustomerFilter] = useState<string>(''); // '' = все
  const [customerPickerModal, setCustomerPickerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [allNames, setAllNames] = useState<string[]>([]); // для пикера

  // --- Модалки ---
  const [detailModal, setDetailModal] = useState(false);
  const [formModal, setFormModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<MergedCustomer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);

  // Загружаем при старте и при смене периода (но НЕ при каждом нажатии клавиши для custom)
  const appliedFrom = useRef('');
  const appliedTo = useRef('');

  useEffect(() => {
    if (period !== 'custom') loadCustomers(period, '', '');
    // Для 'custom' — ждём кнопку «Применить»
  }, [period]);

  useEffect(() => {
    loadCustomers(period, appliedFrom.current, appliedTo.current);
  }, [customerFilter]);

  const applyCustomPeriod = () => {
    if (!customFrom.match(/^\d{4}-\d{2}-\d{2}$/) || !customTo.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Ошибка', 'Введите даты в формате ГГГГ-ММ-ДД\nНапример: 2026-01-01');
      return;
    }
    appliedFrom.current = customFrom;
    appliedTo.current = customTo;
    loadCustomers('custom', customFrom, customTo);
    setShowFilters(false);
  };

  const loadCustomers = async (p: Period = period, cf = appliedFrom.current, ct = appliedTo.current) => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getPeriodBounds(p, cf, ct);
      const [list, debtData] = await Promise.all([
        getCustomersList(),
        getCustomersWithDebt(dateFrom, dateTo),
      ]);

      // Индекс долгов по имени
      const debtMap: Record<string, { revenue: number; paid: number; debt: number }> = {};
      for (const d of debtData) debtMap[d.name] = d;

      // Объединяем справочник + долги
      const merged: MergedCustomer[] = list.map((c: Customer) => ({
        ...c,
        revenue: debtMap[c.name]?.revenue ?? 0,
        paid: debtMap[c.name]?.paid ?? 0,
        debt: debtMap[c.name]?.debt ?? 0,
      }));

      // Из долгов добавляем тех, кого нет в справочнике
      for (const d of debtData) {
        if (!merged.find(m => m.name === d.name)) {
          merged.push({
            id: `auto_${d.name}`,
            name: d.name,
            contact_name: null, phone: null, inn: null, address: null, notes: null,
            revenue: d.revenue, paid: d.paid, debt: d.debt,
          });
        }
      }

      setAllCustomers(merged);
      // Обновляем список имён для пикера
      setAllNames([...new Set(merged.map(c => c.name))].sort());
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить контрагентов');
    } finally {
      setLoading(false);
    }
  };

  // Применяем фильтр по имени
  const displayedCustomers = customerFilter
    ? allCustomers.filter(c => c.name === customerFilter)
    : allCustomers;

  // Итоги по отображаемым
  const totalRevenue = displayedCustomers.reduce((s, c) => s + c.revenue, 0);
  const totalPaid    = displayedCustomers.reduce((s, c) => s + c.paid, 0);
  const totalDebt    = displayedCustomers.reduce((s, c) => s + c.debt, 0);

  // ── CRUD ────────────────────────────────────────────────
  const openCreate = () => { setIsEditing(false); setForm(EMPTY_FORM); setFormModal(true); };

  const openEdit = (c: MergedCustomer) => {
    setIsEditing(true);
    setSelectedCustomer(c);
    setForm({ name: c.name, contact_name: c.contact_name ?? '', phone: c.phone ?? '',
               inn: c.inn ?? '', address: c.address ?? '', notes: c.notes ?? '' });
    setDetailModal(false);
    setFormModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Ошибка', 'Введите название'); return; }
    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        inn: form.inn.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (isEditing && selectedCustomer && !selectedCustomer.id.startsWith('auto_')) {
        await updateCustomer(selectedCustomer.id, payload);
      } else {
        await addCustomer(payload);
      }
      setFormModal(false);
      await loadCustomers();
    } catch (e: any) { Alert.alert('Ошибка', e.message || 'Не удалось сохранить'); }
  };

  const handleDelete = (c: MergedCustomer) => {
    if (c.id.startsWith('auto_')) {
      Alert.alert('Нельзя', 'Этот контрагент из заказов, удалите его из заказа');
      return;
    }
    Alert.alert('Удалить?', `"${c.name}" будет удалён из справочника`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        try {
          await deleteCustomer(c.id);
          setDetailModal(false);
          if (customerFilter === c.name) setCustomerFilter('');
          await loadCustomers();
        } catch (e: any) { Alert.alert('Ошибка', e.message); }
      }},
    ]);
  };

  // ── Оплата ──────────────────────────────────────────────
  const submitPayment = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { Alert.alert('Ошибка', 'Введите корректную сумму'); return; }
    try {
      await addCustomerPayment(selectedCustomer.name, amount, paymentComment);
      Alert.alert('Успешно', 'Платёж сохранён');
      setPaymentModal(false);
      await loadCustomers();
    } catch { Alert.alert('Ошибка', 'Не удалось сохранить платёж'); }
  };

  const openHistory = async (c: MergedCustomer) => {
    try {
      const payments = await getCustomerPaymentHistory(c.name);
      setCustomerPayments(payments);
      setDetailModal(false);
      setHistoryModal(true);
    } catch { Alert.alert('Ошибка', 'Не удалось загрузить историю'); }
  };

  // ── Helpers ─────────────────────────────────────────────
  const debtColor = (d: number) => d === 0 ? '#10b981' : d < 50000 ? '#f59e0b' : '#ef4444';
  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  // Метка активного фильтра периода
  const periodLabel = period === 'custom' && appliedFrom.current && appliedTo.current
    ? `${appliedFrom.current} — ${appliedTo.current}`
    : PERIOD_LABELS[period];

  // ── Карточка ─────────────────────────────────────────────
  const renderCustomer = ({ item }: { item: MergedCustomer }) => (
    <TouchableOpacity style={styles.card} onPress={() => { setSelectedCustomer(item); setDetailModal(true); }}>
      <View style={styles.cardRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          {item.contact_name ? <Text style={styles.subText}>👤 {item.contact_name}</Text> : null}
          {item.phone       ? <Text style={styles.subText}>📞 {item.phone}</Text> : null}
        </View>
        <View style={styles.debtBadge}>
          <Text style={[styles.debtBadgeText, { color: debtColor(item.debt) }]}>{fmt(item.debt)} ₽</Text>
          <Text style={styles.debtBadgeLabel}>долг</Text>
        </View>
      </View>
      {item.revenue > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statLabel}>Выручка</Text><Text style={styles.statValue}>{fmt(item.revenue)} ₽</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Оплачено</Text><Text style={[styles.statValue,{color:'#10b981'}]}>{fmt(item.paid)} ₽</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>Долг</Text><Text style={[styles.statValue,{color:debtColor(item.debt)}]}>{fmt(item.debt)} ₽</Text></View>
        </View>
      )}
    </TouchableOpacity>
  );

  // ── Пикер контрагентов ───────────────────────────────────
  const filteredNames = allNames.filter(n => n.toLowerCase().includes(customerSearch.toLowerCase()));

  // ══ RENDER ══════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Назад</Text></TouchableOpacity>
        <Text style={styles.title}>Контрагенты</Text>
        <TouchableOpacity onPress={openCreate}><Ionicons name="add" size={28} color="#2563eb" /></TouchableOpacity>
      </View>

      {/* ── Панель фильтров ── */}
      <View style={styles.filterBar}>
        {/* Кнопка периода */}
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name="calendar-outline" size={15} color="#2563eb" />
          <Text style={styles.filterChipText} numberOfLines={1}>{periodLabel}</Text>
          <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={13} color="#6b7280" />
        </TouchableOpacity>

        {/* Кнопка контрагента */}
        <TouchableOpacity style={[styles.filterChip, customerFilter ? styles.filterChipActive : null]}
          onPress={() => { setCustomerSearch(''); setCustomerPickerModal(true); }}>
          <Ionicons name="person-outline" size={15} color={customerFilter ? 'white' : '#2563eb'} />
          <Text style={[styles.filterChipText, customerFilter ? { color: 'white' } : null]} numberOfLines={1}>
            {customerFilter || 'Все'}
          </Text>
          {customerFilter ? (
            <TouchableOpacity onPress={() => setCustomerFilter('')} hitSlop={{top:8,right:8,bottom:8,left:8}}>
              <Ionicons name="close" size={13} color="white" />
            </TouchableOpacity>
          ) : <Ionicons name="chevron-down" size={13} color="#6b7280" />}
        </TouchableOpacity>
      </View>

      {/* Раскрывающаяся панель периода */}
      {showFilters && (
        <View style={styles.periodPanel}>
          <View style={styles.periodBtns}>
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([val, label]) => (
              <TouchableOpacity key={val}
                style={[styles.periodBtn, period === val && styles.periodBtnActive]}
                onPress={() => { setPeriod(val); if (val !== 'custom') setShowFilters(false); }}>
                <Text style={[styles.periodBtnText, period === val && styles.periodBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {period === 'custom' && (
            <>
              <View style={styles.customDates}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="С: 2026-01-01"
                  value={customFrom} onChangeText={setCustomFrom} />
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="По: 2026-12-31"
                  value={customTo} onChangeText={setCustomTo} />
              </View>
              <TouchableOpacity style={styles.applyBtn} onPress={applyCustomPeriod}>
                <Text style={styles.applyBtnText}>✓ Применить</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Сводка по выбранным */}
      <View style={styles.summaryBar}>
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Выручка</Text>
          <Text style={styles.sumValue}>{fmt(totalRevenue)} ₽</Text>
        </View>
        <View style={styles.sumDivider} />
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Оплачено</Text>
          <Text style={[styles.sumValue, { color: '#10b981' }]}>{fmt(totalPaid)} ₽</Text>
        </View>
        <View style={styles.sumDivider} />
        <View style={styles.sumItem}>
          <Text style={styles.sumLabel}>Долг</Text>
          <Text style={[styles.sumValue, { color: totalDebt > 0 ? '#ef4444' : '#10b981' }]}>{fmt(totalDebt)} ₽</Text>
        </View>
      </View>

      {/* Список */}
      <FlatList
        data={displayedCustomers}
        renderItem={renderCustomer}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={() => loadCustomers()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {customerFilter ? `Нет данных по «${customerFilter}»` : 'Контрагентов нет'}
            </Text>
            {!customerFilter && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
                <Text style={styles.emptyBtnText}>+ Добавить первого</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* ══ МОДАЛ: Пикер контрагента ══ */}
      <Modal visible={customerPickerModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '80%' }]}>
            <Text style={styles.sheetTitle}>Выберите контрагента</Text>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#9ca3af" />
              <TextInput style={styles.searchInput} placeholder="Поиск..."
                value={customerSearch} onChangeText={setCustomerSearch} autoFocus />
              {customerSearch ? (
                <TouchableOpacity onPress={() => setCustomerSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={[{ name: '', label: '— Все контрагенты —' }, ...filteredNames.map(n => ({ name: n, label: n }))]}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, customerFilter === item.name && styles.pickerItemActive]}
                  onPress={() => { setCustomerFilter(item.name); setCustomerPickerModal(false); }}
                >
                  <Text style={[styles.pickerItemText, !item.name && { color: '#6b7280', fontStyle: 'italic' }]}>
                    {item.label}
                  </Text>
                  {customerFilter === item.name && <Ionicons name="checkmark" size={18} color="#2563eb" />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.cancel} onPress={() => setCustomerPickerModal(false)}>
              <Text style={styles.cancelText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ МОДАЛ: Детали контрагента ══ */}
      <Modal visible={detailModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{selectedCustomer?.name}</Text>
            {selectedCustomer?.contact_name ? <Text style={styles.infoLine}>👤 {selectedCustomer.contact_name}</Text> : null}
            {selectedCustomer?.phone        ? <Text style={styles.infoLine}>📞 {selectedCustomer.phone}</Text> : null}
            {selectedCustomer?.inn          ? <Text style={styles.infoLine}>🏢 ИНН: {selectedCustomer.inn}</Text> : null}
            {selectedCustomer?.address      ? <Text style={styles.infoLine}>📍 {selectedCustomer.address}</Text> : null}
            {selectedCustomer?.notes        ? <Text style={styles.infoLine}>📝 {selectedCustomer.notes}</Text> : null}

            <View style={styles.statBox}>
              <View style={styles.statBoxItem}><Text style={styles.statBoxLabel}>Выручка</Text><Text style={styles.statBoxValue}>{fmt(selectedCustomer?.revenue ?? 0)} ₽</Text></View>
              <View style={styles.statBoxItem}><Text style={styles.statBoxLabel}>Оплачено</Text><Text style={[styles.statBoxValue,{color:'#10b981'}]}>{fmt(selectedCustomer?.paid ?? 0)} ₽</Text></View>
              <View style={styles.statBoxItem}><Text style={styles.statBoxLabel}>Долг</Text><Text style={[styles.statBoxValue,{color:debtColor(selectedCustomer?.debt??0)}]}>{fmt(selectedCustomer?.debt ?? 0)} ₽</Text></View>
            </View>

            <TouchableOpacity style={[styles.btn,{backgroundColor:'#10b981'}]} onPress={() => { setPaymentAmount(''); setPaymentComment(''); setDetailModal(false); setPaymentModal(true); }}>
              <Ionicons name="cash-outline" size={20} color="white" /><Text style={styles.btnText}>Внести оплату</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn,{backgroundColor:'#3b82f6'}]} onPress={() => selectedCustomer && openHistory(selectedCustomer)}>
              <Ionicons name="time-outline" size={20} color="white" /><Text style={styles.btnText}>История платежей</Text>
            </TouchableOpacity>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn,styles.btnHalf,{backgroundColor:'#f59e0b'}]} onPress={() => selectedCustomer && openEdit(selectedCustomer)}>
                <Ionicons name="pencil-outline" size={18} color="white" /><Text style={styles.btnText}>Изменить</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn,styles.btnHalf,{backgroundColor:'#ef4444'}]} onPress={() => selectedCustomer && handleDelete(selectedCustomer)}>
                <Ionicons name="trash-outline" size={18} color="white" /><Text style={styles.btnText}>Удалить</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancel} onPress={() => setDetailModal(false)}>
              <Text style={styles.cancelText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ МОДАЛ: Создать / Редактировать ══ */}
      <Modal visible={formModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { maxHeight: '90%' }]}>
            <Text style={styles.sheetTitle}>{isEditing ? 'Редактировать' : 'Новый контрагент'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Название *', key: 'name', placeholder: 'ООО «Ромашка»', kb: 'default' },
                { label: 'Контактное лицо', key: 'contact_name', placeholder: 'Иванов И.И.', kb: 'default' },
                { label: 'Телефон', key: 'phone', placeholder: '+7 (999) 000-00-00', kb: 'phone-pad' },
                { label: 'ИНН', key: 'inn', placeholder: '1234567890', kb: 'numeric' },
                { label: 'Адрес', key: 'address', placeholder: 'г. Москва, ул...', kb: 'default' },
                { label: 'Примечания', key: 'notes', placeholder: 'Доп. информация...', kb: 'default', multiline: true },
              ].map(f => (
                <View key={f.key}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, f.multiline ? { height: 72 } : null]}
                    placeholder={f.placeholder}
                    keyboardType={f.kb as any}
                    multiline={!!f.multiline}
                    value={(form as any)[f.key]}
                    onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.btn,{backgroundColor:'#2563eb',marginTop:12}]} onPress={handleSave}>
              <Text style={styles.btnText}>{isEditing ? 'Сохранить изменения' : 'Добавить контрагента'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={() => setFormModal(false)}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══ МОДАЛ: Оплата ══ */}
      <Modal visible={paymentModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Внести оплату</Text>
            <Text style={styles.sheetSubtitle}>{selectedCustomer?.name}</Text>
            <TextInput style={styles.input} placeholder="Сумма (₽)" keyboardType="numeric"
              value={paymentAmount} onChangeText={setPaymentAmount} />
            <TextInput style={[styles.input,{height:80}]} placeholder="Комментарий" multiline
              value={paymentComment} onChangeText={setPaymentComment} />
            <TouchableOpacity style={[styles.btn,{backgroundColor:'#10b981'}]} onPress={submitPayment}>
              <Text style={styles.btnText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={() => setPaymentModal(false)}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ МОДАЛ: История платежей ══ */}
      <Modal visible={historyModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.sheet,{maxHeight:'80%'}]}>
            <Text style={styles.sheetTitle}>История платежей</Text>
            <Text style={styles.sheetSubtitle}>{selectedCustomer?.name}</Text>
            <FlatList data={customerPayments} keyExtractor={i => i.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.payItem}>
                  <View style={styles.payRow}>
                    <Text style={styles.payDate}>{item.payment_date}</Text>
                    <Text style={styles.payAmount}>{fmt(item.amount)} ₽</Text>
                  </View>
                  {item.comment ? <Text style={styles.payComment}>{item.comment}</Text> : null}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Нет платежей</Text>}
            />
            <TouchableOpacity style={styles.cancel} onPress={() => setHistoryModal(false)}>
              <Text style={styles.cancelText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Стили ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },

  // Панель фильтров
  filterBar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eff6ff', padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { flex: 1, color: '#2563eb', fontWeight: '600', fontSize: 13 },

  // Панель периода
  periodPanel: { backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  periodBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  periodBtn: { backgroundColor: '#f3f4f6', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  periodBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  periodBtnText: { fontSize: 13, color: '#374151' },
  periodBtnTextActive: { color: 'white', fontWeight: '600' },
  customDates: { flexDirection: 'row', gap: 8, marginTop: 8 },
  applyBtn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  applyBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },

  // Сводка
  summaryBar: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  sumItem: { flex: 1, alignItems: 'center' },
  sumDivider: { width: 1, height: 32, backgroundColor: '#e5e7eb' },
  sumLabel: { fontSize: 11, color: '#6b7280' },
  sumValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  // Карточка
  card: { backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eee', elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  subText: { fontSize: 12, color: '#6b7280', marginBottom: 1 },
  debtBadge: { alignItems: 'flex-end' },
  debtBadgeText: { fontSize: 14, fontWeight: '700' },
  debtBadgeLabel: { fontSize: 10, color: '#9ca3af' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, backgroundColor: '#f9fafb', padding: 8, borderRadius: 8 },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { fontSize: 11, color: '#6b7280' },
  statValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  // Пустой список
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#6b7280', fontSize: 16, marginBottom: 16 },
  emptyBtn: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  emptyBtnText: { color: 'white', fontWeight: '600' },

  // Пикер контрагента
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerItemActive: { backgroundColor: '#eff6ff' },
  pickerItemText: { fontSize: 15, color: '#1f2937' },

  // Модалки
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  sheetSubtitle: { fontSize: 15, color: '#4b5563', marginBottom: 16 },
  infoLine: { fontSize: 14, color: '#374151', marginBottom: 6 },
  statBox: { flexDirection: 'row', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginVertical: 14, justifyContent: 'space-around' },
  statBoxItem: { alignItems: 'center' },
  statBoxLabel: { fontSize: 11, color: '#6b7280' },
  statBoxValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, marginBottom: 8, gap: 8 },
  btnHalf: { flex: 1 },
  btnRow: { flexDirection: 'row', gap: 8 },
  btnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  cancel: { alignItems: 'center', padding: 14 },
  cancelText: { color: '#6b7280', fontSize: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: 'white', marginBottom: 4 },
  payItem: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 8 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between' },
  payDate: { color: '#4b5563' },
  payAmount: { fontWeight: '600', color: '#10b981' },
  payComment: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
});
