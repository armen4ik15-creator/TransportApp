import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as XLSX from 'xlsx';
import { getDrivers, getRegistryDataV2 } from '../constants/queries';
import { saveAndShareExcel } from '../utils/exportExcel';

export default function RegistryScreen() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [registryType, setRegistryType] = useState<'all' | 'by_car'>('all');
  const [cars, setCars] = useState<{ car_number: string; driver_name: string }[]>([]);
  const [selectedCar, setSelectedCar] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadCars(); }, []);

  const loadCars = async () => {
    try {
      const drivers = await getDrivers();
      setCars(
        drivers
          .filter((d: any) => d.car_number)
          .map((d: any) => ({ car_number: d.car_number, driver_name: d.full_name }))
      );
    } catch (error) {
      console.error('Error loading cars:', error);
    }
  };

  const setQuickPeriod = (days: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days + 1);
    setDateFrom(start.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  };

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
      Alert.alert('Ошибка', 'Укажите период (ГГГГ-ММ-ДД)');
      return;
    }
    if (registryType === 'by_car' && !selectedCar) {
      Alert.alert('Ошибка', 'Выберите машину');
      return;
    }

    setLoading(true);
    try {
      const data = await getRegistryDataV2(
        dateFrom,
        dateTo,
        registryType === 'by_car' ? selectedCar : undefined
      );

      if (data.length === 0) {
        Alert.alert('Нет данных', 'За выбранный период нет рейсов');
        return;
      }

      // ── Лист1: формат как в образце ──────────────────────────
      const headers = [
        'Дата',
        'Номер ТН',
        'Номер Машины',
        'ФИО водителя',
        'Материал',
        'Контрагент',
        'Погрузка',
        'Выгрузка',
        'Плечо',
        'Ставка водителя',
        'Ставка за м3-т',
        'Единица Измерения',
        'Всего',
        'Сумма',
        'Нал',
      ];

      const rows = data.map((item: any) => [
        item.trip_date,
        item.ttn_number,
        item.car_number,
        item.driver_name,
        item.material,
        item.customer,
        item.load_address,
        item.unload_address,
        item.distance_km,
        item.driver_rate,
        item.company_rate,
        item.unit,
        item.volume,
        parseFloat((item.company_rate * item.volume).toFixed(2)),
        item.payment_method === 'cash' ? 'Да' : '',
      ]);

      // Итоговая строка
      const totalVolume  = data.reduce((s: number, r: any) => s + (r.volume ?? 0), 0);
      const totalRevenue = data.reduce((s: number, r: any) => s + (r.company_rate ?? 0) * (r.volume ?? 0), 0);
      const totalCash    = data.reduce((s: number, r: any) =>
        s + (r.payment_method === 'cash' ? (r.company_rate ?? 0) * (r.volume ?? 0) : 0), 0);

      const totalsRow = [
        `Итого (${data.length} рейсов)`, '', '', '', '', '', '', '', '', '', '',
        '',
        parseFloat(totalVolume.toFixed(3)),
        parseFloat(totalRevenue.toFixed(2)),
        parseFloat(totalCash.toFixed(2)),
      ];

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, [], totalsRow]);

      // Ширины столбцов
      ws['!cols'] = [
        { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
        { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 8 },
        { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 6 },
      ];

      const wb = XLSX.utils.book_new();
      const sheetName = registryType === 'by_car' ? `Лист1_${selectedCar}` : 'Лист1';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const filename = `registry_${dateFrom}_${dateTo}${registryType === 'by_car' ? '_' + selectedCar : ''}.xlsx`;
      await saveAndShareExcel(wb, filename);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Ошибка', error.message || 'Не удалось сформировать реестр');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Реестр</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Быстрый выбор */}
        <Text style={styles.label}>Быстрый выбор периода</Text>
        <View style={styles.quickButtons}>
          {[
            { label: 'Сегодня', days: 1 },
            { label: '7 дней', days: 7 },
            { label: '30 дней', days: 30 },
            { label: '90 дней', days: 90 },
          ].map(btn => (
            <TouchableOpacity key={btn.days} style={styles.quickBtn} onPress={() => setQuickPeriod(btn.days)}>
              <Text style={styles.quickBtnText}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Период вручную */}
        <Text style={styles.label}>Дата С (ГГГГ-ММ-ДД)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-04-01"
          value={dateFrom}
          onChangeText={setDateFrom}
        />

        <Text style={styles.label}>Дата ПО (ГГГГ-ММ-ДД)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-04-30"
          value={dateTo}
          onChangeText={setDateTo}
        />

        {/* Тип реестра */}
        <Text style={styles.label}>Тип реестра</Text>
        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={[styles.choiceBtn, registryType === 'all' && styles.choiceBtnActive]}
            onPress={() => setRegistryType('all')}
          >
            <Text style={[styles.choiceBtnText, registryType === 'all' && styles.choiceBtnTextActive]}>
              📊 Общий
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choiceBtn, registryType === 'by_car' && styles.choiceBtnActive]}
            onPress={() => setRegistryType('by_car')}
          >
            <Text style={[styles.choiceBtnText, registryType === 'by_car' && styles.choiceBtnTextActive]}>
              🚚 По машине
            </Text>
          </TouchableOpacity>
        </View>

        {/* Выбор машины */}
        {registryType === 'by_car' && (
          <>
            <Text style={styles.label}>Выберите машину</Text>
            {cars.length === 0 ? (
              <Text style={styles.emptyText}>Нет машин</Text>
            ) : (
              cars.map(car => (
                <TouchableOpacity
                  key={car.car_number}
                  style={[styles.carOption, selectedCar === car.car_number && styles.carOptionActive]}
                  onPress={() => setSelectedCar(car.car_number)}
                >
                  <Text style={selectedCar === car.car_number ? styles.carOptionTextActive : styles.carOptionText}>
                    🚛 {car.car_number}
                  </Text>
                  <Text style={styles.carDriver}>{car.driver_name}</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        {/* Кнопка экспорта */}
        <TouchableOpacity
          style={[styles.exportBtn, loading && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : (
              <>
                <Text style={styles.exportBtnIcon}>📥</Text>
                <Text style={styles.exportBtnText}>Скачать реестр Excel (.xlsx)</Text>
              </>
            )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Файл откроется в Excel, Google Таблицах или любом совместимом приложении
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 15, fontWeight: '500', marginTop: 16, marginBottom: 8, color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  quickButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  quickBtn: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  quickBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  rowButtons: { flexDirection: 'row', gap: 12 },
  choiceBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  choiceBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  choiceBtnText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  choiceBtnTextActive: { color: 'white' },
  carOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  carOptionActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  carOptionText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  carOptionTextActive: { fontSize: 15, color: '#2563eb', fontWeight: '600' },
  carDriver: { fontSize: 13, color: '#6b7280' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 12,
    gap: 8,
  },
  exportBtnDisabled: { backgroundColor: '#9ca3af' },
  exportBtnIcon: { fontSize: 20 },
  exportBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 8 },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 40,
  },
});
