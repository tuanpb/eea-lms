import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Input,
  Flex,
  Badge,
  Modal,
  message,
} from 'antd';
import {
  Search,
  Lock,
  Unlock,
  CheckCircle,
} from 'lucide-react';
import { useExamStore } from '../../../store/examStore';
import { useAuthStore } from '../../../store/authStore';
import type { Subject } from '../../../lib/types';

const { Title, Text } = Typography;

const SubjectListPage = () => {
  const navigate = useNavigate();
  const subjects = useExamStore((state) => state.subjects);
  const loading = useExamStore((state) => state.loading);
  const unlockedSubjectIds = useExamStore((state) => state.unlockedSubjectIds);
  const unlockSubject = useExamStore((state) => state.unlockSubject);
  const refreshBalance = useAuthStore((state) => state.refreshBalance);
  const currentUser = useAuthStore((state) => state.currentUser);

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchValue]);

  const filteredSubjects = useMemo(() => {
    let result = [...subjects];

    // Tìm kiếm
    if (debouncedSearchValue) {
      const query = debouncedSearchValue.toLowerCase();
      result = result.filter(
        (subject) =>
          subject.name.toLowerCase().includes(query) ||
          (subject.description && subject.description.toLowerCase().includes(query))
      );
    }

    // Sắp xếp: Mở khóa lên đầu, sau đó theo tên
    return result.sort((a, b) => {
      const aUnlocked = unlockedSubjectIds.includes(a.id);
      const bUnlocked = unlockedSubjectIds.includes(b.id);

      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [subjects, debouncedSearchValue, unlockedSubjectIds]);

  const handleSubjectClick = (subject: Subject) => {
    const isUnlocked = unlockedSubjectIds.includes(subject.id);
    if (isUnlocked) {
      navigate(`/subjects/${subject.id}`);
    } else {
      setSelectedSubject(subject);
      setIsModalVisible(true);
    }
  };

  const currentSelectedSubject = useMemo(() => {
    if (!selectedSubject) return null;
    // Luôn tìm môn học mới nhất từ mảng subjects của store
    return subjects.find(s => s.id === selectedSubject.id) || selectedSubject;
  }, [subjects, selectedSubject]);

  const activePrice = useMemo(() => {
    if (!currentSelectedSubject) return 0;
    return (currentSelectedSubject.rentalCoin && currentSelectedSubject.rentalCoin > 0)
      ? currentSelectedSubject.rentalCoin
      : currentSelectedSubject.unlockCoin;
  }, [currentSelectedSubject]);

  const isInsufficientBalance = (currentUser?.coin ?? 0) < activePrice;

  const transferContent = useMemo(() => {
    if (!currentUser?.email) return 'LMS';
    const emailPrefix = currentUser.email.split('@')[0];
    return `${emailPrefix}`;
  }, [currentUser]);

  const qrUrl = useMemo(() => {
    if (!selectedSubject) return '';
    const bankId = 'vpbank';
    const accountNo = '0974106084';
    const template = 'compact2';
    const accountName = 'NGUYEN THI MINH HANG';
    const amount = activePrice - (currentUser?.coin ?? 0);

    return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount * 1000}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accountName)}`;
  }, [selectedSubject, transferContent]);

  const handleConfirmUnlock = async () => {
    if (!selectedSubject) return;
    if (!currentUser) {
      message.warning('Vui lòng đăng nhập để mở khóa môn học');
      navigate('/login');
      return;
    }

    if (isInsufficientBalance) {
      message.warning('Số dư của bạn vẫn chưa đủ. Vui lòng nạp thêm.');
      return;
    }

    setIsUnlocking(true);
    try {
      const result = await unlockSubject(selectedSubject.id, activePrice);
      if (result.success) {
        message.success(`Đã mở khóa thành công môn ${selectedSubject.name}`);
        await refreshBalance();
        setIsModalVisible(false);
      } else {
        message.error(result.error || 'Có lỗi xảy ra khi mở khóa');
      }
    } catch {
      message.error('Lỗi kết nối hệ thống');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div
        style={{
          position: 'sticky',
          top: 64,
          zIndex: 90,
          padding: '16px 0',
          background: 'rgba(245, 245, 245, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16,
        }}
      >
        <div style={{ maxWidth: 480, width: '100%', margin: '0 auto' }}>
          <Input
            prefix={<Search size={18} style={{ color: 'var(--text-muted)' }} />}
            placeholder="Tìm kiếm môn học..."
            size="large"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            allowClear
            style={{ borderRadius: 24, height: 48 }}
          />
        </div>
      </div>

      {loading && subjects.length === 0 ? (
        <Flex justify="center" style={{ padding: 64 }}>
          <Text type="secondary">Đang tải danh sách môn học...</Text>
        </Flex>
      ) : (
        <Row gutter={[20, 20]} style={{ padding: '16px 0' }}>
          {filteredSubjects.map((subject, index) => {
            const cardColor = '#6366f1';
            const isUnlocked = unlockedSubjectIds.includes(subject.id);

            return (
              <Col xs={24} sm={12} md={8} lg={6} key={subject.id}>
                <Card
                  hoverable
                  onClick={() => handleSubjectClick(subject)}
                  style={{
                    background: 'var(--bg-card)',
                    backdropFilter: 'blur(16px)',
                    border: isUnlocked ? '1px solid #10b98140' : (subject.rentalCoin && subject.rentalCoin > 0 ? '1px solid #f59e0b' : '1px solid var(--border-subtle)'),
                    borderRadius: 16,
                    overflow: 'hidden',
                    animation: isUnlocked ? `fadeInUp 0.4s ease-out ${index * 0.05}s both` : (subject.rentalCoin && subject.rentalCoin > 0 ? `glow-pulse 3s infinite ease-in-out, fadeInUp 0.4s ease-out ${index * 0.05}s both` : `fadeInUp 0.4s ease-out ${index * 0.05}s both`),
                    height: '100%',
                  }}
                  styles={{
                    body: { padding: 24 },
                  }}
                >
                  <Flex justify="space-between" align="flex-start">
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: isUnlocked ? '#10b98115' : `${cardColor}20`,
                        color: isUnlocked ? '#10b981' : cardColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 16,
                      }}
                    >
                      {isUnlocked ? <Unlock size={24} /> : <Lock size={24} />}
                    </div>
                    <Flex vertical align="flex-end" gap={8}>
                      <div style={{ display: 'flex', alignItems: 'center', color: isUnlocked ? '#10b981' : 'var(--text-muted)' }}>
                        {isUnlocked ? (
                          <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                            <CheckCircle size={14} /> Vào học ngay
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                            <Lock size={14} /> Mở khóa ngay
                          </span>
                        )}
                      </div>
                      {!isUnlocked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {subject.rentalCoin && subject.rentalCoin > 0 ? (
                            <>
                              <Text delete type="secondary" style={{ fontSize: 12, color: 'rgba(0,0,0,0.25)' }}>
                                {subject.unlockCoin}
                              </Text>
                              <Badge
                                count={`${subject.rentalCoin} Xu`}
                                style={{
                                  backgroundColor: '#ef4444',
                                  borderColor: '#ef4444',
                                  boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                                  animation: 'text-shimmer 1.5s infinite ease-in-out'
                                }}
                              />
                              <Badge
                                status="processing"
                                color="#ef4444"
                                style={{ animation: 'promo-bounce 2s infinite ease-in-out', marginLeft: -4 }}
                              />
                            </>
                          ) : (
                            <Badge
                              count={`${subject.unlockCoin} Xu`}
                              style={{
                                backgroundColor: '#f59e0b',
                                borderColor: '#f59e0b',
                                boxShadow: '0 2px 4px rgba(245,158,11,0.2)'
                              }}
                            />
                          )}
                        </div>
                      )}
                    </Flex>
                  </Flex>

                  <Title level={5} style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>
                    {subject.name}
                  </Title>
                  {subject.description && (
                    <Text type="secondary" style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {subject.description}
                    </Text>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {filteredSubjects.length === 0 && (
        <Flex vertical align="center" style={{ padding: 64, color: 'var(--text-muted)' }} gap={16}>
          <Search size={48} strokeWidth={1} />
          <Text type="secondary">Không tìm thấy môn học phù hợp</Text>
        </Flex>
      )}

      <Modal
        title={isInsufficientBalance ? "Nạp thêm Xu để mở khóa" : "Xác nhận mở khóa môn học"}
        open={isModalVisible}
        onOk={handleConfirmUnlock}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={isUnlocking}
        okButtonProps={isInsufficientBalance ? { style: { display: 'none' } } : {}}
        okText="Mở khóa ngay"
        cancelText={isInsufficientBalance ? "Đóng" : "Hủy"}
        centered
        width={isInsufficientBalance ? 420 : 520}
        style={{ borderRadius: 20, overflow: 'hidden' }}
      >
        <Flex vertical gap={16} style={{ padding: '8px 0' }}>
          {isInsufficientBalance ? (
            <>
              <div style={{
                padding: '12px 16px',
                background: '#fff1f2',
                borderRadius: 12,
                border: '1px solid #fecdd3',
                color: '#be123c',
                fontSize: 14
              }}>
                Số dư hiện tại của bạn không đủ để mở khóa môn học này. Vui lòng nạp thêm <b>{(activePrice - (currentUser?.coin ?? 0)).toLocaleString()} Xu</b>.
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{
                  padding: 16,
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  margin: '0 auto',
                  maxWidth: 240,
                }}>
                  <img
                    src={qrUrl}
                    alt="Recharge QR"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Nội dung chuyển khoản:</Text>
                  <br />
                  <Text strong style={{ fontSize: 16, color: '#e11d48' }}>{transferContent}</Text>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Hệ thống sẽ tự động cộng Xu sau 1-5 phút chuyển khoản thành công.
              </div>
            </>
          ) : (
            <>
              <Text>Bạn có chắc chắn muốn mở khóa môn học <b>{selectedSubject?.name}</b>?</Text>
              <div style={{
                padding: 16,
                background: '#fef3c7',
                borderRadius: 12,
                border: '1px solid #fcd34d',
                color: '#92400e'
              }}>
                <Text style={{ color: '#92400e' }}>
                  Phí mở khóa: <b>{activePrice} Xu</b>
                  {currentSelectedSubject?.rentalCoin && currentSelectedSubject.rentalCoin > 0 && (
                    <Text delete type="secondary" style={{ fontSize: 12, marginLeft: 8, color: '#92400e80' }}>
                      {currentSelectedSubject.unlockCoin} Xu
                    </Text>
                  )}
                </Text>
                <br />
                <Text style={{ fontSize: 12 }}>
                  Số dư hiện tại: {currentUser?.coin || 0} Xu
                </Text>
              </div>
            </>
          )}
        </Flex>
      </Modal>
    </div>
  );
};

export default SubjectListPage;
