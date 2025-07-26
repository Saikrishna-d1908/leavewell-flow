// Mock authentication system to bypass database issues
export interface MockUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'employee' | 'manager' | 'admin';
  created_at: string;
}

export interface MockSession {
  user: MockUser;
  access_token: string;
  expires_at: number;
}

const MOCK_USERS_KEY = 'mock_users';
const MOCK_SESSION_KEY = 'mock_session';

export class MockAuthService {
  private static instance: MockAuthService;
  
  static getInstance(): MockAuthService {
    if (!MockAuthService.instance) {
      MockAuthService.instance = new MockAuthService();
    }
    return MockAuthService.instance;
  }

  private getStoredUsers(): MockUser[] {
    const stored = localStorage.getItem(MOCK_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private saveUsers(users: MockUser[]): void {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }

  private getStoredSession(): MockSession | null {
    const stored = localStorage.getItem(MOCK_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  private saveSession(session: MockSession | null): void {
    if (session) {
      localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(MOCK_SESSION_KEY);
    }
  }

  async signUp(email: string, password: string, userData: { first_name: string; last_name: string; role?: string }): Promise<{ user?: MockUser; error?: any }> {
    const users = this.getStoredUsers();
    
    // Check if user already exists
    if (users.find(u => u.email === email)) {
      return { 
        error: { 
          message: 'User already registered',
          code: 'user_already_exists'
        }
      };
    }

    // Create new user
    const newUser: MockUser = {
      id: `mock_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: (userData.role as any) || 'employee',
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);

    console.log('✅ Mock user created:', newUser);
    return { user: newUser };
  }

  async signIn(email: string, password: string): Promise<{ user?: MockUser; session?: MockSession; error?: any }> {
    const users = this.getStoredUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      return {
        error: {
          message: 'Invalid login credentials',
          code: 'invalid_credentials'
        }
      };
    }

    // Create session
    const session: MockSession = {
      user,
      access_token: `mock_token_${Date.now()}`,
      expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    this.saveSession(session);
    console.log('✅ Mock user signed in:', user);

    return { user, session };
  }

  async signOut(): Promise<void> {
    this.saveSession(null);
    console.log('✅ Mock user signed out');
  }

  getSession(): MockSession | null {
    const session = this.getStoredSession();
    
    // Check if session is expired
    if (session && session.expires_at < Date.now()) {
      this.saveSession(null);
      return null;
    }
    
    return session;
  }

  // Mock leave policies for testing
  getLeavePolicy(leave_type: string) {
    const policies = {
      'sick': { annual_quota: 10, max_consecutive_days: 5, requires_approval: false },
      'vacation': { annual_quota: 20, max_consecutive_days: 14, requires_approval: true },
      'family_emergency': { annual_quota: 5, max_consecutive_days: 3, requires_approval: true },
      'personal': { annual_quota: 5, max_consecutive_days: 2, requires_approval: true },
      'other': { annual_quota: 0, max_consecutive_days: 1, requires_approval: true }
    };
    
    return policies[leave_type as keyof typeof policies] || policies.other;
  }

  // Create demo users for testing different roles
  async createDemoUsers(): Promise<void> {
    const demoUsers = [
      {
        email: 'admin@demo.com',
        password: 'demo123',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      },
      {
        email: 'manager@demo.com',
        password: 'demo123',
        first_name: 'Manager',
        last_name: 'User',
        role: 'manager'
      },
      {
        email: 'employee@demo.com',
        password: 'demo123',
        first_name: 'Employee',
        last_name: 'User',
        role: 'employee'
      }
    ];

    const existingUsers = this.getStoredUsers();
    
    for (const demo of demoUsers) {
      if (!existingUsers.find(u => u.email === demo.email)) {
        await this.signUp(demo.email, demo.password, {
          first_name: demo.first_name,
          last_name: demo.last_name,
          role: demo.role
        });
      }
    }
    
    console.log('✅ Demo users created/verified');
  }
}

export const mockAuth = MockAuthService.getInstance();