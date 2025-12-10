// front_hr_ai/src/dummyData.js

export const dummyUsers = [
  { id: 1, username: 'user', password: 'password', name: '김팀원', role: '팀원', team_id: 101 },
  { id: 2, username: 'leader', password: 'password', name: '박팀장', role: '팀장', team_id: 101 },
  { id: 4, username: 'admin', password: 'password', name: '최관리', role: '관리자' },
];

export const teamMembers = [
    { id: 1, name: '김팀원', team_id: 101, last_report_status: 'Good' },
    { id: 5, name: '정사원', team_id: 101, last_report_status: 'Stressed' },
    { id: 6, name: '오대리', team_id: 101, last_report_status: 'Normal' },
]

export const dummyMessages = [
  { text: '오늘 하루는 어떠셨어요? 편하게 오늘 있었던 일을 이야기해주세요.', sender: 'ai' },
  { text: '오늘 신규 기능 배포했는데, 중간에 버그가 터져서 정신이 하나도 없었어요. 너무 힘드네요.', sender: 'user' },
  { text: '아이고, 정말 고생 많으셨겠네요. 그래도 잘 해결하셨다니 다행입니다.', sender: 'ai' },
];

export const dummyReports = [
  {
    report_id: 1,
    user_id: 1, // 김팀원's report
    created_at: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    summary_content: `# HR 일일 리포트 (김팀원)

---

## 📅 오늘 한 일
- [x] 인증 시스템 리팩토링 완료
- [ ] 사용자 프로필 페이지 UI 개선

---

## ⚠️ 이슈 및 블로커
- 프로필 이미지 업로드 시 간헐적으로 500 에러 발생, 원인 파악 중

---

## 🚀 내일 할 일
- 프로필 이미지 업로드 버그 수정
- CI/CD 파이프라인 안정화 작업

---

## 😊 팀원 컨디션
- 보통 (업무량은 많지만, 잘 처리하고 있음)
`
  },
  {
    report_id: 2,
    user_id: 1, // 김팀원's report
    created_at: new Date().toISOString(),
    summary_content: `# HR 일일 리포트 (김팀원)

---

## 📅 오늘 한 일
- [x] 신규 기능 배포 완료 (중간에 버그 발생했으나 해결)
- [x] 팀 회의 참석 (다음 스프린트 계획 논의)

---

## ⚠️ 이슈 및 블로커
- 배포 과정에서 발생한 버그로 인해 시간이 많이 소요됨.
- 관련해서 팀장님과 이야기해봐야 할 것 같음.

---

## 🚀 내일 할 일
- 배포 안정성 개선 방안 논의
- A/B 테스트 설정

---

## 😊 팀원 컨디션
- 스트레스 높음 (예상치 못한 버그 발생으로 인해)
`
  },
];

export const dummyConversation = [
  { sender: 'ai', content: '안녕하세요! 오늘 하루는 어떠셨나요?', created_at: new Date(new Date().setHours(9, 5)).toISOString() },
  { sender: 'user', content: '오늘은 좀 정신이 없었네요. 신규 기능 배포가 있었거든요.', created_at: new Date(new Date().setHours(14, 15)).toISOString() },
  { sender: 'ai', content: '배포일이셨군요! 고생 많으셨습니다. 배포는 순조롭게 진행됐나요?', created_at: new Date(new Date().setHours(14, 16)).toISOString() },
  { sender: 'user', content: '아니요, 중간에 DB 마이그레이션 스크립트에서 오류가 나서 롤백하고 난리도 아니었어요.', created_at: new Date(new Date().setHours(16, 30)).toISOString() },
  { sender: 'ai', content: '아이고... 생각만 해도 아찔하네요. 정말 힘드셨겠어요. 지금은 괜찮으신가요?', created_at: new Date(new Date().setHours(16, 31)).toISOString() },
  { sender: 'user', content: '네, 다행히 원인 찾아서 해결하고 겨우 배포 끝냈습니다. 내일은 좀 쉬엄쉬엄 하고 싶네요.', created_at: new Date(new Date().setHours(17, 50)).toISOString() },
];

export const generateDummyAiResponse = (userInput, api) => {
  const responses = {
    grok: `Grok says: "${userInput}" is an interesting prompt. I'm a sarcastic and rebellious AI, so I'll probably give you a witty and slightly off-topic answer.`,
    gemini: `Gemini here. Based on your input "${userInput}", I can generate creative text formats, translate languages, write different kinds of creative content, and answer your questions in an informative way.`,
    chatgpt: `ChatGPT response: You said, "${userInput}". As a large language model from OpenAI, I am designed to be helpful and harmless. What can I help you with today?`,
    perplexity: `Perplexity AI here. Your query is "${userInput}". I will provide a direct answer with sources and citations, so you can verify the information.`,
    claude: `This is Claude. You've asked about "${userInput}". I am a constitutional AI from Anthropic, focused on being helpful, harmless, and honest.`,
  };

  const responseText = responses[api] || `"${userInput}" 라고 하셨군요. AI가 응답했습니다.`;

  return {
    text: responseText,
    sender: 'ai'
  };
};
