import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  addOrder,
  deactivateOrder,
  getActiveOrders,
  getArchivedOrders,
  getCustomers,
  getDrivers,
  reactivateOrder,
  updateOrder,
} from '../constants/queries';
import { useAuth } from '../context/AuthContext';

interface Order {
  id: number;
  task_name: string;
  driver_id: string;
  driver_name?: string;
  car_number: string;
  customer: string;
  material: string;
  load_address: string;
  unload_address: string;
  distance_km: number;
  unit: string;
  total_planned_volume: number | null;
  company_rate: number;
  driver_rate: number;
  sender?: string;
  receiver?: string;
  created_at: string;
  is_active: boolean;
}

type Tab = 'active' | 'archive';

export default function OrdersScreen() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('active');
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    task_name: '',
    driver_id: null as string | null,
    car_number: '',
    customer: '',
    material: '',
    load_address: '',
    unload_address: '',
    distance_km: '',
    unit: 'м3',
    total_planned_volume: '',
    company_rate: '',
    driver_rate: '',
    sender: '',
    receiver: '',
  });
  const [editFormData, setEditFormData] = useState<any>({});

  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateDriverId, setDuplicateDriverId] = useState<string | null>(null);

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [activeData, archiveData, driversData, customersData] = await Promise.all([
        getActiveOrders(),
        getArchivedOrders(),
        getDrivers(),
        getCustomers(),
      ]);
      setActiveOrders(activeData as Order[]);
      setArchivedOrders(archiveData as Order[]);
      setDrivers(driversData);
      setCustomers(customersData);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const orders = tab === 'active' ? activeOrders : archivedOrders;

  const filteredOrders = orders.filter(o => {
    if (driverFilter && o.driver_id !== driverFilter) return false;
    if (customerFilter && o.customer !== customerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !(o.task_name && o.task_name.toLowerCase().includes(q)) &&
        !(o.customer && o.customer.toLowerCase().includes(q)) &&
        !(o.material && o.material.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  const uniqueCustomers = [...new Set(orders.map(o => o.customer).filter(Boolean))].sort();

  // ── Создать задачу ──────────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    if (!formData.driver_id) { Alert.alert('Ошибка', 'Выберите водителя'); return; }
    if (!formData.customer) { Alert.alert('Ошибка', 'Выберите заказчика'); return; }
    if (!formData.material.trim()) { Alert.alert('Ошибка', 'Введите материал'); return; }
    if (!formData.load_address.trim()) { Alert.alert('Ошибка', 'Введите адрес погрузки'); return; }
    if (!formData.unload_address.trim()) { Alert.alert('Ошибка', 'Введите адрес выгрузки'); return; }
    if (!formData.distance_km) { Alert.alert('Ошибка', 'Введите расстояние'); return; }
    if (!formData.company_rate) { Alert.alert('Ошибка', 'Введите ставку компании'); return; }
    if (!formData.driver_rate) { Alert.alert('Ошибка', 'Введите ставку водителя'); return; }

    const driver = drivers.find(d => d.id === formData.driver_id);
    if (!driver) { Alert.alert('Ошибка', 'Водитель не найден'); return; }

    try {
      const created = await addOrder({
        driver_id: formData.driver_id,
        created_by: user?.id,
        car_number: driver.car_number,
        task_name: formData.task_name || null,
        customer: formData.customer,
        material: formData.material,
        load_address: formData.load_address,
        unload_address: formData.unload_address,
        distance_km: parseFloat(formData.distance_km),
        unit: formData.unit,
        total_planned_volume: formData.total_planned_volume ? parseFloat(formData.total_planned_volume) : null,
        company_rate: parseFloat(formData.company_rate),
        driver_rate: parseFloat(formData.driver_rate),
        sender: formData.sender || null,
        receiver: formData.receiver || null,
        is_active: true,
      });
      setActiveOrders([{ ...created, driver_name: driver.full_name }, ...activeOrders]);
      setModalVisible(false);
      resetForm();
      Alert.alert('Успех', 'Задача создана и назначена водителю');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message ?? 'Не удалось создать задачу');
    }
  };

  // ── Редактировать задачу ────────────────────────────────────────────────────
  const handleEditOrder = async () => {
    if (!selectedOrder) return;
    if (!editFormData.customer?.trim()) { Alert.alert('Ошибка', 'Укажите заказчика'); return; }
    if (!editFormData.material?.trim()) { Alert.alert('Ошибка', 'Укажите материал'); return; }
    try {
      const updated = await updateOrder(selectedOrder.id, {
        task_name: editFormData.task_name || null,
        customer: editFormData.customer,
        material: editFormData.material,
        load_address: editFormData.load_address,
        unload_address: editFormData.unload_address,
        distance_km: parseFloat(editFormData.distance_km) || 0,
        unit: editFormData.unit,
        total_planned_volume: editFormData.total_planned_volume ? parseFloat(editFormData.total_planned_volume) : null,
        company_rate: parseFloat(editFormData.company_rate) || 0,
        driver_rate: parseFloat(editFormData.driver_rate) || 0,
        sender: editFormData.sender || null,
        receiver: editFormData.receiver || null,
      });

      const patchList = (list: Order[]) =>
        list.map(o => o.id === selectedOrder.id ? { ...updated, driver_name: o.driver_name } : o);

      if (selectedOrder.is_active) setActiveOrders(patchList(activeOrders));
      else setArchivedOrders(patchList(archivedOrders));

      setEditModalVisible(false);
      setSelectedOrder(null);
      Alert.alert('Успех', 'Задача обновлена');
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось обновить задачу');
    }
  };

  // ── В архив ─────────────────────────────────────────────────────────────────
  const handleArchiveOrder = (order: Order) => {
    Alert.alert(
      'В архив',
      `Снять задачу "${order.task_name || order.customer}" и отправить в архив?\n\nИз архива её можно будет восстановить в любой момент.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'В архив',
          style: 'destructive',
          onPress: async () => {
            try {
              await deactivateOrder(order.id);
              setActiveOrders(activeOrders.filter(o => o.id !== order.id));
              setArchivedOrders([{ ...order, is_active: false }, ...archivedOrders]);
              Alert.alert('Готово', 'Задача перемещена в архив');
            } catch {
              Alert.alert('Ошибка', 'Не удалось отправить в архив');
            }
          },
        },
      ]
    );
  };

  // ── Восстановить из архива ───────────────────────────────────────────────────
  const handleRestoreOrder = (order: Order) => {
    Alert.alert(
      'Восстановить',
      `Вернуть задачу "${order.task_name || order.customer}" водителю ${order.driver_name || ''}?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Восстановить',
          onPress: async () => {
            try {
              const restored = await reactivateOrder(order.id);
              setArchivedOrders(archivedOrders.filter(o => o.id !== order.id));
              setActiveOrders([{ ...restored, driver_name: order.driver_name }, ...activeOrders]);
              Alert.alert('Готово', 'Задача снова активна');
            } catch {
              Alert.alert('Ошибка', 'Не удалось восстановить задачу');
            }
          },
        },
      ]
    );
  };

  // ── Дублировать ──────────────────────────────────────────────────────────────
  const handleDuplicateOrder = async () => {
    if (!selectedOrder || !duplicateDriverId) { Alert.alert('Ошибка', 'Выберите водителя'); return; }
    const driver = drivers.find(d => d.id === duplicateDriverId);
    if (!driver) return;
    try {
      const created = await addOrder({
        driver_id: duplicateDriverId,
        created_by: user?.id,
        car_number: driver.car_number,
        task_name: selectedOrder.task_name,
        customer: selectedOrder.customer,
        material: selectedOrder.material,
        load_address: selectedOrder.load_address,
        unload_address: selectedOrder.unload_address,
        distance_km: selectedOrder.distance_km,
        unit: selectedOrder.unit,
        total_planned_volume: selectedOrder.total_planned_volume,
        company_rate: selectedOrder.company_rate,
        driver_rate: selectedOrder.driver_rate,
        sender: selectedOrder.sender || null,
        receiver: selectedOrder.receiver || null,
        is_active: true,
      });
      setActiveOrders([{ ...created, driver_name: driver.full_name }, ...activeOrders]);
      setDuplicateModalVisible(false);
      setSelectedOrder(null);
      Alert.alert('Успех', 'Задача продублирована для ' + driver.full_name);
    } catch (error: any) {
      Alert.alert('Ошибка', error?.message || 'Не удалось продублировать задачу');
    }
  };

  const resetForm = () => {
    setFormData({
      task_name: '', driver_id: null, car_number: '', customer: '', material: '',
      load_address: '', unload_address: '', distance_km: '', unit: 'м3',
      total_planned_volume: '', company_rate: '', driver_rate: '', sender: '', receiver: '',
    });
  };

  const openEditModal = (order: Order) => {
    setSelectedOrder(order);
    setEditFormData({
      task_name: order.task_name,
      customer: order.customer,
      material: order.material,
      load_address: order.load_address,
      unload_address: order.unload_address,
      distance_km: order.distance_km?.toString() ?? '',
      unit: order.unit,
      total_planned_volume: order.total_planned_volume?.toString() || '',
      company_rate: order.company_rate?.toString() ?? '',
      driver_rate: order.driver_rate?.toString() ?? '',
      sender: order.sender || '',
      receiver: order.receiver || '',
    });
    setEditModalVisible(true);
  };

  // ── Карточка активной задачи ────────────────────────────────────────────────
  const renderActiveOrder = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <Text style={styles.taskName}>{item.task_name || 'Без названия'}</Text>
          <Text style={styles.orderId}>#{item.id}</Text>
        </View>
        <TouchableOpacity onPress={() => handleArchiveOrder(item)}>
          <Ionicons name="archive-outline" size={24} color="#f59e0b" />
        </TouchableOpacity>
      </View>
      <Text style={styles.customer}>Заказчик: {item.customer}</Text>
      <Text style={styles.material}>Материал: {item.material}</Text>
      <View style={styles.addressRow}>
        <Ionicons name="location" size={16} color="#6b7280" />
        <Text style={styles.address}>{item.load_address} → {item.unload_address}</Text>
      </View>
      <View style={styles.detailsRow}>
        <Text style={styles.detail}>📏 {item.distance_km} км</Text>
        <Text style={styles.detail}>⚖️ {item.unit}</Text>
        <Text style={styles.detail}>💰 {item.driver_rate} ₽/рейс</Text>
      </View>
      <View style={styles.driverInfo}>
        <Ionicons name="person" size={14} color="#6b7280" />
        <Text style={styles.driverText}>Водитель: {item.driver_name || item.driver_id}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
          <Ionicons name="pencil" size={14} color="white" />
          <Text style={styles.cardActionText}>Редактировать</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.duplicateBtn} onPress={() => {
          setSelectedOrder(item);
          setDuplicateDriverId(null);
          setDuplicateModalVisible(true);
        }}>
          <Ionicons name="copy" size={14} color="white" />
          <Text style={styles.cardActionText}>Дублировать</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Карточка архивной задачи ────────────────────────────────────────────────
  const renderArchivedOrder = ({ item }: { item: Order }) => (
    <View style={[styles.card, styles.archivedCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <Text style={[styles.taskName, { color: '#6b7280' }]}>{item.task_name || 'Без названия'}</Text>
          <Text style={styles.orderId}>#{item.id}</Text>
          <View style={styles.archiveBadge}>
            <Text style={styles.archiveBadgeText}>Архив</Text>
          </View>
        </View>
      </View>
      <Text style={styles.customer}>Заказчик: {item.customer}</Text>
      <Text style={styles.material}>Материал: {item.material}</Text>
      <View style={styles.addressRow}>
        <Ionicons name="location" size={16} color="#9ca3af" />
        <Text style={[styles.address, { color: '#9ca3af' }]}>{item.load_address} → {item.unload_address}</Text>
      </View>
      <View style={styles.detailsRow}>
        <Text style={styles.detail}>📏 {item.distance_km} км</Text>
        <Text style={styles.detail}>⚖️ {item.unit}</Text>
        <Text style={styles.detail}>💰 {item.driver_rate} ₽/рейс</Text>
      </View>
      <View style={styles.driverInfo}>
        <Ionicons name="person" size={14} color="#9ca3af" />
        <Text style={[styles.driverText, { color: '#9ca3af' }]}>Водитель: {item.driver_name || item.driver_id}</Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.restoreBtn} onPress={() => handleRestoreOrder(item)}>
          <Ionicons name="refresh" size={14} color="white" />
          <Text style={styles.cardActionText}>Восстановить</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
          <Ionicons name="pencil" size={14} color="white" />
          <Text style={styles.cardActionText}>Редактировать</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.duplicateBtn} onPress={() => {
          setSelectedOrder(item);
          setDuplicateDriverId(null);
          setDuplicateModalVisible(true);
        }}>
          <Ionicons name="copy" size={14} color="white" />
          <Text style={styles.cardActionText}>Дублировать</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Задачи</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Создать</Text>
        </TouchableOpacity>
      </View>

      {/* Вкладки Активные / Архив */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabBtnText, tab === 'active' && styles.tabBtnTextActive]}>
            ✅ Активные ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'archive' && styles.tabBtnActive]}
          onPress={() => setTab('archive')}
        >
          <Text style={[styles.tabBtnText, tab === 'archive' && styles.tabBtnTextActive]}>
            📦 Архив ({archivedOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Подсказка для архива */}
      {tab === 'archive' && (
        <View style={styles.archiveHint}>
          <Ionicons name="information-circle-outline" size={15} color="#92400e" />
          <Text style={styles.archiveHintText}>
            Задачи из архива можно восстановить — они снова станут активными для водителя.
          </Text>
        </View>
      )}

      {/* Поиск */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по заказчику, материалу..."
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

      {/* Фильтр по водителю */}
      <Text style={styles.filterLabel}>Водитель:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        <TouchableOpacity
          style={[styles.chip, driverFilter === '' && styles.chipActive]}
          onPress={() => setDriverFilter('')}
        >
          <Text style={[styles.chipText, driverFilter === '' && styles.chipTextActive]}>👥 Все</Text>
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

      {/* Фильтр по заказчику */}
      {uniqueCustomers.length > 0 && (
        <>
          <Text style={styles.filterLabel}>Заказчик:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
            <TouchableOpacity
              style={[styles.chip, customerFilter === '' && styles.chipActive]}
              onPress={() => setCustomerFilter('')}
            >
              <Text style={[styles.chipText, customerFilter === '' && styles.chipTextActive]}>🏢 Все</Text>
            </TouchableOpacity>
            {uniqueCustomers.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, customerFilter === c && styles.chipActive]}
                onPress={() => setCustomerFilter(customerFilter === c ? '' : c)}
              >
                <Text style={[styles.chipText, customerFilter === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.countLabel}>
        Показано: {filteredOrders.length} {tab === 'active' ? 'активных' : 'архивных'} задач
      </Text>

      <FlatList
        data={filteredOrders}
        renderItem={tab === 'active' ? renderActiveOrder : renderArchivedOrder}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {tab === 'active'
              ? 'Нет активных задач. Создайте задачу кнопкой "+ Создать"'
              : 'Архив пуст'}
          </Text>
        }
        refreshing={loading}
        onRefresh={loadInitialData}
      />

      {/* ── Модал создания ──────────────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            <Text style={styles.modalTitle}>Новая задача</Text>
            <TextInput style={styles.input} placeholder="Название задачи (необязательно)"
              value={formData.task_name} onChangeText={(t) => setFormData({ ...formData, task_name: t })}
              placeholderTextColor="#9ca3af" />

            <Text style={styles.label}>Водитель *</Text>
            <View style={styles.pickerContainer}>
              {drivers.map((d) => (
                <TouchableOpacity key={d.id}
                  style={[styles.pickerOption, formData.driver_id === d.id && styles.pickerOptionSelected]}
                  onPress={() => setFormData({ ...formData, driver_id: d.id, car_number: d.car_number })}>
                  <Text style={[styles.pickerText, formData.driver_id === d.id && { color: 'white' }]}>
                    {d.full_name} {d.car_number ? `(${d.car_number})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Заказчик *</Text>
            {customers.length > 0 && (
              <View style={styles.pickerContainer}>
                {customers.map((c) => (
                  <TouchableOpacity key={c}
                    style={[styles.pickerOption, formData.customer === c && styles.pickerOptionSelected]}
                    onPress={() => setFormData({ ...formData, customer: c })}>
                    <Text style={[styles.pickerText, formData.customer === c && { color: 'white' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput style={styles.input} placeholder="Введите название заказчика *"
              value={formData.customer} onChangeText={(t) => setFormData({ ...formData, customer: t })}
              placeholderTextColor="#9ca3af" />

            <TextInput style={styles.input} placeholder="Материал *" value={formData.material}
              onChangeText={(t) => setFormData({ ...formData, material: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Адрес погрузки *" value={formData.load_address}
              onChangeText={(t) => setFormData({ ...formData, load_address: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Адрес выгрузки *" value={formData.unload_address}
              onChangeText={(t) => setFormData({ ...formData, unload_address: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Расстояние (км) *" keyboardType="numeric"
              value={formData.distance_km} onChangeText={(t) => setFormData({ ...formData, distance_km: t })}
              placeholderTextColor="#9ca3af" />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Ед. изм.</Text>
                <View style={styles.unitButtons}>
                  {['м3', 'т'].map(u => (
                    <TouchableOpacity key={u} style={[styles.unitButton, formData.unit === u && styles.unitButtonActive]}
                      onPress={() => setFormData({ ...formData, unit: u })}>
                      <Text style={formData.unit === u ? { color: 'white', fontWeight: '600' } : {}}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.halfInput}>
                <TextInput style={[styles.input, { marginTop: 22 }]} placeholder="Плановый объём" keyboardType="numeric"
                  value={formData.total_planned_volume}
                  onChangeText={(t) => setFormData({ ...formData, total_planned_volume: t })}
                  placeholderTextColor="#9ca3af" />
              </View>
            </View>

            <TextInput style={styles.input} placeholder="Ставка компании (руб/ед) *" keyboardType="numeric"
              value={formData.company_rate} onChangeText={(t) => setFormData({ ...formData, company_rate: t })}
              placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Ставка водителя (руб/рейс) *" keyboardType="numeric"
              value={formData.driver_rate} onChangeText={(t) => setFormData({ ...formData, driver_rate: t })}
              placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Отправитель (необязательно)" value={formData.sender}
              onChangeText={(t) => setFormData({ ...formData, sender: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Получатель (необязательно)" value={formData.receiver}
              onChangeText={(t) => setFormData({ ...formData, receiver: t })} placeholderTextColor="#9ca3af" />

            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateOrder}>
              <Text style={styles.saveBtnText}>Создать задачу</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Модал редактирования ────────────────────────────────────────────── */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            <Text style={styles.modalTitle}>Редактировать #{selectedOrder?.id}</Text>

            <TextInput style={styles.input} placeholder="Название" value={editFormData.task_name}
              onChangeText={(t) => setEditFormData({ ...editFormData, task_name: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Заказчик" value={editFormData.customer}
              onChangeText={(t) => setEditFormData({ ...editFormData, customer: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Материал" value={editFormData.material}
              onChangeText={(t) => setEditFormData({ ...editFormData, material: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Адрес погрузки" value={editFormData.load_address}
              onChangeText={(t) => setEditFormData({ ...editFormData, load_address: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Адрес выгрузки" value={editFormData.unload_address}
              onChangeText={(t) => setEditFormData({ ...editFormData, unload_address: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Расстояние (км)" keyboardType="numeric"
              value={editFormData.distance_km}
              onChangeText={(t) => setEditFormData({ ...editFormData, distance_km: t })} placeholderTextColor="#9ca3af" />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Ед. изм.</Text>
                <View style={styles.unitButtons}>
                  {['м3', 'т'].map(u => (
                    <TouchableOpacity key={u} style={[styles.unitButton, editFormData.unit === u && styles.unitButtonActive]}
                      onPress={() => setEditFormData({ ...editFormData, unit: u })}>
                      <Text style={editFormData.unit === u ? { color: 'white', fontWeight: '600' } : {}}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.halfInput}>
                <TextInput style={[styles.input, { marginTop: 22 }]} placeholder="Плановый объём" keyboardType="numeric"
                  value={editFormData.total_planned_volume}
                  onChangeText={(t) => setEditFormData({ ...editFormData, total_planned_volume: t })}
                  placeholderTextColor="#9ca3af" />
              </View>
            </View>

            <TextInput style={styles.input} placeholder="Ставка компании" keyboardType="numeric"
              value={editFormData.company_rate}
              onChangeText={(t) => setEditFormData({ ...editFormData, company_rate: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Ставка водителя" keyboardType="numeric"
              value={editFormData.driver_rate}
              onChangeText={(t) => setEditFormData({ ...editFormData, driver_rate: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Отправитель" value={editFormData.sender}
              onChangeText={(t) => setEditFormData({ ...editFormData, sender: t })} placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} placeholder="Получатель" value={editFormData.receiver}
              onChangeText={(t) => setEditFormData({ ...editFormData, receiver: t })} placeholderTextColor="#9ca3af" />

            <TouchableOpacity style={styles.saveBtn} onPress={handleEditOrder}>
              <Text style={styles.saveBtnText}>Сохранить изменения</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Модал дублирования ─────────────────────────────────────────────── */}
      <Modal visible={duplicateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Дублировать задачу</Text>
            <Text style={{ color: '#4b5563', marginBottom: 16 }}>
              «{selectedOrder?.task_name || selectedOrder?.customer}» — скопировать для другого водителя
            </Text>
            <Text style={styles.label}>Выберите водителя *</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {drivers.map((d) => (
                <TouchableOpacity key={d.id}
                  style={[styles.pickerOption, duplicateDriverId === d.id && styles.pickerOptionSelected, { marginBottom: 8 }]}
                  onPress={() => setDuplicateDriverId(d.id)}>
                  <Text style={[styles.pickerText, duplicateDriverId === d.id && { color: 'white' }]}>
                    {d.full_name} {d.car_number ? `(${d.car_number})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, { marginTop: 16 }]} onPress={handleDuplicateOrder}>
              <Text style={styles.saveBtnText}>Создать копию</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDuplicateModalVisible(false)}>
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
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, marginTop: 8,
  },
  back: { color: '#2563eb', fontSize: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: 'white', fontWeight: '600' },

  // Tabs
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#d1d5db', backgroundColor: 'white', alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  tabBtnTextActive: { color: 'white' },

  archiveHint: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fef3c7',
    borderRadius: 8, padding: 10, marginBottom: 10, gap: 6,
    borderWidth: 1, borderColor: '#fcd34d',
  },
  archiveHintText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 17 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' },

  filterLabel: { fontSize: 12, color: '#6b7280', fontWeight: '500', marginBottom: 4 },
  filterRow: { marginBottom: 8 },
  filterRowContent: { gap: 6, paddingRight: 8 },
  chip: {
    backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: 'white', fontWeight: '600' },

  countLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginBottom: 8 },

  card: {
    backgroundColor: 'white', padding: 16, borderRadius: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#eee', elevation: 1,
  },
  archivedCard: { backgroundColor: '#fafafa', borderColor: '#e5e7eb' },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  taskName: { fontSize: 16, fontWeight: '600' },
  orderId: { fontSize: 12, color: '#6b7280' },
  archiveBadge: {
    backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  archiveBadgeText: { fontSize: 11, color: '#92400e', fontWeight: '600' },
  customer: { fontSize: 14, color: '#1f2937', marginBottom: 4 },
  material: { fontSize: 14, color: '#4b5563', marginBottom: 4 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  address: { fontSize: 13, color: '#4b5563', marginLeft: 4, flex: 1 },
  detailsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  detail: { fontSize: 12, color: '#6b7280' },
  driverInfo: { flexDirection: 'row', alignItems: 'center' },
  driverText: { fontSize: 12, color: '#6b7280', marginLeft: 4 },
  cardActions: {
    flexDirection: 'row', gap: 8, marginTop: 10,
    borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2563eb', paddingVertical: 7, borderRadius: 7, gap: 4,
  },
  duplicateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7c3aed', paddingVertical: 7, borderRadius: 7, gap: 4,
  },
  restoreBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16a34a', paddingVertical: 7, borderRadius: 7, gap: 4,
  },
  cardActionText: { color: 'white', fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#6b7280', marginTop: 40, lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalContentContainer: { padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4, marginTop: 8, color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 12, color: '#111827', backgroundColor: '#f9fafb',
  },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pickerOption: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  pickerOptionSelected: { backgroundColor: '#2563eb' },
  pickerText: { fontSize: 14, color: '#111827' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  unitButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  unitButton: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  unitButtonActive: { backgroundColor: '#2563eb' },
  saveBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8, marginTop: 4 },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },
});
