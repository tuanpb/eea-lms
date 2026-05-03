import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Tag, Empty, Typography, Flex, Row, Col, Card, Input, Modal, message, Checkbox, Grid } from 'antd';
import { Search, Lock, Unlock, Download } from 'lucide-react';
import { useExamStore } from '../../../store/examStore';
import { useAuthStore } from '../../../store/authStore';
import type { Answer } from '../../../lib/types';

const { Title, Text } = Typography;

const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'] as const;

const AnswerKeyPage = () => {
  const { subjectId } = useParams<{ subjectId?: string }>();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();

  const subjects = useExamStore((state) => state.subjects);
  const loadingQuestions = useExamStore((state) => state.loadingQuestions);
  const currentExam = useExamStore((state) => state.currentExam);
  const unlockedDataUrls = useExamStore((state) => state.unlockedDataUrls);
  const fetchQuestionsFromUrl = useExamStore((state) => state.fetchQuestionsFromUrl);
  const unlockedSubjectIds = useExamStore((state) => state.unlockedSubjectIds);
  const unlockSubject = useExamStore((state) => state.unlockSubject);

  const currentUser = useAuthStore((state) => state.currentUser);
  const refreshBalance = useAuthStore((state) => state.refreshBalance);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const subject = useMemo(() => {
    return subjects.find((item) => item.id === subjectId);
  }, [subjectId, subjects]);

  const isUnlocked = useMemo(() => {
    if (!subjectId) return true;
    return unlockedSubjectIds.includes(subjectId);
  }, [subjectId, unlockedSubjectIds]);

  const dataUrl = useMemo(() => {
    if (!subjectId) return undefined;
    return unlockedDataUrls[subjectId];
  }, [subjectId, unlockedDataUrls]);

  useEffect(() => {
    const shouldFetch = subjectId && dataUrl && isUnlocked && (!currentExam || currentExam.subjectId !== subjectId);
    if (shouldFetch) {
      fetchQuestionsFromUrl(subjectId!, dataUrl!);
    }
  }, [subjectId, dataUrl, fetchQuestionsFromUrl, currentExam, isUnlocked]);

  const handleConfirmUnlock = async () => {
    if (!subject || !subjectId) return;
    setIsUnlocking(true);
    try {
      const result = await unlockSubject(subjectId, subject.unlockCoin || 0);
      if (result.success) {
        message.success('Mở khóa thành công!');
        await refreshBalance();
        setIsModalVisible(false);
      } else {
        message.error(result.error);
      }
    } catch {
      message.error('Lỗi hệ thống');
    } finally {
      setIsUnlocking(false);
    }
  };

  const exam = useMemo(() => {
    if (!isUnlocked) return undefined;

    if (currentExam && currentExam.subjectId === subjectId) {
      return currentExam;
    }

    return undefined;
  }, [isUnlocked, subjectId, currentExam]);

  const handleExportPDF = () => {
    window.print();
  };

  const hasDetailedQuestions = useMemo(() => {
    if (!exam) return false;
    return exam.answers.some((answer) => answer.questionText && answer.options);
  }, [exam]);

  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [showOnlyCorrect, setShowOnlyCorrect] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchValue]);

  const filteredAnswers = useMemo(() => {
    if (!exam) return [];
    if (!debouncedSearchValue) return exam.answers;
    const query = debouncedSearchValue.toLowerCase();
    return exam.answers.filter(
      (answer) =>
        answer.questionText?.toLowerCase().includes(query) ||
        answer.questionNumber.toString().includes(query)
    );
  }, [debouncedSearchValue, exam]);

  if (loadingQuestions) {
    return (
      <Flex vertical align="center" justify="center" gap={16} style={{ padding: '100px 20px', width: '100%', textAlign: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Đang tải bộ đề...</Title>
        <Text type="secondary">Vui lòng chờ trong giây lát</Text>
      </Flex>
    );
  }

  if (!isUnlocked && subject) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
        <Card
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            borderRadius: 24,
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #e5e7eb'
          }}
        >
          <Flex vertical align="center" gap={20}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: 30,
              background: '#fff7ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f97316'
            }}>
              <Lock size={40} />
            </div>

            <div>
              <Title level={2} style={{ marginBottom: 8 }}>Môn học đang bị khóa</Title>
              <Text type="secondary" style={{ fontSize: 16 }}>
                Bạn cần mở khóa môn <b>{subject.name}</b> để xem nội dung câu hỏi và đáp án chi tiết.
              </Text>
            </div>

            <div style={{
              padding: '12px 24px',
              background: '#f8fafc',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <Text strong style={{ fontSize: 18, color: '#f59e0b' }}>{subject.unlockCoin} Xu</Text>
              <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
              <Text type="secondary">Phí mở khóa vĩnh viễn</Text>
            </div>

            <Flex gap={12}>
              <Button size="large" onClick={() => navigate('/')} style={{ borderRadius: 12 }}>
                Quay lại
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<Unlock size={18} />}
                onClick={() => setIsModalVisible(true)}
                style={{ borderRadius: 12, height: 48, padding: '0 32px', background: 'var(--gradient-primary)', border: 'none' }}
              >
                Mở khóa ngay
              </Button>
            </Flex>
          </Flex>
        </Card>

        <Modal
          title="Xác nhận mở khóa"
          open={isModalVisible}
          onOk={handleConfirmUnlock}
          onCancel={() => setIsModalVisible(false)}
          confirmLoading={isUnlocking}
          okText="Mở khóa"
          cancelText="Hủy"
          centered
        >
          <div style={{ padding: '16px 0' }}>
            <Text>Dùng <b>{subject.unlockCoin} Coin</b> để mở khóa trọn đời môn <b>{subject.name}</b>?</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Số dư của bạn: {currentUser?.coin || 0} Coin</Text>
          </div>
        </Modal>
      </div>
    );
  }

  if (!exam || !subject) {
    return (
      <Flex vertical align="center" gap={16} style={{ padding: 48 }}>
        <Empty description="Không tìm thấy bài kiểm tra cho môn này" />
        <Button onClick={() => navigate('/')}>Về trang chủ</Button>
      </Flex>
    );
  }

  const getGridOptionStyle = (option: string, correctAnswer: string): React.CSSProperties => {
    const isCorrect = option === correctAnswer;
    return {
      flex: 1,
      height: 34,
      border: isCorrect ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--border-subtle)',
      background: isCorrect ? 'rgba(16,185,129,0.1)' : 'var(--bg-glass)',
      color: isCorrect ? '#10b981' : 'var(--text-secondary)',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: isCorrect ? 600 : 500,
      cursor: 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s ease',
      fontFamily: 'var(--font-family)',
    };
  };

  const renderDetailedOption = (answer: Answer, option: typeof ANSWER_OPTIONS[number]) => {
    const isCorrect = option === answer.correctAnswer;
    if (showOnlyCorrect && !isCorrect) return null;

    const optionText = answer.options?.[option] ?? option;

    const bgColor = isCorrect ? 'rgba(16,185,129,0.1)' : 'transparent';
    const borderColor = isCorrect ? 'rgba(16,185,129,0.5)' : 'var(--border-subtle)';
    const textColor = isCorrect ? 'var(--color-success)' : 'var(--text-secondary)';
    const labelBg = isCorrect ? 'var(--color-success)' : 'var(--bg-glass)';
    const labelColor = isCorrect ? '#fff' : 'var(--text-muted)';
    const fontWeight = isCorrect ? 500 : 400;

    return (
      <div
        key={option}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '4px 6px',
          borderRadius: 10,
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          cursor: 'default',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: labelBg,
            color: labelColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {option}
        </div>

        <div
          className="q-html-content"
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight,
            color: textColor,
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}
          dangerouslySetInnerHTML={{ __html: optionText }}
        />
      </div>
    );
  };

  const renderDetailedQuestion = (answer: Answer) => (
    <div
      key={answer.questionNumber}
      className="question-container"
      style={{
        marginBottom: 28,
        animation: `fadeInUp 0.3s ease-out ${answer.questionNumber * 0.03}s both`,
      }}
    >
      <Flex align="flex-start" gap={8} style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 15, color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }}>
          Câu {answer.questionNumber}:
        </Text>
        <div
          className="q-html-content"
          style={{
            fontSize: 15,
            color: 'var(--text-primary)',
            fontWeight: 600,
            lineHeight: 1.5
          }}
          dangerouslySetInnerHTML={{ __html: answer.questionText || '' }}
        />
      </Flex>

      <div>{ANSWER_OPTIONS.map((option) => renderDetailedOption(answer, option))}</div>
    </div>
  );

  const renderGridView = () => (
    <Row gutter={[8, 8]}>
      {filteredAnswers.map((answer) => (
        <Col xs={12} sm={8} md={6} lg={4} key={answer.questionNumber}>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '8px 12px',
            }}
          >
            <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                Câu {answer.questionNumber}
              </Text>
            </Flex>

            <Flex gap={4}>
              {ANSWER_OPTIONS.map((option) => (
                <div key={option} style={getGridOptionStyle(option, answer.correctAnswer)}>
                  {(!showOnlyCorrect || option === answer.correctAnswer) ? option : ''}
                </div>
              ))}
            </Flex>
          </div>
        </Col>
      ))}
    </Row>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div
        className="no-print"
        style={{
          position: 'sticky',
          top: 64,
          zIndex: 90,
          padding: '16px 0',
          background: 'rgba(245, 245, 245, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          marginBottom: 16,
          borderRadius: 16,
        }}
      >
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <div>
            <Title level={screens.md ? 2 : 4} style={{ margin: '0 0 4px', color: 'var(--text-primary)', letterSpacing: -0.5 }}>
              {subject.name} {!screens.md && <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal', whiteSpace: 'nowrap' }}>({exam.totalQuestions} câu)</Text>}
            </Title>
            {screens.md && (
              <Flex align="center" gap={8}>
                <Tag color="blue">{exam.examCode}</Tag>
                <Text type="secondary">{exam.totalQuestions} câu</Text>
              </Flex>
            )}
          </div>

          <Flex align="center" gap={16} wrap="wrap" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Button
              icon={<Download size={16} />}
              onClick={handleExportPDF}
              style={{ fontWeight: 500 }}
            >
              In
            </Button>
            <Checkbox
              checked={showOnlyCorrect}
              onChange={(e) => setShowOnlyCorrect(e.target.checked)}
              style={{ fontWeight: 500 }}
            >
              Ẩn đáp án sai
            </Checkbox>
            <div style={{ maxWidth: 320, width: '100%' }}>
              <Input
                prefix={<Search size={16} style={{ color: 'var(--text-muted)' }} />}
                placeholder="Tìm câu hỏi theo số hoặc nội dung..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                allowClear
                style={{ borderRadius: 20 }}
              />
            </div>
          </Flex>
        </Flex>
      </div>

      {hasDetailedQuestions ? (
        <Card
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
          }}
        >
          {filteredAnswers.length > 0 ? (
            filteredAnswers
              .filter((answer) => answer.questionText && answer.options)
              .map((answer) => renderDetailedQuestion(answer))
          ) : (
            <Empty description="Không tìm thấy câu hỏi" style={{ margin: '32px 0' }} />
          )}
        </Card>
      ) : filteredAnswers.length > 0 ? (
        renderGridView()
      ) : (
        <Empty description="Không tìm thấy câu hỏi" style={{ margin: '32px 0' }} />
      )}
    </div>
  );
};

export default AnswerKeyPage;
