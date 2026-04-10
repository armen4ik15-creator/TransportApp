import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addDriver, getDrivers } from '../constants/queries'; // ← исправленный путь

export default function DriversScreen() {
  const [drivers, setDrivers] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [car, setCar] = useState('');
  const [loading, setLoading] = useState(false);

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
      setDrivers(data);
    } catch (error) {
      Alert.alert('Ошибка', error.message);
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
        d => d.full_name.toLowerCase().includes(query) || d.car_number.toLowerCase().includes(query)
      );
      setFilteredDrivers(filtered);
    }
  };

  const handleAddDriver = async () => {
    if (!name.trim() || !car.trim()) {
      Alert.alert('Ошибка', 'Заполните имя и номер машины');
      return;
    }
    try {
      await addDriver(name.trim(), car.trim().toUpperCase());
      setModalVisible(false);
      setName('');
      setCar('');
      loadDrivers();
      Alert.alert('Успешно', 'Водитель добавлен');
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    }
  };

  const renderDriver = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
          <Text style={styles.avatarText}>{item.full_name[0]}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.driverName}>{item.full_name}</Text>
          <View style={styles.driverCarContainer}>
            <Ionicons name="car" size={16} color="#6b7280" />
            <Text style={styles.driverCar}>{item.car_number}</Text>
          </View>
          <Text style={styles.driverId}>ID: {item.id?.slice(0, 8)}…</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Водители</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по имени или машине"
          value={searchQuery}
          onChangeText={setSearchQuery}
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
        ListEmptyComponent={<Text style={styles.emptyText}>Водители не найдены</Text>}
        refreshing={loading}
        onRefresh={loadDrivers}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Новый водитель</Text>
            <TextInput
              style={styles.input}
              placeholder="ФИО водителя"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Госномер (Т400ЕХ96)"
              value={car}
              onChangeText={setCar}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleAddDriver}>
              <Text style={styles.saveBtnText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: 'white', fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  driverCarContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  driverCar: { marginLeft: 4, fontSize: 14, color: '#4b5563' },
  driverId: { fontSize: 12, color: '#9ca3af' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  saveBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },
});