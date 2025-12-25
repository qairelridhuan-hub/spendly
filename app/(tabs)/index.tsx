import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useEffect, useState } from 'react';
import {
  Clock,
  DollarSign,
  Target,
} from 'lucide-react-native';

export default function WorkerHome() {
  // ⏱ WORK LOGIC
  const HOURLY_RATE = 10;

  const [isClockedIn, setIsClockedIn] = useState(false);
  const [workedMinutes, setWorkedMinutes] = useState(0);

  // 🎯 WEEKLY GOAL
  const WEEKLY_TARGET_HOURS = 40;

  // ⏱ TIMER SIMULATION
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isClockedIn) {
      timer = setInterval(() => {
        setWorkedMinutes(prev => prev + 1);
      }, 60000); // 1 minute = 1 minute worked
    }

    return () => clearInterval(timer);
  }, [isClockedIn]);

  // 🧮 CALCULATIONS
  const workedHours = +(workedMinutes / 60).toFixed(2);
  const weeklyProgress = Math.min(
    Math.round((workedHours / WEEKLY_TARGET_HOURS) * 100),
    100
  );

  const earnings = +(workedHours * HOURLY_RATE).toFixed(2);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F7FF' }}
      contentContainerStyle={{ padding: 16 }}
    >
      {/* 👋 HEADER */}
      <Text style={{ fontSize: 22, fontWeight: '700' }}>
        Welcome back 👋
      </Text>
      <Text style={{ color: '#6B7280', marginBottom: 20 }}>
        Your work progress updates live
      </Text>

      {/* 💰 EARNINGS */}
      <View
        style={{
          backgroundColor: '#4F46E5',
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: '#E0E7FF', fontSize: 12 }}>
          Earnings (This Week)
        </Text>

        <Text
          style={{
            color: 'white',
            fontSize: 28,
            fontWeight: '700',
            marginVertical: 6,
          }}
        >
          RM {earnings}
        </Text>

        <Text style={{ color: '#E0E7FF', fontSize: 12 }}>
          Hourly Rate: RM {HOURLY_RATE}
        </Text>
      </View>

      {/* ⏰ TODAY’S SHIFT */}
      <View
        style={{
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '600' }}>
            Today’s Shift
          </Text>
          <Clock color="#4F46E5" size={20} />
        </View>

        <Text style={{ color: '#6B7280', marginTop: 6 }}>
          Worked: {workedHours} hrs
        </Text>

        <TouchableOpacity
          onPress={() => setIsClockedIn(!isClockedIn)}
          style={{
            backgroundColor: isClockedIn ? '#DC2626' : '#16A34A',
            padding: 14,
            borderRadius: 10,
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>
            {isClockedIn ? 'Clock Out' : 'Clock In'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 🎯 WEEKLY GOAL */}
      <View
        style={{
          backgroundColor: '#FFF7ED',
          borderRadius: 16,
          padding: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Target color="#EA580C" size={20} />
          <Text style={{ marginLeft: 8, fontWeight: '600' }}>
            Weekly Goal
          </Text>
        </View>

        <Text style={{ color: '#6B7280', marginVertical: 6 }}>
          {workedHours}h / {WEEKLY_TARGET_HOURS}h
        </Text>

        <View
          style={{
            height: 10,
            backgroundColor: 'white',
            borderRadius: 999,
          }}
        >
          <View
            style={{
              width: `${weeklyProgress}%`,
              height: 10,
              backgroundColor: '#F59E0B',
              borderRadius: 999,
            }}
          />
        </View>

        <Text style={{ marginTop: 6, fontSize: 12, color: '#6B7280' }}>
          {weeklyProgress}% completed
        </Text>
      </View>
    </ScrollView>
  );
}