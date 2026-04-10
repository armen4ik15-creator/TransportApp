import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../constants/supabase';

export default function TripForm() {
  const { orderId, stage, unit } = useLocalSearchParams<{
    orderId: string;
    stage: string;
    unit: string;
  }>();
  const { user, profile } = useAuth();

  const [volume, setVolume] = useState('');
  const [ttnNumber, setTtnNumber] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stageText = stage === 'loading' ? 'загрузку' : 'выгрузку';

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нет доступа', 'Разрешите доступ к камере');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${Date.now()}_${ttnNumber.replace(/\s/g, '_')}.${fileExt}`;
    const filePath = `${user?.id}/${stage}/${fileName}`;

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName,
      type: `image/${fileExt}`,
    } as any);

    const { data, error } = await supabase.storage
      .from('ttn-photos')
      .upload(filePath, formData);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    const { data: publicUrlData } = supabase.storage
      .from('ttn-photos')
      .getPublicUrl(filePath);
    return publicUrlData.publicUrl;
  };

  const handleSubmit = async () => {
    const parsedVolume = parseFloat(volume.replace(',', '.'));
    if (!volume || isNaN(parsedVolume) || parsedVolume <= 0) {
      Alert.alert('Ошибка', 'Введите корректный объём');
      return;
    }
    if (!ttnNumber.trim()) {
      Alert.alert('Ошибка', 'Введите номер ТТН');
      return;
    }
    if (!user?.id) {
      Alert.alert('Ошибка', 'Пользователь не авторизован');
      return;
    }
    if (!orderId) {
      Alert.alert('Ошибка', 'Не указан ID заказа');
      return;
    }

    setLoading(true);
    try {
      let photoUrl: string | null = null;
      if (photoUri) {
        photoUrl = await uploadPhoto(photoUri);
        if (!photoUrl) {
          Alert.alert('Ошибка', 'Не удалось загрузить фото, попробуйте ещё раз');
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.from('trips').insert({
        order_id: parseInt(orderId),
        driver_id: user.id,
        car_number: profile?.car_number ?? null,
        trip_date: new Date().toISOString().split('T')[0],
        stage,
        unit,
        volume: parsedVolume,
        ttn_number: ttnNumber.trim(),
        ttn_photo_url: photoUrl,
      });

      if (error) {
        console.error('Insert error:', error);
        Alert.alert('Ошибка', error.message ?? 'Не удалось сохранить рейс');
        return;
      }

      Alert.alert('Успех', `Рейс (${stageText}) сохранён!`, [
        { text: 'ОК', onPress: () => router.replace('/(driver)') },
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Ошибка', err?.message ?? 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Фиксация {stageText}</Text>

      <TextInput
        style={styles.input}
        placeholder={`Объём (${unit})`}
        keyboardType="numeric"
        value={volume}
        onChangeText={setVolume}
      />
      <TextInput
        style={styles.input}
        placeholder="Номер ТТН"
        value={ttnNumber}
        onChangeText={setTtnNumber}
      />

      <View style={styles.photoButtons}>
        <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
          <Text style={styles.photoButtonText}>📸 Сделать фото</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
          <Text style={styles.photoButtonText}>🖼 Выбрать из галереи</Text>
        </TouchableOpacity>
      </View>

      {photoUri && (
        <Text style={styles.photoStatus}>✅ Фото выбрано</Text>
      )}

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitText}>Сохранить</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#4b5563',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  photoStatus: {
    textAlign: 'center',
    color: '#10b981',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});