export interface UserLocationData {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface UserLocations {
  gym?: UserLocationData;
  home?: UserLocationData;
  park?: UserLocationData;
}

export interface User {
  uid: string;
  email: string;
  fullName: string;
  username: string;
  profileImageUrl?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  age?: number;
  locations?: UserLocations;
  completedVideos: number;
  totalVideos: number;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type CreateUserInput = Omit<User, 'uid' | 'createdAt' | 'updatedAt'>;
