import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { getDrivers, getRegistryData } from '../constants/queries';

export default function RegistryScreen() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [registryType, setRegistryType] = useState<'all' | 'by_car'>('all');
  const [cars, setCars] = useState<{ car_number: string; driver_name: string }[]>([]);
  const [selectedCar, setSelectedCar] = useState('');
  const [loading, setLoading] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadCars();
  }, []);

  const loadCars = async () => {
    try {
      const drivers = await getDrivers();
      const carsList = drivers
        .filter(d => d.car_number)
        .map(d => ({ car_number: d.car_number, driver_name: d.full_name }));
      setCars(carsList);
    } catch (error) {
      console.error('Error loading cars:', error);
    }
  };

  const handleExport = async () => {
    if (!dateFrom || !dateTo) {
      Alert.alert('Ошибка', 'Укажите период (даты в формате ГГГГ-ММ-ДД)');
      return;
    }
    if (registryType === 'by_car' && !selectedCar) {
      Alert.alert('Ошибка', 'Выберите машину');
      return;
    }

    setLoading(true);
    try {
      const data = await getRegistryData(
        dateFrom,
        dateTo,
        registryType === 'by_car' ? selectedCar : undefined
      );

      if (data.length === 0) {
        Alert.alert('Нет данных', 'За выбранный период нет рейсов');
        setLoading(false);
        return;
      }

      const headers = [
        'Дата', 'Номер ТТН', 'Машина', 'Водитель', 'Материал', 'Заказчик',
        'Отправитель', 'Получатель', 'Погрузка', 'Выгрузка', 'Расстояние (км)',
        'Ед. изм.', 'Объём', 'Ставка водителя', 'Ставка компании', 'Выручка',
      ];
      const rows = data.map(item => [
        item.trip_date,
        item.ttn_number,
        item.car_number,
        item.driver_name,
        item.material,
        item.customer,
        item.sender || '',
        item.receiver || '',
        item.load_address,
        item.unload_address,
        item.distance_km,
        item.unit,
        item.volume,
        item.driver_rate,
        item.company_rate,
        (item.company_rate * item.volume).toFixed(2),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      setCsvContent(csv);
      setModalVisible(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Ошибка', 'Не удалось сформировать реестр');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await Share.share({
        message: csvContent,
        title: 'Реестр',
      });
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось поделиться');
    }
  };

  const setQuickPeriod = (days: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days + 1);
    setDateFrom(start.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
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
        <Text style={styles.label}>Быстрый выбор периода</Text>
        <View style={styles.quickButtons}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setQuickPeriod(1)}>
            <Text>Сегодня</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setQuickPeriod(7)}>
            <Text>7 дней</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setQuickPeriod(30)}>
            <Text>30 дней</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setQuickPeriod(90)}>
            <Text>90 дней</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Дата ОТ (ГГГГ-ММ-ДД)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-03-01"
          value={dateFrom}
          onChangeText={setDateFrom}
        />

        <Text style={styles.label}>Дата ДО (ГГГГ-ММ-ДД)</Text>
        <TextInput
          style={styles.input}
          placeholder="2026-03-31"
          value={dateTo}
          onChangeText={setDateTo}
        />

        <Text style={styles.label}>Тип реестра</Text>
        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={[styles.choiceButton, registryType === 'all' && styles.selectedButton]}
            onPress={() => setRegistryType('all')}
          >
            <Text>📊 Общий</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choiceButton, registryType === 'by_car' && styles.selectedButton]}
            onPress={() => setRegistryType('by_car')}
          >
            <Text>🚚 По машине</Text>
          </TouchableOpacity>
        </View>

        {registryType === 'by_car' && (
          <>
            <Text style={styles.label}>Выберите машину</Text>
            <View style={styles.carsList}>
              {cars.map(car => (
                <TouchableOpacity
                  key={car.car_number}
                  style={[styles.carOption, selectedCar === car.car_number && styles.selectedCar]}
                  onPress={() => setSelectedCar(car.car_number)}
                >
                  <Text>{car.car_number} ({car.driver_name})</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.exportButton, loading && styles.disabledButton]}
          onPress={handleExport}
          disabled={loading}
        >
          <Text style={styles.exportButtonText}>
            {loading ? 'Генерация...' : '📑 Сформировать реестр'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Реестр (CSV)</Text>
            <ScrollView style={styles.csvContainer}>
              <Text selectable style={styles.csvText}>
                {csvContent}
              </Text>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={copyToClipboard}>
                <Text style={styles.modalButtonText}>📤 Поделиться</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.closeButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Закрыть</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  back: {
    color: '#2563eb',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  quickButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  quickBtn: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  choiceButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#2563eb',
  },
  carsList: {
    marginTop: 8,
    maxHeight: 200,
  },
  carOption: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedCar: {
    backgroundColor: '#e0f2fe',
    borderColor: '#2563eb',
  },
  exportButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  csvContainer: {
    maxHeight: 400,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
  },
  csvText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#1f2937',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#e5e7eb',
  },
  closeButtonText: {
    color: '#1f2937',
    fontWeight: '600',
  },
});