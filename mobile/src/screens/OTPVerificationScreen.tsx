import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { verifyOTP, requestOTP } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPVerification'>;

export default function OTPVerificationScreen({ route }: Props) {
  const { email } = route.params;
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      handleVerify(digits);
    }
  }

  async function handleVerify(otpCode: string) {
    setLoading(true);
    try {
      const tokens = await verifyOTP(email, otpCode);
      await login(tokens);
    } catch (err: any) {
      setCode('');
      Alert.alert('Error', err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await requestOTP(email);
      setCooldown(60);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resend code');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.desc}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>

          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            placeholder="000000"
            placeholderTextColor={colors.textLight}
          />

          {loading && <Text style={styles.verifying}>Verifying...</Text>}

          <TouchableOpacity
            style={[styles.resendBtn, cooldown > 0 && styles.resendDisabled]}
            onPress={handleResend}
            disabled={cooldown > 0}
          >
            <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  desc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  email: {
    fontWeight: '600',
    color: colors.text,
  },
  codeInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 12,
    width: '100%',
    marginBottom: spacing.md,
  },
  verifying: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  resendBtn: {
    paddingVertical: spacing.sm,
  },
  resendDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: colors.textSecondary,
  },
});
