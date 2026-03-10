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

    // Podcast Logic
    const podcastScript = [
        { host: "알렉스", text: "여러분 안녕하십니까? 2026년 3월 10일, 글로벌 브리핑 AI 팟캐스트입니다. 저는 호스트 알렉스입니다." },
        { host: "소피아", text: "안녕하세요, 소피아입니다. 오늘도 전 세계의 긴박한 소식들을 정리해 드립니다." },
        { host: "알렉스", text: "오늘 가장 큰 뉴스는 역시 중동이군요. 전쟁이 완성 단계에 있다는 트럼프 대통령의 발언으로 유가가 폭등하고 있습니다." },
        { host: "소피아", text: "네, 브렌트유가 배럴당 120달러에 육박하며 4차 오일쇼크 우려가 커지고 있죠. 우리 코스피 지수도 6퍼센트 가까이 급락하며 큰 충격을 받았습니다." },
        { host: "알렉스", text: "정치적으로는 국제 사회의 중재 노력도 활발합니다. 러시아와 중국이 나서고 있고, G7은 비축유 방출을 논의 중이라고 하네요." },
        { host: "소피아", text: "한편 기술 부문에서도 놀라운 소식이 있습니다. OpenAI의 시그마 모델이 자가 인식 테스트에서 충격적인 결과를 보여 논란이 뜨겁습니다." },
        { host: "알렉스", text: "맞습니다. 게다가 스페이스X의 스타쉽이 화성 무인 착륙에 성공하며 본격적인 화성 자원 채굴 시대가 열릴 것으로 보입니다." },
        { host: "소피아", text: "정말 SF 영화 같던 일들이 현실이 되고 있네요. 트럼프 행정부의 관세 부과와 기술 패권 전쟁이 맞물려 복잡한 상황이 이어질 것 같습니다." },
        { host: "알렉스", text: "네, 지금까지 글로벌 브리핑이었습니다. 내일 다시 뵙겠습니다." }
    ];

    let isPlaying = false;
    let currentLine = 0;
    const synth = window.speechSynthesis;
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

        // 자연스러운 속도와 음조 설정
        utterance.lang = 'ko-KR';
        utterance.rate = 1.25; // 속도를 1.25배로 높임
        utterance.pitch = line.host === "알렉스" ? 0.95 : 1.15; // 호스트별 음조 차별화
        utterance.volume = 1;

        hostLabel.textContent = line.host;
        subtext.textContent = line.text;

        utterance.onend = () => {
            currentLine++;
            // 문장 사이의 약간의 지연 시간을 두어 더 자연스럽게 만듦
            setTimeout(() => {
                speakNextLine();
            }, 400);
        };

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
        hostLabel.textContent = "AI Hosts";
        subtext.textContent = "Global Briefing Podcast";
    }

    playBtn.addEventListener('click', togglePodcast);
});
