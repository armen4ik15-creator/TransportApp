import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from './context/AuthContext';

export default function Index() {
  const { user, profile, isLoading } = useAuth();

  // Показываем загрузку пока не получены user и profile
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Не авторизован — на страницу входа
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Роль берём из таблицы profiles
  if (profile?.role === 'owner') {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/(driver)" />;
  }
}
