const fetch = require('node-fetch');

// 캐시 변수 (Vercel 인스턴스가 살아있는 동안 유지)
let cachedData = null;
let lastFetchTime = null;

module.exports = async (req, res) => {
    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // 0. API 키 확인 가드
    if (!NEWS_API_KEY || !GEMINI_API_KEY) {
        const missing = [];
        if (!NEWS_API_KEY) missing.push("NEWS_API_KEY");
        if (!GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
        console.error(`Missing API Keys: ${missing.join(', ')}`);
        return res.status(500).json({
            error: "Configuration Error",
            message: `Missing Environment Variables: ${missing.join(', ')}`,
            details: "Please set the API keys in Vercel environment variables or local .env file."
        });
    }

    // 한국 시간 기준 날짜 확인
    const now = new Date();
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayStr = kstNow.toISOString().split('T')[0];

    // 캐시 사용 조건: 오늘 이미 데이터를 가져왔고 날짜가 같을 때
    if (cachedData && lastFetchTime === todayStr) {
        console.log("Serving from cache");
        return res.status(200).json(cachedData);
    }

    try {
        // 1. 뉴스 데이터 수집 (News API)
        const domains = 'reuters.com,apnews.com,bloomberg.com,bbc.co.uk,techcrunch.com';
        const newsUrl = `https://newsapi.org/v2/everything?domains=${domains}&language=en&pageSize=5&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;

        console.log("Fetching news from News API...");
        const newsResponse = await fetch(newsUrl);
        const newsData = await newsResponse.json();

        if (newsData.status === "error") {
            throw new Error(`News API Error: ${newsData.message}`);
        }

        if (!newsData.articles || newsData.articles.length === 0) {
            throw new Error("No news articles found (News API returned empty)");
        }

        const articlesContext = newsData.articles
            .filter(a => a.title && a.description)
            .map(a => `- ${a.title}: ${a.description}`)
            .join('\n');

        if (!articlesContext) {
            throw new Error("No valid articles to summarize");
        }

        // 2. AI 요약 및 팟캐스트 스크립트 생성 (Gemini API)
        // 모델 ID를 안정적인 gemini-1.5-flash로 변경
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `Based on these 5 news headlines, create a concise daily news briefing in Korean.
        
        News Articles:
        ${articlesContext}
        
        Requirements:
        1. headlineSummary: 1-2 Korean sentences synthesizing the main theme.
        2. newsItems: exactly 5 items, each with "title" and "content" (1 sentence summary).
        3. podcastScript: natural, professional broadcast style script.
        
        Return ONLY valid JSON in this format:
        {
          "date": "${todayStr}",
          "headlineSummary": "오늘의 주요 뉴스 요약...",
          "newsItems": [{"title": "제목", "content": "내용"}],
          "podcastScript": ["안녕하세요...", "..."]
        }`;

        console.log("Generating summary with Gemini API...");
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ 
                    role: "user",
                    parts: [{ text: prompt }] 
                }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiData.error) {
            throw new Error(`Gemini API Error: ${geminiData.error.message || JSON.stringify(geminiData.error)}`);
        }

        // 안전한 데이터 추출
        if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error("Gemini Response Structure Issue:", JSON.stringify(geminiData));
            throw new Error("AI did not return a valid content structure.");
        }

        let resultText = geminiData.candidates[0].content.parts[0].text;

        // JSON 추출 및 정제 로직 강화
        let resultJson;
        try {
            // 마크다운 코드 블록 제거 시도
            const jsonBody = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            resultJson = JSON.parse(jsonBody);
        } catch (parseError) {
            console.warn("Standard JSON parsing failed, attempting regex extraction:", parseError.message);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    resultJson = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    throw new Error("AI returned malformed JSON that couldn't be cleaned.");
                }
            } else {
                throw new Error("Could not find JSON object in AI response.");
            }
        }

        if (!resultJson.newsItems || !resultJson.headlineSummary) {
            throw new Error("Missing required fields in AI response structure.");
        }

        // 결과 저장 및 반환
        cachedData = resultJson;
        lastFetchTime = todayStr;

        console.log("Successfully generated news briefing for:", todayStr);
        res.status(200).json(resultJson);
    } catch (error) {
        console.error("API Processing Error:", error.message);

        // 에러 발생 시 캐시가 있으면 반환, 없으면 에러 응답
        if (cachedData) {
            console.log("Error occurred, serving stale cache");
            res.status(200).json(cachedData);
        } else {
            res.status(500).json({
                error: "Internal Server Error",
                message: error.message,
                details: "Check server logs for details. This may be due to API limits or malformed AI output."
            });
        }
    }
};

