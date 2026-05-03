// Script lấy thông tin các câu hỏi ôn tập
// Bạn có thể copy đoạn script này và chạy trực tiếp trong tab Console của trình duyệt (F12 -> Console) trên trang web chứa câu hỏi.

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function extractQuestions() {
    const questions = [];

    // Lấy tất cả các câu hỏi (cả đúng và sai)
    const questionNodes = document.querySelectorAll('.que.multichoice');

    questionNodes.forEach(node => {
        // 1. Lấy nội dung câu hỏi
        const qtextNode = node.querySelector('.qtext');
        const questiontext = qtextNode ? qtextNode.innerText.trim() : "";
        const questionhtml = qtextNode ? qtextNode.innerHTML.trim() : "";

        // 2. Lấy nội dung đáp án đúng
        const rightAnswerNode = node.querySelector('.rightanswer');
        let answer = "";
        let answerhtml = "";
        if (rightAnswerNode) {
            answer = rightAnswerNode.innerText.replace('Câu trả lời đúng là:', '').trim();
            answerhtml = rightAnswerNode.innerHTML.trim();
        }

        // 3. Lấy danh sách các lựa chọn
        const options = [];
        const optionNodes = node.querySelectorAll('.answer > div'); // Lấy các div con trực tiếp của .answer (ví dụ: .r0, .r1)

        optionNodes.forEach(optNode => {
            // Lấy phần tử chứa text của đáp án (bỏ qua phần label a, b, c, d)
            const textNode = optNode.querySelector('.flex-fill');
            if (textNode) {
                const text = textNode.innerText.trim();
                const texthtml = textNode.innerHTML.trim();

                options.push({
                    id: generateId(),
                    text: text,
                    texthtml: texthtml
                });
            }
        });

        // 4. Thêm vào mảng kết quả
        questions.push({
            id: generateId(),
            questiontext: questiontext,
            questionhtml: questionhtml,
            answer: answer,
            answerhtml: answerhtml,
            options: options
        });
    });

    return questions;
}

// Chạy hàm và in kết quả ra màn hình (dạng JSON)
const result = extractQuestions();
console.log(result);
