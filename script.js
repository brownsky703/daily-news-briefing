document.addEventListener('DOMContentLoaded', () => {
    // API 데이터 기반 UI 업데이트 함수
    async function updateDynamicContent() {
        const headlineP = document.querySelector('#headline-summary p');
        const podcastSubtext = document.getElementById('podcast-subtext');

        try {
            const response = await fetch('/api/news');
            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.message || `Server Error (${response.status})`);
            }

            // 1. 날짜 및 헤드라인 업데이트
            if (data.date) {
                document.getElementById('current-date').textContent = `${data.date} (Automated)`;
            }
            if (data.headlineSummary) {
                headlineP.textContent = data.headlineSummary;
            }

            // 2. 뉴스 카드 업데이트
            if (data.newsItems && Array.isArray(data.newsItems)) {
                const cards = document.querySelectorAll('.grid .glass-card');
                data.newsItems.forEach((item, index) => {
                    if (cards[index]) {
                        const titleEl = cards[index].querySelector('h3');
                        const contentEl = cards[index].querySelector('p');
                        if (titleEl) titleEl.textContent = item.title || '...';
                        if (contentEl) contentEl.textContent = item.content || '데이터를 불러오지 못했습니다.';
                    }
                });
            }

            // 3. 팟캐스트 스크립트 업데이트
            if (data.podcastScript && Array.isArray(data.podcastScript)) {
                podcastScript.length = 0; // 기존 스크립트 비우기
                data.podcastScript.forEach(text => {
                    podcastScript.push({ text });
                });
            }

            console.log("뉴스 업데이트 완료:", data.date);
        } catch (error) {
            console.error("뉴스 로드 실패:", error);
            headlineP.textContent = "뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
            podcastSubtext.textContent = "오류: 뉴스 데이터를 가져올 수 없습니다.";

            // 로딩 중인 카드 텍스트 업데이트
            document.querySelectorAll('.grid .glass-card p').forEach(p => {
                if (p.textContent.includes('로딩')) {
                    p.textContent = '데이터를 불러오는 중 오류가 발생했습니다.';
                }
            });
        }
    }

    // 팟캐스트 스크립트 초기화 (API 호출 전 기본값)
    const podcastScript = [
        { text: "뉴스를 불러오는 중입니다. 잠시만 기다려 주세요." }
    ];

    // 페이지 로드 시 실행
    updateDynamicContent();

    let isPlaying = false;
    let currentLine = 0;
    const synth = window.speechSynthesis;
    let selectedVoice = null;

    // 목소리 로드 및 한국어 설정 (iOS 대응)
    function loadVoices() {
        const voices = synth.getVoices();
        selectedVoice = voices.find(voice => voice.lang.includes('ko-KR')) || voices[0];
    }

    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
    }
    loadVoices();

    const playBtn = document.getElementById('play-podcast');
    const playerContainer = document.querySelector('.podcast-player');
    const hostLabel = document.getElementById('current-host');
    const subtext = document.getElementById('podcast-subtext');

    function speakNextLine() {
        if (!isPlaying || currentLine >= podcastScript.length) {
            stopPodcast();
            return;
        }

        const line = podcastScript[currentLine];
        const utterance = new SpeechSynthesisUtterance(line.text);

        // 사용자의 피드백을 반영한 프리미엄 TTS 설정
        utterance.voice = selectedVoice;
        utterance.lang = 'ko-KR';
        utterance.rate = 1.35; // 속도 향상
        utterance.pitch = 1.1;  // 인간적인 톤 조절
        utterance.volume = 1;

        hostLabel.textContent = "AI 브리퍼";
        subtext.textContent = line.text;

        utterance.onend = () => {
            currentLine++;
            // 자연스러운 문장 간 호흡
            setTimeout(() => {
                speakNextLine();
            }, 500);
        };

        // iOS Safari를 위한 강제 중단 후 재생 방어 코드
        synth.cancel();
        synth.speak(utterance);
    }

    function togglePodcast() {
        if (isPlaying) {
            stopPodcast();
        } else {
            startPodcast();
        }
    }

    function startPodcast() {
        if (synth.speaking) synth.cancel();
        isPlaying = true;
        currentLine = 0;
        playerContainer.classList.add('playing');
        playBtn.innerHTML = '<i class="fas fa-stop"></i>';
        speakNextLine();
    }

    function stopPodcast() {
        isPlaying = false;
        synth.cancel();
        playerContainer.classList.remove('playing');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        hostLabel.textContent = "AI 브리퍼";
        subtext.textContent = "Global Briefing Podcast";
    }

    playBtn.addEventListener('click', togglePodcast);
});
