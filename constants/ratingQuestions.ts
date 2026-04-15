import { RatingQuestion } from '../types';

export const RATING_QUESTIONS: RatingQuestion[] = [
  {
    id: 1,
    key: 'overTheTop',
    labelKey: 'ratingQuestions.overTheTop.label',
    questionKey: 'ratingQuestions.overTheTop.question',
  },
  {
    id: 2,
    key: 'priciness',
    labelKey: 'ratingQuestions.priciness.label',
    questionKey: 'ratingQuestions.priciness.question',
  },
  {
    id: 3,
    key: 'meatQuality',
    labelKey: 'ratingQuestions.meatQuality.label',
    questionKey: 'ratingQuestions.meatQuality.question',
  },
  {
    id: 4,
    key: 'service',
    labelKey: 'ratingQuestions.service.label',
    questionKey: 'ratingQuestions.service.question',
  },
  {
    id: 5,
    key: 'vibes',
    labelKey: 'ratingQuestions.vibes.label',
    questionKey: 'ratingQuestions.vibes.question',
  },
  {
    id: 6,
    key: 'theSides',
    labelKey: 'ratingQuestions.theSides.label',
    questionKey: 'ratingQuestions.theSides.question',
  },
  {
    id: 7,
    key: 'afterEffect',
    labelKey: 'ratingQuestions.afterEffect.label',
    questionKey: 'ratingQuestions.afterEffect.question',
    hasPhotoUpload: true,
  },
];
