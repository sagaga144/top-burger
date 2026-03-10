import { RatingQuestion } from '../types';

export const RATING_QUESTIONS: RatingQuestion[] = [
  {
    id: 1,
    key: 'overTheTop',
    label: 'Over the Top',
    question: 'How over the top / impressive was it?',
  },
  {
    id: 2,
    key: 'priciness',
    label: 'Priciness',
    question: 'How pricey was it? (10 = very expensive)',
  },
  {
    id: 3,
    key: 'meatQuality',
    label: 'Meat Quality',
    question: 'How was the meat quality?',
  },
  {
    id: 4,
    key: 'service',
    label: 'Service',
    question: 'How was the service?',
  },
  {
    id: 5,
    key: 'vibes',
    label: 'Vibes',
    question: 'How were the vibes?',
  },
  {
    id: 6,
    key: 'theSides',
    label: 'The Sides',
    question: 'How were the sides?',
  },
  {
    id: 7,
    key: 'afterEffect',
    label: 'After Effect',
    question: 'How did you feel after eating?',
    hasPhotoUpload: true,
  },
];
