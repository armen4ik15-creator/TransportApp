import { Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen() {
  const { user, profile, signOut } = useAuth();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>
        Добро пожаловать, учредитель!
      </Text>
      <Text>{profile?.full_name || user?.email}</Text>
      <TouchableOpacity
        onPress={signOut}
        style={{ marginTop: 30, padding: 12, backgroundColor: '#dc2626', borderRadius: 8 }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}