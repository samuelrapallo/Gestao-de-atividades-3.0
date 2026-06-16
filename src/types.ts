export interface Spreadsheet {
  id: string;
  filename: string;
  createdAt: number;
  adminUid: string;
}

export type ActivityStatus = 'pending' | 'completed' | 'rescheduled';

export interface Activity {
  id: string;
  spreadsheetId: string;
  atividade: string;
  ordem: string;
  data: string;
  executante: string;
  status: ActivityStatus;
  observacoes: string;
  audioUrl?: string;
  photoUrl?: string;
  createdAt: number;
  updatedAt: number;
}
