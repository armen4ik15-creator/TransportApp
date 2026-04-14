import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  addTaxPayment,
  calcUsnTax,
  deleteTaxPayment,
  getTaxPayments,
} from '../constants/queries';

const TAX_TYPE_LABELS: Record<string, string> = {
  usn:         'УСН',
  vat:         'НДС',
  social:      'Страховые взносы',
  income_tax:  'Налог на прибыль',
  property:    'Налог на имущество',
  other:       'Прочие налоги',
};

const REGIME_LABELS: Record<string, string> = {
  usn_6:  'УСН 6% (доходы)',
  usn_15: 'УСН 15% (доходы − расходы)',
  osn:    'ОСН',
  patent: 'Патент',
};

const QUARTER_NAMES = ['1 квартал', '2 квартал', '3 квартал', '4 квартал'];

const now = new Date();
const EMPTY_FORM = {
  payment_date: now.toISOString().slice(0, 10),
  tax_type: 'usn',
  period_year: now.getFullYear().toString(),
  period_quarter: '',
  amount: '',
  comment: '',
};

export default function TaxesScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [usnCalc, setUsnCalc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [formModal, setFormModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Период расчёта УСН (текущий квартал)
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const qStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1).toISOString().slice(0, 10);
  const qEnd   = now.toISOString().slice(0, 10);

  useEffect(() => {
    loadPayments();
    calcUsn();
  }, []);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await getTaxPayments(now.getFullYear());
      setPayments(data);
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось загрузить налоговые платежи');
    } finally {
      setLoading(false);
    }
  };

  const calcUsn = async () => {
    setCalcLoading(true);
    try {
      const result = await calcUsnTax(qStart, qEnd);
      setUsnCalc(result);
    } catch (err) {
      console.error('USN calc error:', err);
    } finally {
      setCalcLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.payment_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Ошибка', 'Дата в формате ГГГГ-ММ-ДД'); return;
    }
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (!form.amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму'); return;
    }
    const year = parseInt(form.period_year);
    if (isNaN(year) || year < 2020 || year > 2100) {
      Alert.alert('Ошибка', 'Введите корректный год'); return;
    }

    try {
      const payload: any = {
        payment_date: form.payment_date,
        tax_type:     form.tax_type,
        period_year:  year,
        amount,
        comment: form.comment.trim() || undefined,
      };
      if (form.period_quarter) {
        payload.period_quarter = parseInt(form.period_quarter);
      }
      const created = await addTaxPayment(payload);
      setPayments(prev => [created, ...prev]);
      setFormModal(false);
      Alert.alert('Добавлено', 'Налоговый платёж зафиксирован');
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось сохранить');
    }
  };

  const handleDelete = (item: any) => {
    Alert.alert(
      'Удалить платёж?',
      `${TAX_TYPE_LABELS[item.tax_type] ?? item.tax_type} — ${item.amount.toFixed(2)} ₽`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: async () => {
            try {
              await deleteTaxPayment(item.id);
              setPayments(prev => prev.filter(p => p.id !== item.id));
            } catch (err: any) {
              Alert.alert('Ошибка', err.message || 'Не удалось удалить');
            }
          },
        },
      ]
    );
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0);

  const totalPaid = payments.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Налоги</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setForm({ ...EMPTY_FORM }); setFormModal(true); }}
        >
          <Text style={styles.addBtnText}>+ Платёж</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Расчёт УСН */}
        <View style={styles.usnCard}>
          <Text style={styles.usnTitle}>📊 Расчёт налога</Text>
          <Text style={styles.usnPeriod}>
            Период: {qStart} — {qEnd}
          </Text>
          {calcLoading ? (
            <ActivityIndicator color="#2563eb" style={{ marginTop: 8 }} />
          ) : usnCalc ? (
            <>
              <Text style={styles.usnRegime}>
                Режим: {REGIME_LABELS[usnCalc.regime] ?? usnCalc.regime}
              </Text>
              <View style={styles.usnRow}>
                <Text style={styles.usnLabel}>Выручка:</Text>
                <Text style={styles.usnVal}>{fmt(usnCalc.revenue)} ₽</Text>
              </View>
              <View style={styles.usnRow}>
                <Text style={styles.usnLabel}>Расходы + зарплата:</Text>
                <Text style={styles.usnVal}>{fmt(usnCalc.totalCosts)} ₽</Text>
              </View>
              <View style={styles.usnRow}>
                <Text style={styles.usnLabel}>Налогооблагаемая база:</Text>
                <Text style={[styles.usnVal, { fontWeight: '700' }]}>{fmt(usnCalc.base)} ₽</Text>
              </View>
              <View style={[styles.usnRow, styles.usnTaxRow]}>
                <Text style={styles.usnTaxLabel}>
                  Налог ({usnCalc.rate}%{usnCalc.regime === 'usn_15' ? ', мин 1%' : ''}):
                </Text>
                <Text style={styles.usnTaxVal}>{fmt(usnCalc.tax)} ₽</Text>
              </View>
              <TouchableOpacity style={styles.recalcBtn} onPress={calcUsn}>
                <Text style={styles.recalcBtnText}>🔄 Пересчитать</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.usnError}>Не удалось загрузить расчёт</Text>
          )}
        </View>

        {/* Итого уплачено в текущем году */}
        <View style={styles.paidBox}>
          <Text style={styles.paidLabel}>Уплачено налогов в {now.getFullYear()} г.</Text>
          <Text style={styles.paidValue}>{fmt(totalPaid)} ₽</Text>
        </View>

        {/* Список платежей */}
        <Text style={styles.sectionTitle}>История платежей ({now.getFullYear()})</Text>

        {loading ? (
          <ActivityIndicator color="#2563eb" style={{ marginTop: 16 }} />
        ) : payments.length === 0 ? (
          <Text style={styles.emptyText}>Нет налоговых платежей за {now.getFullYear()} г.</Text>
        ) : (
          payments.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.payItem}
              onLongPress={() => handleDelete(item)}
            >
              <View style={styles.payLeft}>
                <Text style={styles.payType}>{TAX_TYPE_LABELS[item.tax_type] ?? item.tax_type}</Text>
                <Text style={styles.paySub}>
                  {item.payment_date}
                  {item.period_quarter ? ` · ${QUARTER_NAMES[item.period_quarter - 1]}` : ''}
                  {' · '}{item.period_year} г.
                </Text>
                {item.comment ? <Text style={styles.payComment}>{item.comment}</Text> : null}
              </View>
              <Text style={styles.payAmount}>{fmt(item.amount)} ₽</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Модал добавления платежа */}
      <Modal visible={formModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { maxHeight: '88%' }]}>
            <Text style={styles.sheetTitle}>Новый налоговый платёж</Text>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={styles.fieldLabel}>Дата платежа *</Text>
              <TextInput
                style={styles.input}
                value={form.payment_date}
                onChangeText={v => setForm(f => ({ ...f, payment_date: v }))}
                placeholder="ГГГГ-ММ-ДД"
              />

              <Text style={styles.fieldLabel}>Вид налога *</Text>
              <View style={styles.typeGrid}>
                {Object.entries(TAX_TYPE_LABELS).map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.typeBtn, form.tax_type === val && styles.typeBtnActive]}
                    onPress={() => setForm(f => ({ ...f, tax_type: val }))}
                  >
                    <Text style={[styles.typeBtnText, form.tax_type === val && styles.typeBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Год *</Text>
              <TextInput
                style={styles.input}
                value={form.period_year}
                onChangeText={v => setForm(f => ({ ...f, period_year: v }))}
                keyboardType="numeric"
                placeholder="2026"
              />

              <Text style={styles.fieldLabel}>Квартал (необязательно)</Text>
              <View style={styles.qRow}>
                <TouchableOpacity
                  style={[styles.qBtn, form.period_quarter === '' && styles.qBtnActive]}
                  onPress={() => setForm(f => ({ ...f, period_quarter: '' }))}
                >
                  <Text style={[styles.qBtnText, form.period_quarter === '' && styles.qBtnTextActive]}>—</Text>
                </TouchableOpacity>
                {['1', '2', '3', '4'].map(q => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.qBtn, form.period_quarter === q && styles.qBtnActive]}
                    onPress={() => setForm(f => ({ ...f, period_quarter: q }))}
                  >
                    <Text style={[styles.qBtnText, form.period_quarter === q && styles.qBtnTextActive]}>Q{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Сумма (₽) *</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={v => setForm(f => ({ ...f, amount: v }))}
                keyboardType="numeric"
                placeholder="0.00"
              />

              <Text style={styles.fieldLabel}>Комментарий</Text>
              <TextInput
                style={[styles.input, { height: 72 }]}
                value={form.comment}
                onChangeText={v => setForm(f => ({ ...f, comment: v }))}
                multiline
                placeholder="Необязательно..."
              />
            </ScrollView>

            <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Сохранить</Text>
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
    alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: 'white', fontWeight: '600' },

  usnCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 16,
    marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#2563eb', elevation: 2,
  },
  usnTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, color: '#1f2937' },
  usnPeriod: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  usnRegime: { fontSize: 13, color: '#6b7280', marginBottom: 10, fontStyle: 'italic' },
  usnRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  usnLabel: { fontSize: 13, color: '#374151' },
  usnVal: { fontSize: 13, color: '#374151' },
  usnTaxRow: { marginTop: 8, backgroundColor: '#eff6ff', borderRadius: 8, padding: 8, borderBottomWidth: 0 },
  usnTaxLabel: { fontSize: 14, fontWeight: '700', color: '#1d4ed8' },
  usnTaxVal: { fontSize: 18, fontWeight: 'bold', color: '#1d4ed8' },
  usnError: { fontSize: 13, color: '#ef4444', marginTop: 8 },
  recalcBtn: { marginTop: 10, alignSelf: 'flex-end' },
  recalcBtnText: { fontSize: 13, color: '#2563eb' },

  paidBox: {
    backgroundColor: '#ecfdf5', borderRadius: 12, padding: 14,
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  paidLabel: { fontSize: 14, color: '#065f46' },
  paidValue: { fontSize: 18, fontWeight: 'bold', color: '#065f46' },

  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#1f2937' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 20 },

  payItem: {
    backgroundColor: 'white', borderRadius: 12, padding: 14,
    marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', elevation: 1,
  },
  payLeft: { flex: 1 },
  payType: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  paySub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  payComment: { fontSize: 12, color: '#4b5563', marginTop: 2, fontStyle: 'italic' },
  payAmount: { fontSize: 16, fontWeight: 'bold', color: '#ef4444' },

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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  typeBtn: {
    backgroundColor: '#f3f4f6', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  typeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  typeBtnText: { fontSize: 13, color: '#374151' },
  typeBtnTextActive: { color: '#2563eb', fontWeight: '600' },
  qRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  qBtn: {
    flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 10,
    borderRadius: 8, alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  qBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  qBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  qBtnTextActive: { color: 'white', fontWeight: '700' },
  saveBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },
});
