import api from "./config";

export const getCustomerNotifications = async () => {
  const response = await api.get("/customer/notifications");
  return response.data;
};

export const markCustomerNotificationAsRead = async (id: string) => {
  const response = await api.patch(`/customer/notifications/${id}/read`);
  return response.data;
};

export const markAllCustomerNotificationsAsRead = async () => {
  const response = await api.patch("/customer/notifications/read-all");
  return response.data;
};
