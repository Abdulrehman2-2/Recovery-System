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
        console.warn('Notice while fetching flag notifications:', flagsError.message);
      }
      if (paymentsError) {
        console.warn('Notice while fetching payment notifications:', paymentsError.message);
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

      // Add Red Notifications (Open Flags)
      if (openFlags) {
        openFlags.forEach((flag) => {
          const cust = customerMap[flag.customer_id];
          const shopName = cust?.shop_name || `Customer #${flag.customer_id}`;
          items.push({
            id: `flag-${flag.id}`,
            type: 'flag', // Red
            title: `[URGENT] ${flag.reason || 'Account flag raised'}`,
            subtitle: shopName,
            customerId: flag.customer_id,
            timestamp: flag.created_at,
            raw: flag,
          });
        });
      }

      // Add Green Notifications (Pending Payment Proofs)
      if (pendingPayments) {
        pendingPayments.forEach((payment) => {
          const cust = customerMap[payment.customer_id];
          const shopName = cust?.shop_name || `Customer #${payment.customer_id}`;
          const formattedAmount = formatCurrency(payment.amount);
          items.push({
            id: `payment-${payment.id}`,
            type: 'payment', // Green
            title: `New payment proof from ${shopName} — ${formattedAmount}`,
            subtitle: `Submitted on ${payment.submitted_at ? new Date(payment.submitted_at).toLocaleDateString([], { day: '2-digit', month: 'short' }) : 'Recently'}`,
            customerId: payment.customer_id,
            timestamp: payment.submitted_at || payment.created_at,
            raw: payment,
          });
        });
      }

      // Sort newest first
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

    // Supabase Realtime channel for live instant notifications
    const channel = supabase
      .channel('paymate-notifications-channel')
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
