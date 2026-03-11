const fetch = require('node-fetch');

// 캐시 변수 (Vercel 인스턴스가 살아있는 동안 유지)
let cachedData = null;
let lastFetchTime = null;

module.exports = async (req, res) => {
    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
        const prompt = `Based on these 5 news headlines, create a concise daily news briefing in Korean.
        
        News Articles:
        ${articlesContext}
        
        Requirements:
        1. headlineSummary: 1-2 Korean sentences.
        2. newsItems: 5 items with title and 1-sentence content.
        3. podcastScript: Professional tone.
        
        Return ONLY valid JSON:
        {
          "date": "${todayStr}",
          "headlineSummary": "...",
          "newsItems": [{"title": "...", "content": "..."}],
          "podcastScript": ["..."]
        }`;

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
                    temperature: 0.5,
                    maxOutputTokens: 800
                }
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiData.error) {
            throw new Error(`Gemini API Error: ${geminiData.error.message}`);
        }

        // 안전한 데이터 추출
        if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error("Gemini Response Structure Issue:", JSON.stringify(geminiData));
            throw new Error("AI did not return a valid content structure.");
        }

        let resultText = geminiData.candidates[0].content.parts[0].text;

        // JSON 추출
        let resultJson;
        try {
            // response_mime_type: "application/json"이 설정되어 있으면 바로 파싱 가능
            resultJson = JSON.parse(resultText);
        } catch (parseError) {
            console.warn("Direct JSON parsing failed, attempting cleanup:", parseError);
            const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
            let cleanedJsonText = jsonMatch ? jsonMatch[1].trim() : resultText.trim();

            if (!cleanedJsonText.startsWith('{')) {
                const bruteMatch = cleanedJsonText.match(/\{[\s\S]*\}/);
                if (bruteMatch) cleanedJsonText = bruteMatch[0].trim();
            }
            resultJson = JSON.parse(cleanedJsonText);
        }

        if (!resultJson.newsItems || !resultJson.headlineSummary) {
            throw new Error("Missing required fields in AI response");
        }

        // 결과 저장 및 반환
        cachedData = resultJson;
        lastFetchTime = todayStr;

        res.status(200).json(resultJson);
    } catch (error) {
        console.error("API Error:", error.message);

        // 에러 발생 시 캐시가 있으면 반환, 없으면 에러 응답
        if (cachedData) {
            console.log("Error occurred, serving stale cache");
            res.status(200).json(cachedData);
        } else {
            res.status(500).json({
                error: "Internal Server Error",
                message: error.message,
                details: error.message || "Please check API keys and quota."
            });
        }
    }
};

