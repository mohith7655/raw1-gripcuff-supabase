export interface User {
  uid: string;
  email: string;
  fullName: string;
  username: string;
  profileImageUrl?: string;
  phone?: string;
  dateOfBirth?: string;
  completedVideos: number;
  totalVideos: number;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type CreateUserInput = Omit<User, 'uid' | 'createdAt' | 'updatedAt'>;
