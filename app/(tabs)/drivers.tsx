import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDrivers, updateDriverCarNumber } from '../constants/queries';

type Driver = {
  id: string;
  full_name: string | null;
  car_number: string | null;
  role: string | null;
};

export default function DriversScreen() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit-car modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [editCar, setEditCar] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [searchQuery, drivers]);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const data = await getDrivers();
      setDrivers(data as Driver[]);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message ?? 'Не удалось загрузить водителей');
    } finally {
      setLoading(false);
    }
  };

  const filterDrivers = () => {
    if (!searchQuery.trim()) {
      setFilteredDrivers(drivers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = drivers.filter(
        d =>
          (d.full_name ?? '').toLowerCase().includes(query) ||
          (d.car_number ?? '').toLowerCase().includes(query)
      );
      setFilteredDrivers(filtered);
    }
  };

  const openEditModal = (driver: Driver) => {
    setEditDriver(driver);
    setEditCar(driver.car_number ?? '');
    setEditModalVisible(true);
  };

  const handleSaveCar = async () => {
    if (!editCar.trim()) {
      Alert.alert('Ошибка', 'Введите госномер автомобиля');
      return;
    }
    if (!editDriver) return;
    setSaving(true);
    try {
      await updateDriverCarNumber(editDriver.id, editCar.trim());
      setEditModalVisible(false);
      setEditDriver(null);
      setEditCar('');
      await loadDrivers();
      Alert.alert('Готово', 'Номер машины обновлён');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const renderDriver = ({ item }: { item: Driver }) => {
    // Safe first letter: handle null, undefined, and empty string
    const firstLetter = (item.full_name?.trim()?.[0] ?? '?').toUpperCase();

    return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.driverName}>{item.full_name ?? '—'}</Text>
          <View style={styles.driverCarContainer}>
            <Ionicons name="car" size={16} color="#6b7280" />
            {item.car_number ? (
              <Text style={styles.driverCar}>{item.car_number}</Text>
            ) : (
              <Text style={[styles.driverCar, styles.noCar]}>не указан</Text>
            )}
          </View>
          <Text style={styles.driverId}>ID: {item.id?.slice(0, 8)}…</Text>
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openEditModal(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Водители</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
        <Text style={styles.infoText}>
          Водители регистрируются самостоятельно. Нажмите ✏️ чтобы назначить или изменить номер машины.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по имени или машине"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filteredDrivers}
        renderItem={renderDriver}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2563eb" />
          ) : (
            <Text style={styles.emptyText}>Водители не найдены</Text>
          )
        }
        refreshing={loading}
        onRefresh={loadDrivers}
      />

      {/* Edit car number modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Номер автомобиля</Text>
            {editDriver && (
              <Text style={styles.modalDriverName}>{editDriver.full_name}</Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="Госномер (Т400ЕХ96)"
              value={editCar}
              onChangeText={setEditCar}
              autoCapitalize="characters"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving && { backgroundColor: '#93c5fd' }]}
              onPress={handleSaveCar}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Сохранить</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setEditModalVisible(false); setEditDriver(null); setEditCar(''); }}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Отмена</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  driverCarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  driverCar: { marginLeft: 4, fontSize: 14, color: '#4b5563' },
  noCar: { color: '#ef4444', fontStyle: 'italic' },
  driverId: { fontSize: 12, color: '#9ca3af' },
  editBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  modalDriverName: { fontSize: 15, color: '#6b7280', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },
});
