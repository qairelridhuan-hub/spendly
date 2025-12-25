import { View, Text, TouchableOpacity } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Profile</Text>

      <TouchableOpacity style={{ marginTop: 20 }}>
        <Text style={{ color: 'red' }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}