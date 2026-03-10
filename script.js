document.addEventListener('DOMContentLoaded', () => {
    // 날짜 업데이트
    const dateElement = document.getElementById('current-date');
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' };
    const today = new Date();
    dateElement.textContent = today.toLocaleDateString('ko-KR', options).toUpperCase().replace(/\./g, '.').replace(/ /g, ' ');

    // 스크롤 애니메이션 관찰자
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach(sec => {
        observer.observe(sec);
    });

    // Podcast Logic (1인 전문 브리퍼 체제 - iPhone Safari 최적화)
    const podcastScript = [
        { text: "반갑습니다. 오늘 하루 꼭 알아야 할 글로벌 주요 뉴스, 빠르게 정리해 드립니다." },
        { text: "먼저 중동 상황입니다. 트럼프 대통령이 전쟁의 '완성 단계'를 언급하며 긴장이 최고조에 달했는데요. 이로 인해 유가가 배럴당 120달러까지 치솟으면서 우리 증시를 포함한 아시아 시장 전체가 큰 충격을 받았습니다." },
        { text: "경제 쪽을 보면, 스태그플레이션에 대한 공포가 현실화되는 모양새입니다. G7 국가들이 비축유 방출을 논의하며 시장 안정에 나섰지만, 환율이 17년 만에 최고치를 기록하는 등 불안은 여전합니다." },
        { text: "다음은 기술 소식입니다. OpenAI의 새로운 모델 '시그마'가 자가 인식 논쟁을 불러일으켰습니다. 단순히 똑똑한 AI를 넘어 인지 능력이 있는 것 아니냐는 분석이 나오면서 기술계가 뜨겁습니다." },
        { text: "마지막으로 스페이스X의 스타쉽이 화성 무인 착륙에 성공했다는 소식까지 전해드리면서, 오늘 브리핑 마칩니다. 지금까지 글로벌 브리핑이었습니다." }
    ];

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
