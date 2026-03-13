import { IUser } from "../models/userModel";

export interface Section {
  instructor: IUser;
  students: IUser[];
  name: string;
}

export type TemplateParams = {
  sender: IUser;
  recipient: IUser;
  section: Section;
  metadata?: Record<string, any>;
};

export type NotificationTemplate = {
  title: (params: TemplateParams) => string;
  description: (params: TemplateParams) => string;
};

export type NotificationCallback = (params: TemplateParams) => {
  title: string;
  description: string;
};

export interface Assessment {
  _id: string | { toString(): string };
  isCompleted?: boolean;
  isStarted?: boolean;
  pendingAssessment?: number;
  [key: string]: any;
}

export interface StudentAssessmentResult {
  assessmentId: string | { toString(): string };
  isFinished?: boolean;
}

export interface Student {
  _id: string | { toString(): string };
  studentAssessmentResults?: StudentAssessmentResult[];
  [key: string]: any;
}
