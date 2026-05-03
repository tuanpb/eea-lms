import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { message } from 'antd';
import type { Exam, Subject, Answer } from '../lib/types';
import { supabase } from '../lib/supabase';

interface ExamState {
  subjects: Subject[];
  lastFetchedSubjects: number | null;
  initialized: boolean;
  loading: boolean;
  loadingQuestions: boolean;
  currentExam: Exam | null;
  unlockedSubjectIds: string[];
  unlockedDataUrls: Record<string, string>; // Ánh xạ từ ID môn học sang URL dữ liệu
  initializeData: () => Promise<void>;
  fetchSubjects: (forceRefresh?: boolean) => Promise<void>;
  fetchUnlockedSubjects: () => Promise<void>;
  fetchQuestionsFromUrl: (subjectId: string, url: string) => Promise<void>;
  unlockSubject: (subjectId: string, cost: number) => Promise<{ success: boolean; error?: string }>;
  getExamBySubject: (subjectId: string) => Exam | undefined;
  subscribeToSubjects: () => () => void;
}

// Bỏ SUBJECT_CACHE_TTL vì chúng ta dùng cơ chế fetch lại khi khởi động app
// và dùng Realtime để cập nhật liên tục.

export const useExamStore = create<ExamState>()(
  persist(
    (set, get) => ({
      subjects: [],
      lastFetchedSubjects: null,
      initialized: false,
      loading: false,
      loadingQuestions: false,
      currentExam: null,
      unlockedSubjectIds: [],
      unlockedDataUrls: {},

      initializeData: async () => {
        await get().fetchSubjects();
        await get().fetchUnlockedSubjects();
        set({ initialized: true });
      },

      fetchUnlockedSubjects: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Kết hợp (JOIN) với bảng subjects để lấy data_url một cách an toàn
        const { data, error } = await supabase
          .from('user_subjects')
          .select('subject_id, subjects(data_url)')
          .eq('user_id', session.user.id);

        if (error) {
          console.error('Lỗi khi lấy danh sách môn học đã mua:', error);
          return;
        }

        if (data) {
          const ids: string[] = [];
          const urls: Record<string, string> = {};

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.forEach((item: any) => {
            if (item.subject_id) {
              ids.push(item.subject_id);
              const subjectData = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;
              if (subjectData?.data_url) {
                urls[item.subject_id] = subjectData.data_url;
              }
            }
          });

          set({
            unlockedSubjectIds: ids,
            unlockedDataUrls: urls
          });
        }
      },

      unlockSubject: async (subjectId: string, cost: number) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return { success: false, error: 'Vui lòng đăng nhập để thực hiện' };

        const { data: profile } = await supabase
          .from('profiles')
          .select('coin')
          .eq('id', session.user.id)
          .single();

        if (!profile || (profile.coin || 0) < cost) {
          return { success: false, error: 'Số dư không đủ. Vui lòng nạp thêm Coin.' };
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ coin: (profile.coin || 0) - cost })
          .eq('id', session.user.id);

        if (updateError) return { success: false, error: 'Lỗi khi trừ Coin' };

        const { error: insertError } = await supabase
          .from('user_subjects')
          .insert({ user_id: session.user.id, subject_id: subjectId });

        if (insertError) {
          await supabase.from('profiles').update({ coin: profile.coin }).eq('id', session.user.id);
          return { success: false, error: 'Lỗi khi kích hoạt môn học' };
        }

        // Ghi log giao dịch chi tiêu
        const subject = get().subjects.find(s => s.id === subjectId);
        await supabase.from('coin_transactions').insert({
          user_id: session.user.id,
          amount: -cost,
          type: 'PURCHASE',
          description: `Mở khóa môn học: ${subject?.name || 'Không xác định'}`,
        });

        // Tải lại để lấy data_url cho môn học vừa mở khóa
        await get().fetchUnlockedSubjects();

        return { success: true };
      },

      fetchQuestionsFromUrl: async (subjectId: string, url: string) => {
        if (!url) return;
        set({ loadingQuestions: true, currentExam: null });
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Không thể tải file dữ liệu');
          const data = await response.json();

          if (data && data.questions) {
            const subject = get().subjects.find(s => s.id === subjectId);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const answers: Answer[] = data.questions.map((q: any, index: number) => {
              // Kiểm tra nếu là cấu trúc cũ (có qHtml hoặc optHtmlA)
              // if (q.qHtml || q.optHtmlA) {
              //   return {
              //     questionNumber: index + 1,
              //     questionText: q.qHtml || q.question,
              //     options: {
              //       A: q.optHtmlA || q.optA,
              //       B: q.optHtmlB || q.optB,
              //       C: q.optHtmlC || q.optC,
              //       D: q.optHtmlD || q.optD,
              //     },
              //     correctAnswer: ['A', 'B', 'C', 'D'][q.correctIndex || 0] as 'A' | 'B' | 'C' | 'D',
              //   };
              // }

              // Cấu trúc mới
              const options: Record<string, string> = { A: '', B: '', C: '', D: '' };
              let correctAnswer: 'A' | 'B' | 'C' | 'D' = 'A';

              if (q.options && Array.isArray(q.options)) {
                q.options.forEach((opt: any, i: number) => {
                  const label = ['A', 'B', 'C', 'D'][i] as 'A' | 'B' | 'C' | 'D';
                  if (label) {
                    options[label] = opt.texthtml || opt.text;

                    // Xác định đáp án đúng bằng cách so khớp nội dung
                    // q.answerhtml thường chứa nội dung của đáp án đúng
                    const optContent = opt.texthtml || opt.text;
                    const isCorrect = (q.answerhtml && q.answerhtml.includes(optContent)) ||
                      (q.answer && q.answer.includes(opt.text));

                    if (isCorrect) {
                      correctAnswer = label;
                    }
                  }
                });
              }

              return {
                questionNumber: index + 1,
                questionText: q.questionhtml || q.questiontext,
                options: options as { A: string; B: string; C: string; D: string },
                correctAnswer,
              };
            });

            const dynamicExam: Exam = {
              id: `dynamic-${subjectId}`,
              examCode: 'Toàn bộ câu hỏi',
              subjectId,
              subjectName: subject?.name || 'Môn học',
              totalQuestions: answers.length,
              answers: answers,
              createdAt: new Date().toISOString(),
            };

            set({ currentExam: dynamicExam });
          }
        } catch (error) {
          console.error('Lỗi khi tải bộ câu hỏi:', error);
          message.error('Lỗi khi tải dữ liệu câu hỏi từ Server');
        } finally {
          set({ loadingQuestions: false });
        }
      },

      fetchSubjects: async (forceRefresh = false) => {
        const { subjects } = get();

        // Nếu không ép buộc refresh và chưa có dữ liệu nào (lần đầu tiên hoàn toàn)
        // thì mới hiện loading. Nếu đã có subjects từ persist, chúng ta fetch ngầm.
        if (!forceRefresh && subjects.length > 0) {
          // Vẫn thực hiện fetch ngầm để cập nhật dữ liệu mới nhất từ server
          // nhưng không set loading=true để tránh nhảy giao diện
          try {
            const { data } = await supabase
              .from('subjects')
              .select('id, name, description, unlock_coin, rental_coin, active')
              .eq('active', 1)
              .order('name', { ascending: true });

            if (data) {
              const mappedSubjects: Subject[] = data.map((item: any) => ({
                id: item.id,
                name: item.name,
                description: item.description,
                unlockCoin: Number(item.unlock_coin) || 0,
                rentalCoin: Number(item.rental_coin) || 0,
                examCount: 1,
                active: item.active || 1,
              }));
              set({ subjects: mappedSubjects, lastFetchedSubjects: Date.now() });
            }
          } catch (e) {
            console.error("Silent refresh failed", e);
          }
          return;
        }

        set({ loading: true });
        try {
          const { data, error } = await supabase
            .from('subjects')
            .select('id, name, description, unlock_coin, rental_coin, active')
            .eq('active', 1)
            .order('name', { ascending: true });

          if (error) throw error;

          if (data) {
            const mappedSubjects: Subject[] = data.map((item: { id: string; name: string; description?: string; unlock_coin: string | number; rental_coin?: string | number; active?: number }) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              unlockCoin: Number(item.unlock_coin) || 0,
              rentalCoin: Number(item.rental_coin) || 0,
              examCount: 1,
              active: item.active || 1,
            }));
            set({ subjects: mappedSubjects, lastFetchedSubjects: Date.now() });
          }
        } catch (error) {
          console.error('Lỗi khi lấy danh sách môn học:', error);
        } finally {
          set({ loading: false });
        }
      },

      getExamBySubject: (subjectId: string) => {
        const currentExam = get().currentExam;
        if (currentExam && currentExam.subjectId === subjectId) {
          return currentExam;
        }
        return undefined;
      },

      subscribeToSubjects: () => {
        const channel = supabase
          .channel('subjects-realtime')
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'subjects' },
            (payload) => {
              const updatedSubject = payload.new as {
                id: string;
                unlock_coin: number;
                rental_coin: number;
                active: number
              };

              set((state) => ({
                subjects: state.subjects.map((s) =>
                  s.id === updatedSubject.id
                    ? {
                      ...s,
                      unlockCoin: Number(updatedSubject.unlock_coin) || 0,
                      rentalCoin: Number(updatedSubject.rental_coin) || 0,
                      active: updatedSubject.active,
                    }
                    : s
                ),
              }));
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      },
    }),
    {
      name: 'dhtn-exam-storage',
      version: 2, // Tăng version để xóa cache cũ (tránh lỗi cache không có rental_coin)
      partialize: (state) => ({
        unlockedSubjectIds: state.unlockedSubjectIds,
        unlockedDataUrls: state.unlockedDataUrls,
        subjects: state.subjects,
        lastFetchedSubjects: state.lastFetchedSubjects
      }),
    }
  )
);
