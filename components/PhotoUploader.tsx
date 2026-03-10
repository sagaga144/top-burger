import React from 'react';
import { View, Text, Pressable, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface PhotoUploaderProps {
  photoUri: string | null;
  onPhotoSelected: (uri: string | null) => void;
}

export default function PhotoUploader({
  photoUri,
  onPhotoSelected,
}: PhotoUploaderProps) {
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library to upload a photo.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      onPhotoSelected(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => {
    onPhotoSelected(null);
  };

  if (photoUri) {
    return (
      <View className="mt-4">
        <View className="relative">
          <Image
            source={{ uri: photoUri }}
            className="w-full h-24 rounded-2xl"
            resizeMode="cover"
          />
          <Pressable
            onPress={handleRemovePhoto}
            accessible
            accessibilityLabel="Remove photo"
            accessibilityRole="button"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 items-center justify-center"
          >
            <Text className="text-text-inverse text-sm font-bold">✕</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePickPhoto}
      accessible
      accessibilityLabel="Tap to upload a photo"
      accessibilityRole="button"
      className="mt-4 h-24 rounded-2xl items-center justify-center"
      style={{
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#E5E7EB',
      }}
    >
      <Text className="text-2xl">📷</Text>
      <Text className="text-sm text-text-secondary mt-1">Tap to upload</Text>
    </Pressable>
  );
}
