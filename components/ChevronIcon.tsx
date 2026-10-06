import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface ChevronIconProps {
  direction: 'back' | 'forward';
  size: number;
  color: string;
}

// Layout mirrors in RTL, but icon glyphs don't: "back" points right in Hebrew.
export default function ChevronIcon({ direction, size, color }: ChevronIconProps) {
  const { i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const name = (direction === 'back') !== rtl ? 'chevron-back' : 'chevron-forward';
  return <Ionicons name={name} size={size} color={color} />;
}
