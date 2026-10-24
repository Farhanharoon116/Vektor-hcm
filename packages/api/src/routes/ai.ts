import { Router, Request, Response } from 'express';
import { supabase } from '../db';
import { authMiddleware } from '../middleware/auth';
import { executeTool, queryLLM } from '../services/ai.service';
import { AIChatSchema, SmartLeaveParseSchema } from '@vektor/shared';

const router = Router();

const SYSTEM_POLICY_PROMPT = `You are Vektor HCM AI — an intelligent, authoritative Human Capital Management assistant.
Strict company business rules & policies:
1. Access Scope:
   - Admin has full access to all company records, analytics, audit logs, and can finalize monthly payroll.
   - HR manages employees, attendance corrections, leave approvals, and prepares monthly payroll drafts.
   - Employee can ONLY see their own profile, attendance calendar, leave balances, and payslips.
   - CRITICAL GUARDRAIL: If an Employee asks for another colleague's salary or confidential data, POLITELY BUT FIRMLY REFUSE. Say: "I cannot share another employee's salary or private data under company confidentiality policy."

2. Working Hours & Attendance:
   - Office start time is 09:00 with a 15-minute grace window. Clocking in after 09:15 is automatically flagged as "late".
   - Total working hours under 5.0 hours are classified as a "half_day".
   - If an employee has no attendance and no approved leave on a working day, they are flagged "absent".
   - Second check-in on the same day is rejected with 409 Conflict.

3. Leaves:
   - Leaves are counted on working days only (weekends and public holidays are not deducted from quota).
   - Standard quotas: Annual = 14 days, Sick = 8 days, Casual = 10 days, Unpaid = unlimited.
   - Overlapping leave or applying for more days than your balance will be rejected.

4. Salary & Payroll:
   - Gross salary = Basic * 1.5 (Basic 100%, House Rent Allowance 40%, Medical Allowance 10%).
   - Daily rate = Gross / Working days in month.
   - Deduction = (Absent days + Unpaid leave days + 0.5 * Half days) * Daily rate.
   - Annual tax slab on Gross * 12: 0-600k (0%), 600k-1.2M (5%), 1.2M-2.4M (30k + 15%), 2.4M-3.6M (210k + 25%), >3.6M (510k + 35%).
   - Finalized payroll is locked and immutable.

CRITICAL ANTI-HALLUCINATION & CONVERSATION RULES:
- NEVER invent, extrapolate, or guess employee counts, headcounts, payroll sums, or attendance numbers under ANY circumstances. (e.g. NEVER make up 42 or 1,237).
- When answering questions about numbers (e.g. employee count, attendance stats, absent employees, payroll amounts), rely ONLY and STRICTLY on the numbers provided in the 'Database Tool Result'.
- NEVER pretend to be performing an asynchronous operation or tell the user to wait (e.g. NEVER say "I am pulling the attendance data, please hold on", "Let me check the database", or "waiting..."). You are a single-turn responder with live tool data already injected.
- If the user asks for specific company figures (e.g. who didn't come, who is absent, attendance numbers, payroll amounts) and no Database Tool Result is provided in the prompt, DO NOT invent a number. Explicitly state in 1 concise sentence that you do not have live database metrics for that query.

Answer concisely and accurately based ONLY on real database numbers and these policy rules. Support both English and Roman Urdu.`;

// POST /ai/chat
router.post('/chat', authMiddleware, async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const user = req.user!;
    const parseResult = AIChatSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { prompt, conversation_history } = parseResult.data;
    const lowerPrompt = prompt.toLowerCase();

    // Guardrail: Employee asking for colleague's salary
    if (
      user.role === 'employee' &&
      (lowerPrompt.includes('salary') || lowerPrompt.includes('pay') || lowerPrompt.includes('kamata')) &&
      !lowerPrompt.includes('my salary') &&
      !lowerPrompt.includes('meri salary') &&
      !lowerPrompt.includes('my payslip')
    ) {
      const refusal = "I apologize, but under Vektor HCM confidentiality policies, I cannot disclose any colleague's salary or compensation details.";
      return res.json({
        response: refusal,
        is_ai_generated: true,
      });
    }

    // Context-aware prompt evaluation: combine recent user context if follow-up
    const userHistory = (conversation_history || [])
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content);
    const fullUserContext = userHistory.join(' ').toLowerCase();
    const isFollowUp =
      lowerPrompt.length < 35 &&
      (lowerPrompt.includes('ha') ||
       lowerPrompt.includes('haan') ||
       lowerPrompt.includes('yes') ||
       lowerPrompt.includes('batao') ||
       lowerPrompt.includes('waiting') ||
       lowerPrompt.includes('tell me') ||
       lowerPrompt.includes('aj ka') ||
       lowerPrompt.includes('today') ||
       lowerPrompt.includes('please'));

    const searchContext = isFollowUp ? `${fullUserContext} ${lowerPrompt}` : lowerPrompt;

    // Direct tool dispatch heuristic or LLM tool-calling
    let toolResult: any = null;
    let toolCalled: string | undefined;

    // 1. Headcount & Employee Counts (e.g. "How many active employees are in the company?", "kitne employees hain", "total employees")
    const isHeadcount =
      searchContext.includes('headcount') ||
      /(how many|total|count|number of|kitne).*employee/i.test(searchContext) ||
      /(how many|total|count|active).*staff/i.test(searchContext) ||
      /(active|total)\s+employees?/i.test(searchContext) ||
      /employees?.*(count|total|company)/i.test(searchContext) ||
      searchContext.includes('active employees');

    // 2. Personal Leave Balances (for employees)
    const isMyLeaves =
      searchContext.includes('leave balance') ||
      searchContext.includes('sick leaves') ||
      searchContext.includes('sick leave') ||
      searchContext.includes('casual leave') ||
      /how many.*leave.*(i have|left|remaining)/i.test(searchContext) ||
      /meri chutti/i.test(searchContext) ||
      /my.*leave/i.test(searchContext);

    // 3. Late Comers
    const isLateComers =
      searchContext.includes('who came late') ||
      searchContext.includes('late comers') ||
      /late.*today/i.test(searchContext) ||
      /kaun.*late/i.test(searchContext) ||
      /who.*late/i.test(searchContext);

    // 4. Attendance Rate / Summary & Absenteeism (who didn't come, kitne log nahi aye, absent today, haziri)
    const isAttendance =
      searchContext.includes('attendance') ||
      searchContext.includes('haziri') ||
      searchContext.includes('present') ||
      searchContext.includes('absent') ||
      /(nahi aye|nahi aya|nahi aae|nahi aai|nahi aya|nahi hain)/i.test(searchContext) ||
      /(didn't come|did not come|not come|missing today)/i.test(searchContext) ||
      /(who|kaun|kitne).*absent/i.test(searchContext) ||
      /(who|kaun|kitne).*(come|aye|aya|hazir)/i.test(searchContext) ||
      /attendance.*(today|month|rate|summary)/i.test(searchContext);

    // 5. Leave Summary (Who is on leave today)
    const isLeaveSummary =
      searchContext.includes('on leave today') ||
      searchContext.includes('who is on leave') ||
      /who.*leave.*today/i.test(searchContext) ||
      /chutti.*aaj/i.test(searchContext);

    // 6. Payroll Summary
    const isPayroll =
      searchContext.includes('payroll summary') ||
      searchContext.includes('total payroll') ||
      searchContext.includes('monthly payroll') ||
      /payroll.*(total|cost|summary|run|monthly)/i.test(searchContext) ||
      /salary.*expense/i.test(searchContext);

    if (isHeadcount) {
      toolCalled = 'get_headcount';
      toolResult = await executeTool('get_headcount', {}, { user, companyId: user.company_id });
    } else if (isMyLeaves) {
      toolCalled = 'get_my_leave_balance';
      toolResult = await executeTool('get_my_leave_balance', {}, { user, companyId: user.company_id });
    } else if (isLateComers) {
      toolCalled = 'get_late_comers';
      toolResult = await executeTool('get_late_comers', {}, { user, companyId: user.company_id });
    } else if (isAttendance) {
      toolCalled = 'get_attendance_summary';
      toolResult = await executeTool('get_attendance_summary', {}, { user, companyId: user.company_id });
    } else if (isLeaveSummary) {
      toolCalled = 'get_leave_summary';
      toolResult = await executeTool('get_leave_summary', {}, { user, companyId: user.company_id });
    } else if (isPayroll) {
      toolCalled = 'get_payroll_summary';
      toolResult = await executeTool('get_payroll_summary', {}, { user, companyId: user.company_id });
    }

    // Prepare prompt with tool context if executed
    const enrichedPrompt = toolResult
      ? `User question: "${prompt}"\n\nDatabase Tool Result (Ground Truth from live database):\n${JSON.stringify(toolResult, null, 2)}\n\nPlease summarize this information clearly and concisely for the user based strictly on the Database Tool Result.`
      : prompt;

    const messages = [
      ...(conversation_history || []),
      { role: 'user', content: enrichedPrompt },
    ];

    const aiResponse = await queryLLM(messages, SYSTEM_POLICY_PROMPT);
    const durationMs = Date.now() - startTime;

    // Log call into ai_logs
    await supabase.from('ai_logs').insert({
      company_id: user.company_id,
      user_id: user.id,
      role: user.role,
      prompt,
      tool_called: toolCalled || null,
      response: aiResponse,
      duration_ms: durationMs,
    });

    return res.json({
      response: aiResponse,
      tool_called: toolCalled || null,
      tool_result: toolResult || null,
      is_ai_generated: true,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'AI request failed' });
  }
});

// POST /ai/summarize - Dashboard KPI summary
router.post('/summarize', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { kpis, department_breakdown, top_late_comers } = req.body;
    const dataContext = JSON.stringify({ kpis, department_breakdown, top_late_comers }, null, 2);

    const prompt = `Analyze the following real-time HCM dashboard metrics and provide exactly 3 to 4 actionable, punchy insight bullet points. Use ONLY the numbers provided:\n\n${dataContext}`;
    const response = await queryLLM(
      [{ role: 'user', content: prompt }],
      'You are a high-level HCM Executive Analyst. Return 3-4 bullet points starting with emoji summarizing the numbers. Do not fabricate any numbers outside the provided JSON.'
    );

    return res.json({
      summary: response,
      is_ai_generated: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /ai/smart-leave - Parse natural language leave request
router.post('/smart-leave', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parseResult = SmartLeaveParseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { message } = parseResult.data;
    const companyId = req.user!.company_id;

    // Fetch leave types for reference
    const { data: leaveTypes } = await supabase
      .from('leave_types')
      .select('id, name')
      .eq('company_id', companyId);

    const typesList = (leaveTypes || []).map((t) => `${t.name} (id: ${t.id})`).join(', ');
    const todayIso = new Date().toISOString().split('T')[0];

    const prompt = `Today's date is ${todayIso}.
The employee said: "${message}"

Available company leave types: ${typesList}

Parse this sentence into valid JSON with this EXACT structure (no markdown fences, just pure JSON):
{
  "leave_type_id": "<matching leave_type_id from available list, or default to Casual>",
  "leave_type_name": "<matching leave type name e.g. Casual, Sick, Annual>",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "reason": "<extracted reason in clear English>"
}
If the user mentions Roman Urdu (e.g. "somwar", "agle hafte", "bhai ki shadi"), translate accurately to dates and reason.`;

    const response = await queryLLM(
      [{ role: 'user', content: prompt }],
      'You are a JSON parsing agent. Output ONLY valid JSON, nothing else.'
    );

    // Extract JSON from response
    let parsed: any;
    try {
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback if LLM output had text
      parsed = {
        leave_type_id: leaveTypes?.[0]?.id || null,
        leave_type_name: leaveTypes?.[0]?.name || 'Casual',
        start_date: todayIso,
        end_date: todayIso,
        reason: message,
      };
    }

    return res.json({
      success: true,
      parsed_leave: parsed,
      is_ai_generated: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
