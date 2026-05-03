import { create } from 'zustand';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '../lib/types';
import { supabase } from '../lib/supabase';
import { mapAuthError } from '../lib/authUtils';

interface UserProfile {
  full_name?: string | null;
  coin?: number | null;
  last_session_id?: string | null;
}

const getLocalSessionId = () => {
  let id = localStorage.getItem('dhtn_lms_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('dhtn_lms_session_id', id);
  }
  return id;
};

const mapSupabaseUser = (authUser: SupabaseUser, profile?: UserProfile | null): User => ({
  id: authUser.id,
  fullName:
    profile?.full_name ??
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    authUser.email ??
    'Người dùng',
  email: authUser.email ?? '',
  coin: profile?.coin ?? 0,
  createdAt: authUser.created_at ?? new Date().toISOString(),
  lastSessionId: profile?.last_session_id ?? null,
});

interface AuthState {
  currentUser: User | null;
  isAuthReady: boolean;
  initializeAuth: () => Promise<() => void>;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<string | null>;
  refreshBalance: () => Promise<void>;
  validateSession: () => Promise<void>;
}

const syncSession = async (
  session: Session | null,
  set: (partial: Partial<AuthState>) => void,
  logout: () => Promise<string | null>,
  event?: AuthChangeEvent | null
) => {
  if (session?.user) {
    const localId = getLocalSessionId();

    // Lấy dữ liệu hồ sơ để có thêm thông tin như xu và ID phiên đăng nhập cuối cùng
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    // Kiểm tra xem phiên đăng nhập có hợp lệ không (khớp với thiết bị này)
    // QUAN TRỌNG: Bỏ qua kiểm tra sự kiện SIGNED_IN để cho phép thiết bị mới xác nhận phiên đăng nhập
    // và sự kiện INITIAL_SESSION để tránh bị đăng xuất ngay lập tức khi ứng dụng đang tải
    const isNewLogin = event === 'SIGNED_IN';

    if (profile && profile.last_session_id && profile.last_session_id !== localId && !isNewLogin) {
      const { notification } = await import('antd');
      notification.warning({
        message: 'Phiên đăng nhập hết hạn',
        description: 'Tài khoản của bạn đã được đăng nhập ở một thiết bị khác. Vui lòng đăng nhập lại.',
        placement: 'top',
        duration: 8,
      });
      await logout();
      return;
    }

    set({
      currentUser: mapSupabaseUser(session.user, profile),
      isAuthReady: true,
    });
  } else {
    set({
      currentUser: null,
      isAuthReady: true,
    });
  }
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  currentUser: null,
  isAuthReady: false,

  initializeAuth: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { logout } = get();
    await syncSession(session, set, logout, 'INITIAL_SESSION');

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      syncSession(nextSession, set, logout, event);
    });

    // Bật Realtime listener cho bảng profiles để cập nhật xu ngay lập tức khi nạp tiền
    const profileSubscription = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const { currentUser } = get();
          // Kiểm tra xem bản ghi update có phải là của user hiện tại không
          if (currentUser && payload.new.id === currentUser.id) {
            set({
              currentUser: {
                ...currentUser,
                coin: payload.new.coin,
                lastSessionId: payload.new.last_session_id
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(profileSubscription);
    };
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return mapAuthError(error.message);
    }

    if (data.user) {
      const localId = getLocalSessionId();

      // Cập nhật last_session_id trong hồ sơ người dùng
      await supabase
        .from('profiles')
        .update({ last_session_id: localId })
        .eq('id', data.user.id);

      // Lấy hồ sơ để lấy thông tin xu
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      set({ currentUser: mapSupabaseUser(data.user, profile), isAuthReady: true });
    }

    return null;
  },

  register: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      return mapAuthError(error.message);
    }

    if (data.session?.user) {
      const localId = getLocalSessionId();

      // Cập nhật last_session_id trong hồ sơ người dùng
      await supabase
        .from('profiles')
        .update({ last_session_id: localId })
        .eq('id', data.session.user.id);

      set({ currentUser: mapSupabaseUser(data.session.user), isAuthReady: true });
    }

    return null;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return mapAuthError(error.message);
    }

    set({ currentUser: null, isAuthReady: true });
    return null;
  },

  refreshBalance: async () => {
    const { currentUser } = get();
    if (!currentUser) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('coin')
      .eq('id', currentUser.id)
      .single();

    if (profile) {
      set({
        currentUser: {
          ...currentUser,
          coin: profile.coin,
        },
      });
    }
  },

  validateSession: async () => {
    const { currentUser, logout } = get();
    if (!currentUser) return;

    const localId = getLocalSessionId();
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_session_id')
      .eq('id', currentUser.id)
      .single();

    if (profile && profile.last_session_id && profile.last_session_id !== localId) {
      const { notification } = await import('antd');
      notification.warning({
        message: 'Phiên đăng nhập hết hạn',
        description: 'Tài khoản của bạn đã được đăng nhập từ thiết bị khác.',
        placement: 'top',
        duration: 8,
      });
      await logout();
    }
  },
}));
