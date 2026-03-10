import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScoreSelector from '../../../components/ScoreSelector';
import PhotoUploader from '../../../components/PhotoUploader';
import { RATING_QUESTIONS } from '../../../constants/ratingQuestions';
import { useAuth } from '../../../store/authStore';
import { saveReview } from '../../../lib/firestore';
import { ReviewScores } from '../../../types';

type PartialScores = Partial<ReviewScores>;

function ProgressBar({ step, total }: { step: number; total: number }) {
  const progress = step / total;
  return (
    <View className="mx-5 mb-4 h-1.5 bg-border-subtle rounded-full overflow-hidden">
      <View
        className="h-full bg-brand-red rounded-full"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
    </View>
  );
}

interface CustomHeaderProps {
  onBack: () => void;
  restaurantName: string;
  restaurantAddress: string;
  step: number;
  total: number;
}

function CustomHeader({
  onBack,
  restaurantName,
  restaurantAddress,
  step,
  total,
}: CustomHeaderProps) {
  return (
    <View className="px-5 pt-4 pb-2">
      <View className="flex-row items-center justify-between mb-1">
        <Pressable
          onPress={onBack}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="w-9 h-9 rounded-full bg-bg-card border border-border-subtle items-center justify-center"
        >
          <Ionicons name="arrow-back" size={18} color="#1C1C1E" />
        </Pressable>
        <Text className="text-sm font-medium text-text-secondary">
          {step} of {total}
        </Text>
        <View className="w-9" />
      </View>
      <View className="mt-2">
        <Text
          className="text-base font-bold text-text-primary"
          numberOfLines={1}
        >
          {restaurantName}
        </Text>
        <Text
          className="text-xs text-text-secondary mt-0.5"
          numberOfLines={1}
        >
          {restaurantAddress}
        </Text>
      </View>
    </View>
  );
}

export default function RateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    placeId: string;
    name: string;
    address: string;
  }>();

  const placeId = params.placeId ?? '';
  const restaurantName = params.name ?? 'Restaurant';
  const restaurantAddress = params.address ?? '';

  const [currentStep, setCurrentStep] = useState(1);
  const [scores, setScores] = useState<PartialScores>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = RATING_QUESTIONS.length;
  const currentQuestion = RATING_QUESTIONS[currentStep - 1];
  const currentScore = scores[currentQuestion.key] ?? null;

  const handleScoreSelect = (score: number) => {
    setScores((prev) => ({ ...prev, [currentQuestion.key]: score }));
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleNext = async () => {
    if (currentScore === null) return;

    if (currentStep < totalSteps) {
      setCurrentStep((s) => s + 1);
      return;
    }

    // Final step — submit
    if (!user) return;

    // Validate all scores present
    const allKeys = RATING_QUESTIONS.map((q) => q.key);
    for (const key of allKeys) {
      if (scores[key] === undefined) {
        Alert.alert('Missing scores', 'Please rate all questions before submitting.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const reviewId = await saveReview({
        placeId,
        restaurantName,
        restaurantAddress,
        userId: user.uid,
        userEmail: user.email ?? '',
        scores: scores as ReviewScores,
        photoUri,
      });
      router.replace({
        pathname: '/(app)/summary/[reviewId]',
        params: { reviewId },
      });
    } catch (err) {
      Alert.alert('Error', 'Failed to save your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isLastStep = currentStep === totalSteps;
  const hasScore = currentScore !== null;

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <CustomHeader
        onBack={handleBack}
        restaurantName={restaurantName}
        restaurantAddress={restaurantAddress}
        step={currentStep}
        total={totalSteps}
      />

      <ProgressBar step={currentStep} total={totalSteps} />

      {/* Question zone */}
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mt-4 mb-6">
          <Text className="text-xs font-bold text-text-secondary tracking-widest mb-2">
            QUESTION {currentStep}
          </Text>
          <Text className="text-2xl font-bold text-text-primary leading-tight">
            {currentQuestion.question}
          </Text>
        </View>

        <ScoreSelector
          selectedScore={currentScore}
          onSelect={handleScoreSelect}
        />

        {/* Score labels */}
        <View className="flex-row justify-between mt-2 px-1">
          <Text className="text-xs text-text-secondary">
            {currentQuestion.key === 'priciness' ? 'Cheap' : 'Poor'}
          </Text>
          <Text className="text-xs text-text-secondary">
            {currentQuestion.key === 'priciness' ? 'Very Expensive' : 'Excellent'}
          </Text>
        </View>

        {/* Photo upload on last step */}
        {currentQuestion.hasPhotoUpload ? (
          <View className="mt-6">
            <Text className="text-sm font-medium text-text-secondary mb-2">
              Optional Photo
            </Text>
            <PhotoUploader
              photoUri={photoUri}
              onPhotoSelected={setPhotoUri}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Navigation row */}
      <View className="flex-row px-5 pb-8 pt-3 gap-3">
        {currentStep > 1 ? (
          <Pressable
            onPress={handleBack}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Previous question"
            className="flex-1 h-13 rounded-xl border border-border-subtle items-center justify-center"
          >
            <Text className="font-semibold text-text-primary">Previous</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleNext}
          disabled={!hasScore || submitting}
          accessible
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Submit review' : 'Next question'}
          testID={isLastStep ? 'submit-review-button' : 'next-question-button'}
          className="flex-1 h-13 bg-brand-red rounded-xl items-center justify-center"
          style={{ opacity: !hasScore || submitting ? 0.4 : 1 }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-text-inverse font-bold text-base">
              {isLastStep ? 'Submit' : 'Next'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
