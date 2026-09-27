import React from 'react';
import { Text, ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, fontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import type { RootStackParamList, TabParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import QuestionBankScreen from '../screens/QuestionBankScreen';
import HistoryScreen from '../screens/HistoryScreen';
import InterviewSetupScreen from '../screens/InterviewSetupScreen';
import InterviewLobbyScreen from '../screens/InterviewLobbyScreen';
import InterviewScreen from '../screens/InterviewScreen';
import VoiceInterviewScreen from '../screens/VoiceInterviewScreen';
import InterviewCompleteScreen from '../screens/InterviewCompleteScreen';
import ReportScreen from '../screens/ReportScreen';
import LoginScreen from '../screens/LoginScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '\u{1F3E0}',
    'Question Bank': '\u{1F4DA}',
    History: '\u{1F4CB}',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '\u{1F4C4}'}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.lg, fontWeight: '600' as const },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: { fontSize: fontSize.xs, fontWeight: '500' as const },
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Question Bank"
        component={QuestionBankScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'History' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isLoading, isAuthenticated, isProfileComplete } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: fontSize.lg, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OTPVerification"
            component={OTPVerificationScreen}
            options={{ title: 'Verify Email' }}
          />
        </>
      ) : !isProfileComplete ? (
        <Stack.Screen
          name="ProfileSetup"
          component={ProfileSetupScreen}
          options={{ headerShown: false, gestureEnabled: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="InterviewSetup"
            component={InterviewSetupScreen}
            options={{ title: 'Setup Interview' }}
          />
          <Stack.Screen
            name="InterviewLobby"
            component={InterviewLobbyScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="Interview"
            component={InterviewScreen}
            options={{ title: 'Interview', headerBackVisible: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="VoiceInterview"
            component={VoiceInterviewScreen}
            options={{ title: 'Voice Interview', headerBackVisible: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="InterviewComplete"
            component={InterviewCompleteScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="Report"
            component={ReportScreen}
            options={{ title: 'Report' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
