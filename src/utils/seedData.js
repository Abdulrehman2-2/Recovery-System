import { supabase } from '../supabase';

export async function seedSampleData() {
  try {
    // 1. Check if customers already exist
    const { data: existingCust } = await supabase.from('customers').select('id').limit(1);
    if (existingCust && existingCust.length > 0) {
      return { success: true, message: 'Data already exists in database.' };
    }

    const todayStr = new Date().toISOString();

    // 2. Insert sample customers
    const { data: customers, error: custErr } = await supabase
      .from('customers')
      .insert([
        {
          shop_name: 'Al-Madina Traders',
          owner_name: 'Muhammad Tariq',
          phone: '+92 300 1234567',
          city: 'Lahore',
          status: 'overdue',
          priority: 'high',
          total_outstanding: 245000,
          last_contacted_at: todayStr,
          follow_up_count: 5,
        },
        {
          shop_name: 'Bismillah Auto Spare',
          owner_name: 'Haji Aslam',
          phone: '+92 321 9876543',
          city: 'Karachi',
          status: 'active',
          priority: 'medium',
          total_outstanding: 115000,
          last_contacted_at: new Date(Date.now() - 86400000).toISOString(),
          follow_up_count: 2,
        },
        {
          shop_name: 'Khan General Store',
          owner_name: 'Kamran Khan',
          phone: '+92 333 4567890',
          city: 'Peshawar',
          status: 'defaulter',
          priority: 'critical',
          total_outstanding: 480000,
          last_contacted_at: new Date(Date.now() - 172800000).toISOString(),
          follow_up_count: 9,
        },
        {
          shop_name: 'Apex Super Mart',
          owner_name: 'Bilal Ahmed',
          phone: '+92 345 6789012',
          city: 'Islamabad',
          status: 'active',
          priority: 'low',
          total_outstanding: 45000,
          last_contacted_at: new Date(Date.now() - 259200000).toISOString(),
          follow_up_count: 1,
        },
        {
          shop_name: 'Gulshan Electronics',
          owner_name: 'Zubair Sheikh',
          phone: '+92 312 3456789',
          city: 'Rawalpindi',
          status: 'overdue',
          priority: 'high',
          total_outstanding: 310000,
          last_contacted_at: todayStr,
          follow_up_count: 4,
        },
      ])
      .select();

    if (custErr) throw custErr;
    if (!customers || customers.length === 0) throw new Error('Customer insertion failed');

    const c1 = customers[0].id; // Al-Madina
    const c2 = customers[1].id; // Bismillah
    const c3 = customers[2].id; // Khan General
    const c4 = customers[3].id; // Apex Super
    const c5 = customers[4].id; // Gulshan

    // 3. Invoices
    const { data: invoices, error: invErr } = await supabase
      .from('invoices')
      .insert([
        { customer_id: c1, invoice_number: 'INV-2026-001', amount: 150000, due_date: '2026-07-15', status: 'overdue' },
        { customer_id: c1, invoice_number: 'INV-2026-002', amount: 95000, due_date: '2026-08-01', status: 'overdue' },
        { customer_id: c2, invoice_number: 'INV-2026-003', amount: 115000, due_date: '2026-08-20', status: 'unpaid' },
        { customer_id: c3, invoice_number: 'INV-2026-004', amount: 280000, due_date: '2026-06-10', status: 'overdue' },
        { customer_id: c3, invoice_number: 'INV-2026-005', amount: 200000, due_date: '2026-06-25', status: 'overdue' },
        { customer_id: c4, invoice_number: 'INV-2026-006', amount: 45000, due_date: '2026-08-25', status: 'unpaid' },
        { customer_id: c5, invoice_number: 'INV-2026-007', amount: 310000, due_date: '2026-07-20', status: 'overdue' },
      ])
      .select();

    if (invErr) throw invErr;

    // 4. Payments (including verified today, and pending_verification for proofs)
    const { error: payErr } = await supabase.from('payments').insert([
      {
        customer_id: c1,
        invoice_id: invoices?.[0]?.id || null,
        amount: 50000,
        status: 'verified',
        submitted_at: todayStr,
        verified_at: todayStr,
      },
      {
        customer_id: c2,
        invoice_id: invoices?.[2]?.id || null,
        amount: 35000,
        status: 'verified',
        submitted_at: todayStr,
        verified_at: todayStr,
      },
      {
        customer_id: c3,
        invoice_id: invoices?.[3]?.id || null,
        amount: 100000,
        status: 'pending_verification',
        submitted_at: todayStr,
      },
      {
        customer_id: c5,
        invoice_id: invoices?.[6]?.id || null,
        amount: 75000,
        status: 'pending_verification',
        submitted_at: todayStr,
      },
    ]);
    if (payErr) console.warn('Payment insert notice:', payErr.message);

    // 5. Payment promises
    const { error: promErr } = await supabase.from('payment_promises').insert([
      { customer_id: c1, invoice_id: invoices?.[1]?.id, amount: 95000, promised_date: '2026-08-12', status: 'pending', notes: 'Agreed over phone call' },
      { customer_id: c3, invoice_id: invoices?.[4]?.id, amount: 200000, promised_date: '2026-07-30', status: 'missed', notes: 'Failed to pay on agreed date' },
      { customer_id: c3, invoice_id: invoices?.[3]?.id, amount: 150000, promised_date: '2026-07-15', status: 'missed', notes: 'Did not respond on promised date' },
      { customer_id: c5, invoice_id: invoices?.[6]?.id, amount: 150000, promised_date: '2026-08-15', status: 'pending', notes: 'Will pay through bank transfer' },
    ]);
    if (promErr) console.warn('Promise insert notice:', promErr.message);

    // 6. Flags (open & urgent)
    const { error: flagErr } = await supabase.from('flags').insert([
      { customer_id: c3, reason: 'Customer repeatedly broken promises and phone switched off', status: 'open', severity: 'critical' },
      { customer_id: c1, reason: 'Disputed rate for INV-2026-001 items', status: 'open', severity: 'high' },
      { customer_id: c2, reason: 'Requested delivery slip verification', status: 'resolved', severity: 'medium' },
    ]);
    if (flagErr) console.warn('Flags insert notice:', flagErr.message);

    // 7. Conversations
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .insert([
        {
          customer_id: c1,
          started_at: todayStr,
          outcome: 'promised_payment',
          summary: 'Discussed overdue amount of Rs. 245,000. Customer agreed to clear Rs. 95,000 by 12 Aug and sent Rs. 50,000 slip today.',
        },
        {
          customer_id: c2,
          started_at: todayStr,
          outcome: 'promised_payment',
          summary: 'Follow-up on invoice #INV-2026-003. Customer confirmed payment slip uploaded.',
        },
        {
          customer_id: c3,
          started_at: new Date(Date.now() - 172800000).toISOString(),
          outcome: 'dispute_raised',
          summary: 'Customer stated market conditions are slow, refused immediate payment.',
        },
      ])
      .select();

    if (convErr) console.warn('Conversations insert notice:', convErr.message);

    // 8. Messages for conversation
    if (convs && convs.length > 0) {
      const conv1 = convs[0].id;
      await supabase.from('messages').insert([
        {
          conversation_id: conv1,
          sender_type: 'agent',
          message_text: 'Assalam-o-Alaikum Tariq Sahab, PayMate accounts department here regarding your invoice of Rs. 245,000.',
          sent_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          conversation_id: conv1,
          sender_type: 'customer',
          message_text: 'Walaikum Assalam. Yes, I had some delay in recoveries from retailers.',
          sent_at: new Date(Date.now() - 3500000).toISOString(),
        },
        {
          conversation_id: conv1,
          sender_type: 'agent',
          message_text: 'We understand, but this has been pending since July. Can you deposit Rs. 50,000 today and the rest by 12th?',
          sent_at: new Date(Date.now() - 3400000).toISOString(),
        },
        {
          conversation_id: conv1,
          sender_type: 'customer',
          message_text: 'Done. I am transferring 50k now and will upload the screenshot. Remainder on 12th August.',
          sent_at: new Date(Date.now() - 3300000).toISOString(),
        },
      ]);
    }

    return { success: true, message: 'Sample dataset created successfully!' };
  } catch (err) {
    console.error('Seed error:', err);
    return { success: false, message: err.message };
  }
}
