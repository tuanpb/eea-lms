import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Avatar, Dropdown, Space, Typography, FloatButton, Grid, Tag, notification } from 'antd';
import type { MenuProps } from 'antd';
import { useAuthStore } from '../../store/authStore';
import { BookOpen, Home, LogOut, User, Wallet, Coins, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const currentUser = useAuthStore((state) => state.currentUser);
  const logout = useAuthStore((state) => state.logout);
  const validateSession = useAuthStore((state) => state.validateSession);
  const refreshBalance = useAuthStore((state) => state.refreshBalance);

  // Lắng nghe thay đổi số dư theo thời gian thực (Global)
  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`profile_changes_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        (payload) => {
          if (payload.new) {
            // Lấy số dư hiện tại từ store vì payload.old mặc định không chứa dữ liệu đầy đủ
            const currentStoreCoin = useAuthStore.getState().currentUser?.coin || 0;
            const newCoin = payload.new.coin || 0;
            
            if (newCoin > currentStoreCoin) {
              const addedCoin = newCoin - currentStoreCoin;
              notification.success({
                message: 'Nạp tiền thành công!',
                description: `Tài khoản của bạn đã được cộng ${addedCoin.toLocaleString()} xu.`,
                icon: <CheckCircle2 style={{ color: '#10b981' }} />,
                duration: 10,
              });
              // Cập nhật state cục bộ
              refreshBalance();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, refreshBalance]);

  // Kiểm tra tính hợp lệ của phiên đăng nhập khi thay đổi route
  useEffect(() => {
    if (currentUser) {
      void validateSession();
    }
  }, [location.pathname, currentUser, validateSession]);

  const handleLogout = () => {
    void logout().finally(() => {
      navigate('/login');
    });
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogOut size={14} />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          height: 64,
          lineHeight: '64px',
        }}
      >
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}
          >
            <BookOpen size={20} />
          </div>
          <Text
            strong
            style={{
              fontSize: 18,
              color: 'var(--color-primary)',
              letterSpacing: -0.5,
            }}
          >
            EEA-LMS
          </Text>
        </div>

        {screens.md && (
          <Space size={32} style={{ flex: 1, justifyContent: 'center' }}>
            <div
              onClick={() => navigate('/')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: location.pathname === '/' ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontWeight: location.pathname === '/' ? 700 : 500,
                fontSize: 15,
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <Home size={16} />
              Trang chủ
              {location.pathname === '/' && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--color-primary)',
                  borderRadius: 2
                }} />
              )}
            </div>
            <div
              onClick={() => navigate('/wallet')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: location.pathname === '/wallet' ? 'var(--color-primary)' : 'var(--text-secondary)',
                fontWeight: location.pathname === '/wallet' ? 700 : 500,
                fontSize: 15,
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <Wallet size={16} />
              Ví điểm
              {location.pathname === '/wallet' && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--color-primary)',
                  borderRadius: 2
                }} />
              )}
            </div>
          </Space>
        )}

        <Space size={screens.md ? 16 : 8} style={{ flexShrink: 0 }}>
          {currentUser && (
            <Tag
              onClick={() => navigate('/wallet')}
              style={{
                cursor: 'pointer',
                margin: 0,
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
            >
              <Coins size={14} style={{ color: '#10b981' }} />
              <Text strong style={{ color: '#10b981', fontSize: 13 }}>
                {currentUser.coin?.toLocaleString() || 0}
                {screens.md && <span style={{ marginLeft: 3, fontWeight: 500 }}>xu</span>}
              </Text>
            </Tag>
          )}

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                size={32}
                icon={<User size={16} />}
                style={{
                  background: 'var(--gradient-primary)',
                }}
              />
              {screens.md && (
                <Text
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 14,
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentUser?.fullName ?? currentUser?.email ?? 'Người dùng'}
                </Text>
              )}
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <Content
        style={{
          maxWidth: 1280,
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px',
          flex: 1,
        }}
      >
        <Outlet />
      </Content>

      {screens.md && (
        <Footer
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 100,
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            fontSize: 12,
            padding: '16px 24px',
            marginTop: 'auto',
          }}
        >
          © 2026 EEA-LMS • Đề cương trực tuyến
        </Footer>
      )}

      {!screens.md && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '12px 0 calc(12px + env(safe-area-inset-bottom, 0px))',
          zIndex: 100,
        }}>
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: location.pathname === '/' ? 'var(--color-primary)' : 'var(--text-muted)',
              flex: 1,
              cursor: 'pointer',
              padding: '10px 16px',
              borderRadius: 24,
              background: location.pathname === '/' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              transition: 'all 0.2s',
              margin: '0 8px',
            }}
          >
            <Home size={18} />
            <Text style={{ fontSize: 13, fontWeight: location.pathname === '/' ? 600 : 500, color: 'inherit' }}>
              Trang chủ
            </Text>
          </div>

          <div
            onClick={() => navigate('/wallet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: location.pathname === '/wallet' ? 'var(--color-primary)' : 'var(--text-muted)',
              flex: 1,
              cursor: 'pointer',
              padding: '10px 16px',
              borderRadius: 24,
              background: location.pathname === '/wallet' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              transition: 'all 0.2s',
              margin: '0 8px',
            }}
          >
            <Wallet size={18} />
            <Text style={{ fontSize: 13, fontWeight: location.pathname === '/wallet' ? 600 : 500, color: 'inherit' }}>
              Ví điểm
            </Text>
          </div>
        </div>
      )}

      <FloatButton.BackTop duration={400} style={{ right: 24, bottom: 80 }} />
    </Layout>
  );
};

export default AppLayout;
