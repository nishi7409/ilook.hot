export type PhotoCategory = 'front' | 'side' | 'back' | 'other';

export interface ProgressPhoto {
  id: string;
  userId: string;
  date: string; // ISO date string
  photoUrl: string;
  category: PhotoCategory;
  bodyweight: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoTimeline {
  date: string;
  photos: ProgressPhoto[];
}
