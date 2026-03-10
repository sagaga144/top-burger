import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';

type Mode = 'login' | 'signup';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const clearError = () => setError(null);

  const handleSubmit = async () => {
    setError(null);
    setResetSent(false);

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      // Auth gate in _layout.tsx handles navigation
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      setError(getFirebaseErrorMessage(firebaseError.code ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email above, then tap Forgot Password.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      setError(null);
    } catch {
      setError('Could not send reset email. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
    setConfirmPassword('');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Spacer */}
          <View className="h-16" />

          {/* Logo */}
          <View className="items-center mb-8">
            <Text className="text-3xl font-black tracking-tight text-brand-red">
              TOP BURGER
            </Text>
            <Text className="text-sm text-text-secondary mt-1">
              Community Rankings
            </Text>
          </View>

          {/* Mode toggle pill */}
          <View className="flex-row bg-border-subtle rounded-xl p-1 mb-8">
            <Pressable
              onPress={() => switchMode('login')}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Log In tab"
              accessibilityState={{ selected: mode === 'login' }}
              className={[
                'flex-1 py-2.5 rounded-lg items-center',
                mode === 'login' ? 'bg-bg-card' : '',
              ].join(' ')}
              style={
                mode === 'login'
                  ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.06,
                      shadowRadius: 4,
                      elevation: 2,
                    }
                  : undefined
              }
            >
              <Text
                className={
                  mode === 'login'
                    ? 'font-semibold text-text-primary'
                    : 'text-text-secondary'
                }
              >
                Log In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('signup')}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Sign Up tab"
              accessibilityState={{ selected: mode === 'signup' }}
              className={[
                'flex-1 py-2.5 rounded-lg items-center',
                mode === 'signup' ? 'bg-bg-card' : '',
              ].join(' ')}
              style={
                mode === 'signup'
                  ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.06,
                      shadowRadius: 4,
                      elevation: 2,
                    }
                  : undefined
              }
            >
              <Text
                className={
                  mode === 'signup'
                    ? 'font-semibold text-text-primary'
                    : 'text-text-secondary'
                }
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          {/* Email field */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-text-secondary mb-1.5">
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={(t) => { setEmail(t); clearError(); }}
              placeholder="your@email.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              testID="email-input"
              className="bg-bg-card border border-border-subtle rounded-xl px-4 h-13 text-text-primary text-base"
            />
          </View>

          {/* Password field */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-text-secondary mb-1.5">
              Password
            </Text>
            <View className="flex-row bg-bg-card border border-border-subtle rounded-xl px-4 h-13 items-center">
              <TextInput
                value={password}
                onChangeText={(t) => { setPassword(t); clearError(); }}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                returnKeyType={mode === 'signup' ? 'next' : 'done'}
                onSubmitEditing={mode === 'login' ? handleSubmit : undefined}
                testID="password-input"
                className="flex-1 text-text-primary text-base"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                accessible
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text className="text-text-secondary text-sm">
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Confirm password (signup only) */}
          {mode === 'signup' ? (
            <View className="mb-3">
              <Text className="text-sm font-medium text-text-secondary mb-1.5">
                Confirm Password
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); clearError(); }}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                testID="confirm-password-input"
                className="bg-bg-card border border-border-subtle rounded-xl px-4 h-13 text-text-primary text-base"
              />
            </View>
          ) : null}

          {/* Error banner */}
          {error ? (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-600 text-sm" testID="error-banner">
                {error}
              </Text>
            </View>
          ) : null}

          {/* Reset email sent banner */}
          {resetSent ? (
            <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
              <Text className="text-green-700 text-sm">
                Password reset email sent. Check your inbox.
              </Text>
            </View>
          ) : null}

          {/* CTA button */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            accessible
            accessibilityRole="button"
            accessibilityLabel={mode === 'login' ? 'Log In' : 'Create Account'}
            testID="submit-button"
            className="bg-brand-red rounded-xl h-13 items-center justify-center mt-2"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-text-inverse font-bold text-base">
                {mode === 'login' ? 'Log In' : 'Create Account'}
              </Text>
            )}
          </Pressable>

          {/* Forgot password (login only) */}
          {mode === 'login' ? (
            <Pressable
              onPress={handleForgotPassword}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              className="items-center mt-4"
            >
              <Text className="text-sm text-brand-red">Forgot Password?</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
