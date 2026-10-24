import { supabase } from '../db';
import { config } from '../config';
import { AuthUser } from '../middleware/auth';

export interface ToolExecutionContext {
  user: AuthUser;
  companyId: string;
}

/**
 * 7 HCM Scoped Tools
 */
export async function executeTool(name: string, args: any, ctx: ToolExecutionContext): Promise<any> {
  const { user, companyId } = ctx;

  switch (name) {
    case 'get_headcount': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Headcount data is reserved for Admin and HR.' };
      }
      let query = supabase
        .from('employees')
        .select('id, status, department:departments(name)')
        .eq('company_id', companyId);

      if (args?.department) {
        query = query.ilike('department.name', `%${args.department}%`);
      }
      if (args?.status) {
        query = query.eq('status', args.status);
      } else {
        query = query.in('status', ['active', 'probation']);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };
      return { headcount: data?.length || 0, department: args?.department || 'All' };
    }

    case 'get_attendance_summary': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Overall attendance summary is reserved for Admin and HR.' };
      }
      const today = new Date().toISOString().split('T')[0];
      const from = args?.date_from || today;
      const to = args?.date_to || today;

      const [attRes, empRes, leaveRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('employee_id, status, date, hours_worked')
          .eq('company_id', companyId)
          .gte('date', from)
          .lte('date', to),
        supabase
          .from('employees')
          .select('id, first_name, last_name, employee_code')
          .eq('company_id', companyId)
          .in('status', ['active', 'probation']),
        supabase
          .from('leave_requests')
          .select('employee_id')
          .eq('company_id', companyId)
          .eq('status', 'approved')
          .lte('start_date', to)
          .gte('end_date', from),
      ]);

      if (attRes.error) return { error: attRes.error.message };

      const attData = attRes.data || [];
      const employees = empRes.data || [];
      const leaves = leaveRes.data || [];

      const presentList = attData.filter((d: any) => d.status === 'present');
      const lateList = attData.filter((d: any) => d.status === 'late');
      const halfDayList = attData.filter((d: any) => d.status === 'half_day');

      const attendedEmpIds = new Set(attData.map((d: any) => d.employee_id));
      const leaveEmpIds = new Set(leaves.map((l: any) => l.employee_id));

      const absentEmployees = employees.filter(
        (e: any) => !attendedEmpIds.has(e.id) && !leaveEmpIds.has(e.id)
      );

      const summary = {
        date: from === to ? from : `${from} to ${to}`,
        total_active_employees: employees.length,
        present: presentList.length,
        late: lateList.length,
        half_day: halfDayList.length,
        on_leave: leaves.length,
        absent: absentEmployees.length,
        absent_employees: absentEmployees.map((e: any) => `${e.first_name} ${e.last_name} (${e.employee_code})`),
      };
      return summary;
    }

    case 'get_late_comers': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Company late-comers report is reserved for Admin and HR.' };
      }
      const today = new Date().toISOString().split('T')[0];
      const from = args?.date_from || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
      const to = args?.date_to || today;

      const { data, error } = await supabase
        .from('attendance')
        .select('date, clock_in, employee:employees(first_name, last_name, employee_code, department:departments(name))')
        .eq('company_id', companyId)
        .eq('status', 'late')
        .gte('date', from)
        .lte('date', to);

      if (error) return { error: error.message };
      return { late_records: data || [] };
    }

    case 'get_leave_summary': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Company-wide leave summary is reserved for Admin and HR.' };
      }
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('leave_requests')
        .select('start_date, end_date, days_count, status, leave_type:leave_types(name), employee:employees(first_name, last_name, employee_code, department:departments(name))')
        .eq('company_id', companyId)
        .eq('status', 'approved')
        .lte('start_date', args?.date_to || today)
        .gte('end_date', args?.date_from || today);

      if (error) return { error: error.message };
      return { active_leaves_on_date: data || [] };
    }

    case 'get_my_leave_balance': {
      if (!user.employee_id) {
        return { error: 'No employee record found for your user account.' };
      }
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', companyId);

      const { data: approvedLeaves } = await supabase
        .from('leave_requests')
        .select('leave_type_id, days_count')
        .eq('employee_id', user.employee_id)
        .eq('status', 'approved');

      const balances = (leaveTypes || []).map((lt) => {
        const used = (approvedLeaves || [])
          .filter((l) => l.leave_type_id === lt.id)
          .reduce((sum, l) => sum + Number(l.days_count), 0);
        return {
          type: lt.name,
          quota: lt.days_per_year,
          used,
          remaining: lt.days_per_year > 0 ? Math.max(0, lt.days_per_year - used) : 'Unlimited',
        };
      });
      return { my_balances: balances };
    }

    case 'get_payroll_summary': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Company payroll costs are confidential and visible to Admin and HR only.' };
      }
      const month = args?.month || new Date().getMonth() + 1;
      const year = args?.year || new Date().getFullYear();

      const { data, error } = await supabase
        .from('payroll_runs')
        .select('month, year, status, total_gross, total_deductions, total_tax, total_net, employee_count')
        .eq('company_id', companyId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (error) return { error: error.message };
      return data || { message: `No payroll run found for ${month}/${year}` };
    }

    case 'search_employees': {
      if (user.role === 'employee') {
        return { error: 'Access denied: Employee directory search via AI is restricted to Admin and HR.' };
      }
      const queryStr = args?.query || '';
      let query = supabase
        .from('employees')
        .select('employee_code, first_name, last_name, email, phone, status, department:departments(name), designation:designations(title)')
        .eq('company_id', companyId);

      if (queryStr) {
        query = query.or(`first_name.ilike.%${queryStr}%,last_name.ilike.%${queryStr}%,employee_code.ilike.%${queryStr}%`);
      }

      const { data, error } = await query.limit(10);
      if (error) return { error: error.message };
      return { employees: data || [] };
    }

    default:
      return { error: `Tool ${name} not recognized` };
  }
}

/**
 * Direct call to Groq LLM API with 15s timeout & friendly fallback
 */
export async function queryLLM(messages: { role: string; content: string }[], systemPrompt: string): Promise<string> {
  const apiKey = config.aiApiKey;
  if (!apiKey) {
    return 'AI service is currently unconfigured. Please add `AI_API_KEY` (Groq API key) to packages/api/.env.';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout rule

  try {
    const baseUrl = config.aiBaseUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/chat/completions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel || 'openai/gpt-oss-20b',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) {
      const errText = await res.text();
      console.error('Groq API error:', errText);
      return 'The AI assistant encountered an issue with Groq API. Please verify your `AI_API_KEY`.';
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || 'No response generated.';
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return 'AI request timed out after 15 seconds. Please try asking again.';
    }
    console.error('Groq LLM error:', err);
    return 'The AI assistant is momentarily unavailable. Please retry in a moment.';
  }
}
