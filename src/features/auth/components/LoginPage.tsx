import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Input, Button, Typography, Flex, Space, message } from 'antd';
import { BookOpen, Mail, Lock, ArrowRight } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../../../lib/schemas';
import { useAuthStore } from '../../../store/authStore';

const { Title, Text } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    const error = await login(data.email, data.password);

    if (error) {
      message.error(error);
    } else {
      message.success('Đăng nhập thành công!');
      navigate('/');
    }

    setLoading(false);
  };

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(22,119,255,0.08), transparent 70%)',
          top: -100,
          right: -100,
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(9,88,217,0.05), transparent 70%)',
          bottom: -50,
          left: -50,
          animation: 'float 10s ease-in-out infinite reverse',
        }}
      />

      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 0 20px rgba(22,119,255,0.05)',
          animation: 'fadeInUp 0.6s ease-out',
        }}
        styles={{ body: { padding: 40 } }}
      >
        <Flex vertical align="center" style={{ marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              marginBottom: 16,
              boxShadow: '0 4px 20px rgba(22,119,255,0.2)',
            }}
          >
            <BookOpen size={28} />
          </div>
          <Title level={3} style={{ margin: 0, color: 'var(--text-primary)' }}>
            EEA-LMS
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Đề cương trực tuyến
          </Text>
        </Flex>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Space orientation="vertical" size={24} style={{ width: '100%' }}>
            <div>
              <Text
                strong
                style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}
              >
                Email
              </Text>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    prefix={<Mail size={16} style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Nhập email của bạn"
                    size="large"
                    status={errors.email ? 'error' : ''}
                  />
                )}
              />
              {errors.email && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  {errors.email.message}
                </Text>
              )}
            </div>

            <div>
              <Text
                strong
                style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}
              >
                Mật khẩu
              </Text>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    prefix={<Lock size={16} style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Nhập mật khẩu"
                    size="large"
                    status={errors.password ? 'error' : ''}
                  />
                )}
              />
              {errors.password && (
                <Text type="danger" style={{ fontSize: 12 }}>
                  {errors.password.message}
                </Text>
              )}
            </div>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              icon={<ArrowRight size={18} />}
              iconPlacement="end"
              block
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 10,
                marginTop: 8,
              }}
            >
              Đăng nhập
            </Button>
          </Space>
        </form>

        <Flex justify="center" gap={8} style={{ marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Chưa có tài khoản?
          </Text>
          <Link to="/register" style={{ fontSize: 14, fontWeight: 600 }}>
            Đăng ký ngay
          </Link>
        </Flex>
      </Card>
    </Flex>
  );
};

export default LoginPage;
