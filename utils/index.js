export const combineResults = (form, results) => {
    for (let page of form.pages) {
        for (let question of page.questions) {
            const result = results[question.id] || {};

            if (question.type === "mcq") {
                for (let option of question.options) {
                    option.count = result[option.value] || 0;
                }
            } else {
                const entries = Object.entries(result);

                for (const [answerKey, countValue] of entries) {                
                    if (!question.responses) {
                        question.responses = [];
                    }
                    for (let i = 0; i < countValue; i++) {
                        question.responses.push(answerKey)
                    }
                }

            }
        }
    }
    return form;
}
