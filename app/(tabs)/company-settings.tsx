import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getCompanySettings, upsertCompanySettings } from '../constants/queries';

const TAX_REGIMES = [
  { value: 'usn_6',  label: 'УСН 6%\n(доходы)' },
  { value: 'usn_15', label: 'УСН 15%\n(доходы-расходы)' },
  { value: 'osn',    label: 'ОСН' },
  { value: 'patent', label: 'Патент' },
];

const EMPTY: Record<string, string> = {
  company_name: '',
  inn: '', kpp: '', ogrn: '',
  tax_regime: 'usn_15',
  usn_rate: '',
  vat_rate: '20',
  has_vat: 'false',
  social_rate: '30.2',
  bank_name: '', bik: '', account: '', corr_account: '',
  legal_address: '', actual_address: '',
  director_name: '', accountant_name: '',
  phone: '', email: '',
};

export default function CompanySettingsScreen() {
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getCompanySettings();
      if (data) {
        setForm({
          company_name:    data.company_name ?? '',
          inn:             data.inn ?? '',
          kpp:             data.kpp ?? '',
          ogrn:            data.ogrn ?? '',
          tax_regime:      data.tax_regime ?? 'usn_15',
          usn_rate:        data.usn_rate != null ? String(data.usn_rate) : '',
          vat_rate:        data.vat_rate != null ? String(data.vat_rate) : '20',
          has_vat:         String(data.has_vat ?? false),
          social_rate:     data.social_rate != null ? String(data.social_rate) : '30.2',
          bank_name:       data.bank_name ?? '',
          bik:             data.bik ?? '',
          account:         data.account ?? '',
          corr_account:    data.corr_account ?? '',
          legal_address:   data.legal_address ?? '',
          actual_address:  data.actual_address ?? '',
          director_name:   data.director_name ?? '',
          accountant_name: data.accountant_name ?? '',
          phone:           data.phone ?? '',
          email:           data.email ?? '',
        });
      }
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      Alert.alert('Ошибка', 'Введите название компании'); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        company_name:    form.company_name.trim(),
        inn:             form.inn.trim() || null,
        kpp:             form.kpp.trim() || null,
        ogrn:            form.ogrn.trim() || null,
        tax_regime:      form.tax_regime,
        usn_rate:        form.usn_rate ? parseFloat(form.usn_rate) : null,
        vat_rate:        form.vat_rate ? parseFloat(form.vat_rate) : 20,
        has_vat:         form.has_vat === 'true',
        social_rate:     form.social_rate ? parseFloat(form.social_rate) : 30.2,
        bank_name:       form.bank_name.trim() || null,
        bik:             form.bik.trim() || null,
        account:         form.account.trim() || null,
        corr_account:    form.corr_account.trim() || null,
        legal_address:   form.legal_address.trim() || null,
        actual_address:  form.actual_address.trim() || null,
        director_name:   form.director_name.trim() || null,
        accountant_name: form.accountant_name.trim() || null,
        phone:           form.phone.trim() || null,
        email:           form.email.trim() || null,
      };
      await upsertCompanySettings(payload);
      Alert.alert('Сохранено', 'Настройки компании обновлены');
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const f = (key: string) => form[key] ?? '';
  const set = (key: string) => (v: string) => setForm(p => ({ ...p, [key]: v }));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Настройки компании</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Общие реквизиты */}
          <Text style={styles.sectionHeader}>🏢 Реквизиты</Text>
          <View style={styles.section}>
            <Text style={styles.label}>Название компании *</Text>
            <TextInput style={styles.input} value={f('company_name')} onChangeText={set('company_name')} placeholder="ООО Моя компания" />

            <Text style={styles.label}>ИНН</Text>
            <TextInput style={styles.input} value={f('inn')} onChangeText={set('inn')} placeholder="1234567890" keyboardType="numeric" />

            <Text style={styles.label}>КПП</Text>
            <TextInput style={styles.input} value={f('kpp')} onChangeText={set('kpp')} placeholder="123456789" keyboardType="numeric" />

            <Text style={styles.label}>ОГРН / ОГРНИП</Text>
            <TextInput style={styles.input} value={f('ogrn')} onChangeText={set('ogrn')} placeholder="1234567890123" keyboardType="numeric" />

            <Text style={styles.label}>Директор</Text>
            <TextInput style={styles.input} value={f('director_name')} onChangeText={set('director_name')} placeholder="Иванов Иван Иванович" />

            <Text style={styles.label}>Главный бухгалтер</Text>
            <TextInput style={styles.input} value={f('accountant_name')} onChangeText={set('accountant_name')} placeholder="Петрова Мария Ивановна" />

            <Text style={styles.label}>Телефон</Text>
            <TextInput style={styles.input} value={f('phone')} onChangeText={set('phone')} placeholder="+7 (999) 123-45-67" keyboardType="phone-pad" />

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={f('email')} onChangeText={set('email')} placeholder="company@example.com" keyboardType="email-address" />
          </View>

          {/* Налоговый режим */}
          <Text style={styles.sectionHeader}>📋 Налогообложение</Text>
          <View style={styles.section}>
            <Text style={styles.label}>Налоговый режим</Text>
            <View style={styles.regimeGrid}>
              {TAX_REGIMES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.regimeBtn, f('tax_regime') === r.value && styles.regimeBtnActive]}
                  onPress={() => set('tax_regime')(r.value)}
                >
                  <Text style={[styles.regimeBtnText, f('tax_regime') === r.value && styles.regimeBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(f('tax_regime') === 'usn_6' || f('tax_regime') === 'usn_15') && (
              <>
                <Text style={styles.label}>
                  Ставка УСН (%, по умолчанию {f('tax_regime') === 'usn_6' ? '6' : '15'})
                </Text>
                <TextInput
                  style={styles.input}
                  value={f('usn_rate')}
                  onChangeText={set('usn_rate')}
                  keyboardType="decimal-pad"
                  placeholder={f('tax_regime') === 'usn_6' ? '6' : '15'}
                />
              </>
            )}

            <Text style={styles.label}>Ставка страховых взносов с ФОТ (%)</Text>
            <TextInput
              style={styles.input}
              value={f('social_rate')}
              onChangeText={set('social_rate')}
              keyboardType="decimal-pad"
              placeholder="30.2"
            />

            <Text style={styles.label}>Плательщик НДС</Text>
            <View style={styles.boolRow}>
              {[['false', 'Нет'], ['true', 'Да']].map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.boolBtn, f('has_vat') === val && styles.boolBtnActive]}
                  onPress={() => set('has_vat')(val)}
                >
                  <Text style={[styles.boolBtnText, f('has_vat') === val && styles.boolBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {f('has_vat') === 'true' && (
              <>
                <Text style={styles.label}>Ставка НДС (%)</Text>
                <TextInput
                  style={styles.input}
                  value={f('vat_rate')}
                  onChangeText={set('vat_rate')}
                  keyboardType="decimal-pad"
                  placeholder="20"
                />
              </>
            )}
          </View>

          {/* Банковские реквизиты */}
          <Text style={styles.sectionHeader}>🏦 Банковские реквизиты</Text>
          <View style={styles.section}>
            <Text style={styles.label}>Банк</Text>
            <TextInput style={styles.input} value={f('bank_name')} onChangeText={set('bank_name')} placeholder="ПАО Сбербанк" />

            <Text style={styles.label}>БИК</Text>
            <TextInput style={styles.input} value={f('bik')} onChangeText={set('bik')} placeholder="044525225" keyboardType="numeric" />

            <Text style={styles.label}>Расчётный счёт</Text>
            <TextInput style={styles.input} value={f('account')} onChangeText={set('account')} placeholder="40702810000000000000" keyboardType="numeric" />

            <Text style={styles.label}>Корр. счёт</Text>
            <TextInput style={styles.input} value={f('corr_account')} onChangeText={set('corr_account')} placeholder="30101810000000000225" keyboardType="numeric" />
          </View>

          {/* Адреса */}
          <Text style={styles.sectionHeader}>📍 Адреса</Text>
          <View style={styles.section}>
            <Text style={styles.label}>Юридический адрес</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              value={f('legal_address')} onChangeText={set('legal_address')}
              placeholder="123456, г. Москва, ул. Примерная, д. 1"
              multiline
            />

            <Text style={styles.label}>Фактический адрес</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              value={f('actual_address')} onChangeText={set('actual_address')}
              placeholder="Совпадает с юридическим"
              multiline
            />
          </View>

          {/* Кнопка сохранения */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="white" />
              : <Text style={styles.saveBtnText}>💾 Сохранить настройки</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  title: { fontSize: 18, fontWeight: 'bold' },
  sectionHeader: {
    fontSize: 15, fontWeight: '700', color: '#1f2937',
    marginTop: 16, marginBottom: 8,
  },
  section: {
    backgroundColor: 'white', borderRadius: 12, padding: 14,
    marginBottom: 4, elevation: 1,
  },
  label: {
    fontSize: 13, fontWeight: '500', color: '#374151',
    marginBottom: 6, marginTop: 10,
  },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 11, fontSize: 15, backgroundColor: 'white',
  },
  regimeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  regimeBtn: {
    backgroundColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb',
    minWidth: '45%', alignItems: 'center',
  },
  regimeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  regimeBtnText: { fontSize: 12, color: '#374151', textAlign: 'center' },
  regimeBtnTextActive: { color: '#2563eb', fontWeight: '600' },
  boolRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  boolBtn: {
    flex: 1, backgroundColor: '#f3f4f6', paddingVertical: 10,
    borderRadius: 8, alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  boolBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  boolBtnText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  boolBtnTextActive: { color: 'white', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#2563eb', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 20, elevation: 2,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
