import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refreshNotifications: () => {},
});

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch open flags
      const { data: openFlags, error: flagsError } = await supabase
        .from('flags')
        .select(`
          id,
          customer_id,
          reason,
          status,
          severity,
          created_at
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      // 2. Fetch pending verification payments
      const { data: pendingPayments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          customer_id,
          amount,
          status,
          submitted_at,
          created_at
        `)
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false });

      if (flagsError) {
        console.warn('Error fetching flag notifications:', flagsError.message);
      }
      if (paymentsError) {
        console.warn('Error fetching payment notifications:', paymentsError.message);
      }

      // Collect customer IDs needed to display shop names
      const customerIds = Array.from(
        new Set([
          ...(openFlags || []).map((f) => f.customer_id),
          ...(pendingPayments || []).map((p) => p.customer_id),
        ].filter(Boolean))
      );

      let customerMap = {};
      if (customerIds.length > 0) {
        const { data: customersData } = await supabase
          .from('customers')
          .select('id, shop_name, owner_name')
          .in('id', customerIds);

        if (customersData) {
          customerMap = customersData.reduce((acc, curr) => {
            acc[curr.id] = curr;
            return acc;
          }, {});
        }
      }

      const items = [];

      // Add Red Notifications (Flags)
      if (openFlags) {
        openFlags.forEach((flag) => {
          const cust = customerMap[flag.customer_id];
          const shopName = cust?.shop_name || 'Unknown Shop';
          items.push({
            id: `flag-${flag.id}`,
            type: 'flag', // Red
            title: `[URGENT] ${flag.reason || 'Flag raised'}`,
            subtitle: shopName,
            customerId: flag.customer_id,
            timestamp: flag.created_at,
            raw: flag,
          });
        });
      }

      // Add Green Notifications (Pending Payments)
      if (pendingPayments) {
        pendingPayments.forEach((payment) => {
          const cust = customerMap[payment.customer_id];
          const shopName = cust?.shop_name || 'Unknown Shop';
          const formattedAmount = formatCurrency(payment.amount);
          items.push({
            id: `payment-${payment.id}`,
            type: 'payment', // Green
            title: `New payment proof from ${shopName} — ${formattedAmount}`,
            subtitle: `Submitted at ${payment.submitted_at ? new Date(payment.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}`,
            customerId: payment.customer_id,
            timestamp: payment.submitted_at || payment.created_at,
            raw: payment,
          });
        });
      }

      // Sort by newest timestamp
      items.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      setNotifications(items);
    } catch (err) {
      console.error('Failed to update notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // 30 second polling interval as specified
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    // Supabase Realtime listener for live updates
    const channel = supabase
      .channel('paymate-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flags' },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount: notifications.length,
        loading,
        refreshNotifications: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
