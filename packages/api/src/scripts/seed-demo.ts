import bcrypt from 'bcryptjs';
import { supabase } from '../db';

async function seedDemoAccounts() {
  console.log('🌱 Starting Vektor HCM demo seeding...');

  // 1. Check if company already exists
  let { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .limit(1)
    .maybeSingle();

  if (!company) {
    console.log('Creating company: Saylani Tech Solutions...');
    const { data: newComp, error: compErr } = await supabase
      .from('companies')
      .insert({
        name: 'Saylani Tech Solutions',
        city: 'Karachi',
        email: 'admin@vektor.local',
      })
      .select()
      .single();

    if (compErr || !newComp) {
      console.error('Failed to create company:', compErr);
      process.exit(1);
    }
    company = newComp;
  }

  const companyId = company!.id;
  console.log(`Using company ID: ${companyId}`);

  // 2. Company Settings
  await supabase.from('company_settings').upsert(
    {
      company_id: companyId,
      office_start: '09:00',
      grace_minutes: 15,
      half_day_hours: 5.0,
      weekend_days: [0, 6],
      office_latitude: 24.8607,
      office_longitude: 67.0011,
      office_radius_meters: 150,
    },
    { onConflict: 'company_id' }
  );

  // 3. Leave Types
  await supabase.from('leave_types').upsert(
    [
      { company_id: companyId, name: 'Annual', is_paid: true, days_per_year: 14 },
      { company_id: companyId, name: 'Sick', is_paid: true, days_per_year: 8 },
      { company_id: companyId, name: 'Casual', is_paid: true, days_per_year: 10 },
      { company_id: companyId, name: 'Unpaid', is_paid: false, days_per_year: 0 },
    ],
    { onConflict: 'company_id, name' }
  );

  // 4. Departments
  const { data: depts } = await supabase
    .from('departments')
    .upsert(
      [
        { company_id: companyId, name: 'Engineering' },
        { company_id: companyId, name: 'Human Resources' },
        { company_id: companyId, name: 'Operations' },
        { company_id: companyId, name: 'Finance' },
      ],
      { onConflict: 'company_id, name' }
    )
    .select();

  const engDept = depts?.find((d) => d.name === 'Engineering');

  // 5. Designations
  const { data: desigs } = await supabase
    .from('designations')
    .upsert(
      [
        { company_id: companyId, title: 'Senior Software Engineer' },
        { company_id: companyId, title: 'Software Engineer' },
        { company_id: companyId, title: 'HR Manager' },
        { company_id: companyId, title: 'HR Officer' },
        { company_id: companyId, title: 'Accountant' },
      ],
      { onConflict: 'company_id, title' }
    )
    .select();

  const seDesig = desigs?.find((d) => d.title === 'Senior Software Engineer');

  // 6. Create Users (Admin, HR, Employee)
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('AdminPassword123!', salt);
  const hrHash = await bcrypt.hash('HrPassword123!', salt);
  const empHash = await bcrypt.hash('EmpPassword123!', salt);

  console.log('Creating demo users...');

  // Admin user
  const { data: adminUser } = await supabase
    .from('users')
    .upsert(
      {
        company_id: companyId,
        email: 'admin@vektor.local',
        password_hash: adminHash,
        role: 'admin',
        is_active: true,
        must_change_password: false,
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  // HR user
  const { data: hrUser } = await supabase
    .from('users')
    .upsert(
      {
        company_id: companyId,
        email: 'hr@vektor.local',
        password_hash: hrHash,
        role: 'hr',
        is_active: true,
        must_change_password: false,
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  // Employee user
  const { data: empUser } = await supabase
    .from('users')
    .upsert(
      {
        company_id: companyId,
        email: 'emp@vektor.local',
        password_hash: empHash,
        role: 'employee',
        is_active: true,
        must_change_password: false,
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  // Alias employee user for employee@vektor.local
  await supabase
    .from('users')
    .upsert(
      {
        company_id: companyId,
        email: 'employee@vektor.local',
        password_hash: empHash,
        role: 'employee',
        is_active: true,
        must_change_password: false,
      },
      { onConflict: 'email' }
    );

  // 7. Create Employee Record linked to empUser
  if (empUser) {
    console.log('Creating employee record for Bilal Tariq (emp@vektor.local)...');
    const basic = 80000;
    const hra = 32000; // 40%
    const medical = 8000; // 10%
    const gross = 120000; // 150%

    await supabase.from('employees').upsert(
      {
        company_id: companyId,
        user_id: empUser.id,
        employee_code: 'EMP-001',
        first_name: 'Bilal',
        last_name: 'Tariq',
        email: 'emp@vektor.local',
        phone: '+92 300 1234567',
        gender: 'male',
        joining_date: '2026-01-15',
        department_id: engDept?.id || null,
        designation_id: seDesig?.id || null,
        status: 'active',
        basic_salary: basic,
        hra,
        medical,
        gross_salary: gross,
      },
      { onConflict: 'company_id, employee_code' }
    );
  }

  // 8. Create another employee for rich demo analytics (Sana Sheikh)
  const emp2Hash = await bcrypt.hash('EmpPassword123!', salt);
  const { data: emp2User } = await supabase
    .from('users')
    .upsert(
      {
        company_id: companyId,
        email: 'sana@vektor.local',
        password_hash: emp2Hash,
        role: 'employee',
        is_active: true,
        must_change_password: false,
      },
      { onConflict: 'email' }
    )
    .select()
    .single();

  if (emp2User) {
    await supabase.from('employees').upsert(
      {
        company_id: companyId,
        user_id: emp2User.id,
        employee_code: 'EMP-002',
        first_name: 'Sana',
        last_name: 'Sheikh',
        email: 'sana@vektor.local',
        phone: '+92 321 7654321',
        gender: 'female',
        joining_date: '2026-02-01',
        department_id: engDept?.id || null,
        designation_id: seDesig?.id || null,
        status: 'active',
        basic_salary: 100000,
        hra: 40000,
        medical: 10000,
        gross_salary: 150000,
      },
      { onConflict: 'company_id, employee_code' }
    );
  }

  // 9. Initial Announcement
  await supabase.from('announcements').insert({
    company_id: companyId,
    title: 'Welcome to Vektor HCM!',
    content: 'Saylani Hackathon 2026 HCM Lite is live. Use your role dashboard to explore attendance, leaves, and payroll.',
    posted_by: adminUser?.id || null,
  });

  console.log('✅ Demo accounts seeded successfully:');
  console.log('👑 Admin:    admin@vektor.local  / AdminPassword123!');
  console.log('💼 HR:       hr@vektor.local     / HrPassword123!');
  console.log('👤 Employee: emp@vektor.local    / EmpPassword123!');
}

seedDemoAccounts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
