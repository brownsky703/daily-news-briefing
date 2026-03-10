const fetch = require('node-fetch');

// 캐시 변수 (Vercel 인스턴스가 살아있는 동안 유지)
let cachedData = null;
let lastFetchTime = null;

module.exports = async (req, res) => {
    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // 한국 시간 기준 날짜 확인
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStr = kstNow.toISOString().split('T')[0];

    // 오전 8시 이후인지 확인 (간단한 캐시 로직)
    const isAfter8AM = kstNow.getUTCHours() >= 8;

    // 캐시 사용 조건: 오늘 이미 데이터를 가져왔고 날짜가 같을 때
    if (cachedData && lastFetchTime === todayStr) {
        console.log("Serving from cache");
        return res.status(200).json(cachedData);
    }

    try {
        // 1. 뉴스 데이터 수집 (News API)
        // 선호 언론사 필터링 (domains 파라미터 활용)
        const domains = 'reuters.com,apnews.com,bloomberg.com,bbc.co.uk,techcrunch.com';
        const newsUrl = `https://newsapi.org/v2/everything?domains=${domains}&language=en&pageSize=15&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

        const newsResponse = await fetch(newsUrl);
        const newsData = await newsResponse.json();

        if (!newsData.articles || newsData.articles.length === 0) {
            throw new Error("No news articles found");
        }

        const articlesContext = newsData.articles.map(a => `- ${a.title}: ${a.description}`).join('\n');

        // 2. AI 요약 및 팟캐스트 스크립트 생성 (Gemini API)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const prompt = `
        You are a professional news briefer. Based on the following news headlines and descriptions, create a daily briefing in Korean.
        
        News Articles:
        ${articlesContext}
        
        Requirements:
        1. Summarize the main themes into a 1-2 sentence "headlineSummary".
        2. Select the top 6 news items and provide a concise summary for each.
        3. Create a professional "podcastScript" in Korean. The tone should be calm, authoritative, and direct (Professional Briefer style). Avoid over-friendly greetings. Start immediately with the core summary.
        
        Output MUST be in strict JSON format:
        {
          "date": "${todayStr}",
          "headlineSummary": "...",
          "newsItems": [
            {"title": "...", "content": "..."},
            ...
          ],
          "podcastScript": [
            "...", "..."
          ]
        }
        `;

        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const geminiData = await geminiResponse.json();
        const resultText = geminiData.candidates[0].content.parts[0].text;
        const resultJson = JSON.parse(resultText);

        // 결과 저장 및 반환
        cachedData = resultJson;
        lastFetchTime = todayStr;

        res.status(200).json(resultJson);
    } catch (error) {
        console.error("API Error:", error);
        // 에러 발생 시 기본값 또는 이전 캐시 반환
        if (cachedData) {
            res.status(200).json(cachedData);
        } else {
            res.status(500).json({ error: "Failed to fetch news", message: error.message });
        }
    }
};
