import client from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  total: number;
  unread: number;
}

export const notificationsApi = {
  list: (unread_only = false, limit = 30) =>
    client.get<NotificationList>('/notifications', { params: { unread_only, limit } }).then(r => r.data),

  unreadCount: () =>
    client.get<{ unread: number }>('/notifications/unread-count').then(r => r.data),

  markRead: (id: string) =>
    client.post<Notification>(`/notifications/${id}/read`).then(r => r.data),

  markAllRead: () =>
    client.post('/notifications/read-all').then(r => r.data),
};
