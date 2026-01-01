// import { Tabs } from "expo-router";
// import {
//   Home,
//   Calendar,
//   Target,
//   DollarSign,
//   User,
// } from "lucide-react-native";

import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { CalendarProvider } from "@/lib/context";

export default function TabLayout() {
  return (
    <CalendarProvider>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Label>Home</Label>
          <Icon sf="house.fill" drawable="custom_android_drawable" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calendar">
          <Label>Calendar</Label>
          <Icon sf="calendar" drawable="custom_calendar_drawable" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="goals">
          <Label>Goals</Label>
          <Icon sf="target" drawable="custom_goals_drawable" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="earnings">
          <Label>Earnings</Label>
          <Icon sf="dollarsign.circle" drawable="custom_earnings_drawable" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <Label>Profile</Label>
          <Icon sf="person.crop.circle" drawable="custom_profile_drawable" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </CalendarProvider>
  );
}


// export default function TabsLayout() {
//   return (
//     <Tabs
//       screenOptions={{
//         headerShown: false,
//       }}
//     >
//       <Tabs.Screen
//         name="index"
//         options={{
//           title: "Home",
//           tabBarIcon: ({ color, size }) => (
//             <Home color={color} size={size} />
//           ),
//         }}
//       />

//       <Tabs.Screen
//         name="calendar"
//         options={{
//           title: "Calendar",
//           tabBarIcon: ({ color, size }) => (
//             <Calendar color={color} size={size} />
//           ),
//         }}
//       />

//       <Tabs.Screen
//         name="goals"
//         options={{
//           title: "Goals",
//           tabBarIcon: ({ color, size }) => (
//             <Target color={color} size={size} />
//           ),
//         }}
//       />

//       <Tabs.Screen
//         name="earnings"
//         options={{
//           title: "Earnings",
//           tabBarIcon: ({ color, size }) => (
//             <DollarSign color={color} size={size} />
//           ),
//         }}
//       />

//       <Tabs.Screen
//         name="profile"
//         options={{
//           title: "Profile",
//           tabBarIcon: ({ color, size }) => (
//             <User color={color} size={size} />
//           ),
//         }}
//       />
//     </Tabs>
//   );
// }
