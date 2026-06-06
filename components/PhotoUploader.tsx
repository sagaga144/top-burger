import React from 'react';
import { View, Pressable, Image, Alert, Platform } from 'react-native';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface PhotoUploaderProps {
  photoUri: string | null;
  onPhotoSelected: (uri: string | null, width?: number, height?: number) => void;
  assetWidth?: number;
  assetHeight?: number;
}

export default function PhotoUploader({
  photoUri,
  onPhotoSelected,
  assetWidth,
  assetHeight,
}: PhotoUploaderProps) {
  const { t } = useTranslation();

  const handlePickPhoto = async () => {
    // On web the browser handles file access natively — no permission API available.
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please allow access to your photo library to upload a photo.'
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      onPhotoSelected(asset.uri, asset.width, asset.height);
    }
  };

  const handleRemovePhoto = () => {
    onPhotoSelected(null);
  };

  const aspectRatio =
    assetWidth && assetHeight ? assetWidth / assetHeight : 4 / 3;

  if (photoUri) {
    return (
      <View className="mt-4">
        <View
          className="rounded-2xl overflow-hidden bg-bg-card"
          style={{ aspectRatio, maxHeight: 280 }}
        >
          <Image
            source={{ uri: photoUri }}
            className="w-full h-full"
            resizeMode="contain"
          />
          <Pressable
            onPress={handleRemovePhoto}
            accessible
            accessibilityLabel={t('rate.photo.remove')}
            accessibilityRole="button"
            className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.60)' }}
          >
            <Ionicons name="close" size={16} color="#F5F5F5" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePickPhoto}
      accessible
      accessibilityLabel={t('rate.photo.tapToUpload')}
      accessibilityRole="button"
      className="mt-4 rounded-2xl items-center justify-center py-6"
      style={{
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#2C2C2E',
        minHeight: 72,
      }}
    >
      <Ionicons name="camera-outline" size={28} color="#8E8E93" />
      <Text className="text-sm text-text-secondary mt-2">
        {t('rate.photo.tapToUpload')}
      </Text>
    </Pressable>
  );
}
