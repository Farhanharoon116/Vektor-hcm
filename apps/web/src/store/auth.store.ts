import { create } from 'zustand';
import { UserRole } from '@vektor/shared';
import { api } from '../lib/api';

export interface UserState {
  id: string;
  email: string;
  role: UserRole;
  employee_id?: string;
  must_change_password?: boolean;
  company_id: string;
}

export interface CompanyState {
  id: string;
  name: string;
  logo_url?: string;
  city?: string;
}

interface AuthStore {
  user: UserState | null;
  company: CompanyState | null;
  employee: any | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  setAuth: (token: string, user: UserState, company?: CompanyState, employee?: any) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateUser: (updates: Partial<UserState>) => void;
  updateEmployee: (updates: any) => void;
}

// Instant cache hydration from localStorage for 0ms cold-start
const getInitialState = () => {
  try {
    const token = localStorage.getItem('vektor_auth_token');
    const userStr = localStorage.getItem('vektor_user');
    const empStr = localStorage.getItem('vektor_employee');
    const compStr = localStorage.getItem('vektor_company');

    const user = userStr ? JSON.parse(userStr) : null;
    const employee = empStr ? JSON.parse(empStr) : null;
    const company = compStr ? JSON.parse(compStr) : null;

    if (user && employee && !user.employee_id) {
      user.employee_id = employee.id;
    }

    return {
      token,
      user,
      employee,
      company,
      isInitialized: Boolean(token && user),
    };
  } catch {
    return { token: null, user: null, employee: null, company: null, isInitialized: false };
  }
};

const initial = getInitialState();

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: initial.user,
  company: initial.company,
  employee: initial.employee,
  token: initial.token,
  isLoading: !initial.isInitialized,
  isInitialized: initial.isInitialized,

  setAuth: (token, user, company, employee) => {
    const enrichedUser = {
      ...user,
      employee_id: employee?.id || user.employee_id,
    };

    localStorage.setItem('vektor_auth_token', token);
    localStorage.setItem('vektor_user', JSON.stringify(enrichedUser));
    if (company) localStorage.setItem('vektor_company', JSON.stringify(company));
    if (employee) localStorage.setItem('vektor_employee', JSON.stringify(employee));

    set({
      token,
      user: enrichedUser,
      company: company || null,
      employee: employee || null,
      isLoading: false,
      isInitialized: true,
    });
  },

  logout: () => {
    localStorage.removeItem('vektor_auth_token');
    localStorage.removeItem('vektor_user');
    localStorage.removeItem('vektor_employee');
    localStorage.removeItem('vektor_company');
    set({ user: null, company: null, employee: null, token: null, isLoading: false, isInitialized: true });
  },

  fetchMe: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false, isInitialized: true });
      return;
    }

    try {
      // Background revalidation without locking the UI
      const data = await api.get('/auth/me');
      const enrichedUser = {
        ...data.user,
        employee_id: data.employee?.id || data.user.employee_id,
      };

      localStorage.setItem('vektor_user', JSON.stringify(enrichedUser));
      if (data.company) localStorage.setItem('vektor_company', JSON.stringify(data.company));
      if (data.employee) localStorage.setItem('vektor_employee', JSON.stringify(data.employee));

      set({
        user: enrichedUser,
        company: data.company,
        employee: data.employee,
        isLoading: false,
        isInitialized: true,
      });
    } catch (err) {
      console.error('Failed to fetch user session:', err);
      if (!get().user) {
        get().logout();
      }
      set({ isLoading: false, isInitialized: true });
    }
  },

  updateUser: (updates) => {
    const current = get().user;
    if (current) {
      const updated = { ...current, ...updates };
      localStorage.setItem('vektor_user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  updateEmployee: (updates) => {
    const current = get().employee;
    if (current) {
      const updated = { ...current, ...updates };
      localStorage.setItem('vektor_employee', JSON.stringify(updated));
      set({ employee: updated });
    }
  },
}));
