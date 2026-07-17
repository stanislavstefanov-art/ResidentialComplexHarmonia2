export interface NotificationRecordDto {
  id: string;
  title: string;
  sentAt: string;
  channel: string;
}

export interface AnnouncementRequest {
  title: string;
  body: string;
}
