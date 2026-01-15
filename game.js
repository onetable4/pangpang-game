// Firebase 라이브러리 임포트 (CDN 사용)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyAX0l8-8L3lPMWZvrEEEOCosAUAV5GVu2Y",
    authDomain: "pangpang-28211.firebaseapp.com",
    databaseURL: "https://pangpang-28211-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pangpang-28211",
    storageBucket: "pangpang-28211.firebasestorage.app",
    messagingSenderId: "1094639744530",
    appId: "1:1094639744530:web:bcee1b1fd9f9c40daf0acb"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 게임 상수
const BOARD_SIZE = 7;
const TILE_TYPES = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨'];
const GAME_DURATION = 60; // 60초

// (삭제됨 - 하단에서 재정의됨)

// 게임 상태
let board = [];
let specialBoard = []; // 특수 블록 정보 저장
let selectedTile = null;
let score = 0;
let combo = 0; // combo starts at 0
let lastMatchTime = 0; // 마지막 매치 시각 (시간 기반 콤보용)
let isProcessing = false;
let gameStarted = false;
let gameTimer = null;
let timeRemaining = GAME_DURATION;
let playerName = localStorage.getItem('lastPlayerName') || '';

// 터치/스와이프 상태
let touchStartX = 0;
let touchStartY = 0;
let touchStartTile = null;

// DOM 요소
const gameBoard = document.getElementById('gameBoard');
const scoreDisplay = document.getElementById('score');
const comboDisplay = document.getElementById('combo');
const timerFill = document.getElementById('timerFill');
const timerText = document.getElementById('timerText');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalScore = document.getElementById('finalScore');

// 리더보드/닉네임 관련 DOM
const playerNameInput = document.getElementById('playerNameInput');
const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
const endShowLeaderboardBtn = document.getElementById('endShowLeaderboardBtn');
const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
const leaderboardOverlay = document.getElementById('leaderboardOverlay');
const leaderboardList = document.getElementById('leaderboardList');
const newRecordMessage = document.getElementById('newRecordMessage');

// 일시정지 관련 DOM
const pauseBtn = document.getElementById('pauseBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeBtn = document.getElementById('resumeBtn');
const pauseRestartBtn = document.getElementById('pauseRestartBtn');

// 닉네임 로드
if (playerName) {
    playerNameInput.value = playerName;
}

// 게임 초기화 (보드만 준비)
function initGame() {
    board = [];
    specialBoard = [];
    selectedTile = null;
    score = 0;
    combo = 0; // 콤보는 0부터 시작
    lastMatchTime = 0; // 시간 기반 콤보 초기화
    isProcessing = false;
    timeRemaining = GAME_DURATION;

    updateScore();
    updateCombo();
    updateTimer();
    newRecordMessage.classList.add('hidden');

    // 보드 생성 (매치 없이)
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        specialBoard[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = getRandomTileWithoutMatch(row, col);
            specialBoard[row][col] = null;
        }
    }

    renderBoard();
}

// 버튼 이벤트 리스너
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
    endOverlay.classList.add('hidden');
    startOverlay.classList.remove('hidden');
});

// 도움말 버튼 로직
const helpBtn = document.getElementById('helpBtn');
const helpOverlay = document.getElementById('helpOverlay');
const closeHelpBtn = document.getElementById('closeHelpBtn');

helpBtn.addEventListener('click', () => {
    helpOverlay.classList.remove('hidden');
    // 애니메이션 초기화 (선택 사항)
});

closeHelpBtn.addEventListener('click', () => {
    helpOverlay.classList.add('hidden');
});

// 리더보드 버튼 로직
showLeaderboardBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.remove('hidden');
    loadLeaderboard();
});

endShowLeaderboardBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.remove('hidden');
    loadLeaderboard();
});

closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.add('hidden');

    // 게임이 종료된 상태면 시작 화면으로
    if (!gameStarted) {
        endOverlay.classList.add('hidden');
        startOverlay.classList.remove('hidden');
    }
});

// 게임 시작
async function startGame() {
    const name = playerNameInput.value.trim();

    // 이름 검증
    if (!name) {
        playerNameInput.classList.add('input-error');
        playerNameInput.focus();

        // 흔들림 애니메이션 후 클래스 제거 (재실행 위해)
        setTimeout(() => {
            playerNameInput.classList.remove('input-error');
        }, 400);

        // 토스트 메시지 대신 placeholder 변경으로 알림
        const originalPlaceholder = playerNameInput.placeholder;
        playerNameInput.placeholder = "이름을 꼭 입력해주세요!";
        setTimeout(() => playerNameInput.placeholder = originalPlaceholder, 2000);

        return;
    }

    playerName = name;
    localStorage.setItem('lastPlayerName', playerName);

    // 오버레이 숨기기
    startOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
    leaderboardOverlay.classList.add('hidden');
    helpOverlay.classList.add('hidden');

    // 카운트다운 표시
    await showCountdown();

    // 카운트다운 후 게임 시작
    gameStarted = true;
    pauseBtn.classList.remove('hidden'); // 일시정지 버튼 표시
    initGame();
    startTimer();
}

// 일시정지 버튼 이벤트
pauseBtn.addEventListener('click', () => {
    if (!gameStarted || isProcessing) return;

    // 타이머 일시정지
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    // 일시정지 오버레이 표시
    pauseOverlay.classList.remove('hidden');
});

// 재개 버튼 이벤트
resumeBtn.addEventListener('click', () => {
    pauseOverlay.classList.add('hidden');

    // 타이머 재개
    if (gameStarted) {
        startTimer();
    }
});

// 일시정지 중 다시 하기 버튼
pauseRestartBtn.addEventListener('click', async () => {
    pauseOverlay.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    gameStarted = false;

    // 타이머 정리
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    // 시작 화면으로
    startOverlay.classList.remove('hidden');
});

// 카운트다운 표시
async function showCountdown() {
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownDisplay = document.getElementById('countdownDisplay');

    countdownOverlay.classList.remove('hidden');

    const sequence = ['Ready?', '3', '2', '1', 'Start!'];

    for (let i = 0; i < sequence.length; i++) {
        countdownDisplay.textContent = sequence[i];
        countdownDisplay.className = 'countdown-display';

        // 애니메이션 트리거
        void countdownDisplay.offsetWidth;
        countdownDisplay.classList.add('countdown-animate');

        await delay(i === 0 ? 800 : 700); // Ready는 조금 더 길게
    }

    countdownOverlay.classList.add('hidden');
}

// 타이머 시작
function startTimer() {
    if (gameTimer) clearInterval(gameTimer);

    gameTimer = setInterval(() => {
        timeRemaining -= 0.1;
        updateTimer();

        if (timeRemaining <= 0) {
            endGame();
        }
    }, 100);
}

// 타이머 업데이트
function updateTimer() {
    const percentage = (timeRemaining / GAME_DURATION) * 100;
    timerFill.style.width = `${percentage}%`;
    timerText.textContent = `${Math.ceil(timeRemaining)}초`;

    if (timeRemaining <= 10) {
        timerFill.classList.add('warning');
    } else {
        timerFill.classList.remove('warning');
    }
}

// DOM 요소 추가
const submitScoreBtn = document.getElementById('submitScoreBtn');
const championInputArea = document.getElementById('championInputArea');
const championMessageInput = document.getElementById('championMessageInput');
const championSection = document.getElementById('championSection');
const championMessageDisplay = document.getElementById('championMessageDisplay');
const championNameDisplay = document.getElementById('championNameDisplay');

// 게임 종료 처리
async function endGame() {
    gameStarted = false;
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    finalScore.textContent = score.toLocaleString();
    endOverlay.classList.remove('hidden');

    // UI 초기화
    submitScoreBtn.classList.remove('hidden'); // 항상 표시 (등록 버튼)
    championInputArea.classList.remove('hidden'); // 항상 표시 (메시지 입력)
    newRecordMessage.classList.add('hidden'); // 기본 숨김

    // 입력창 초기화
    const msgInput = document.getElementById('championMessageInput');
    const msgLabel = championInputArea.querySelector('p');
    msgInput.value = '';

    if (score === 0) return;

    // 1등인지 확인
    try {
        const scoresRef = ref(db, 'scores');
        // 전체 점수를 가져와서 직접 비교 (DB 문자열 정렬 문제 해결)
        // 데이터가 아주 많아지면 limitToLast(100) 등으로 최적화 필요하지만 지금은 안전성 우선
        const topScoreQuery = query(scoresRef, orderByChild('score'));
        const snapshot = await get(topScoreQuery);

        let highestScore = 0;
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const s = Number(child.val().score);
                if (s > highestScore) {
                    highestScore = s;
                }
            });
        }

        if (Number(score) > highestScore) {
            // 1등임! -> 축하 메시지 및 강조
            newRecordMessage.textContent = "🏆 전체 1등 달성! 🏆";
            newRecordMessage.classList.remove('hidden');

            msgLabel.style.color = '#ffd700';
            msgLabel.textContent = "👑 명예의 전당에 남길 한마디 👑";
            msgInput.placeholder = "챔피언의 소감을 남겨주세요!";
            submitScoreBtn.textContent = "명예의 전당 등록";
        } else {
            // 1등 아님 -> 일반 종료
            msgLabel.style.color = '#fff';
            msgLabel.textContent = "오늘의 한마디";
            msgInput.placeholder = "게임 소감을 남겨주세요";
            submitScoreBtn.textContent = "점수 등록";
        }
    } catch (e) {
        console.error("Error checking high score: ", e);
        // 에러 시 일반 모드로
        msgLabel.textContent = "오늘의 한마디";
        submitScoreBtn.textContent = "점수 등록";
    }
}

// 점수 등록 버튼 클릭
submitScoreBtn.addEventListener('click', async () => {
    const msg = championMessageInput.value.trim() || "게임은 즐겁게!";
    await saveScore(playerName, score, msg);

    // UI 업데이트
    championInputArea.classList.add('hidden');
    submitScoreBtn.classList.add('hidden');
    endOverlay.classList.add('hidden'); // 중복 등록 방지

    // 바로 리더보드 보여주기
    leaderboardOverlay.classList.remove('hidden');
    loadLeaderboard();
});

// Firebase: 점수 저장
async function saveScore(name, score, message) {
    if (score === 0) return;

    try {
        const scoresRef = ref(db, 'scores');
        const data = {
            name: name,
            score: score,
            timestamp: Date.now()
        };

        // 메시지가 있으면 추가 (1등인 경우)
        if (message) {
            data.message = message;
        }

        await push(scoresRef, data);

        // 내 최고 기록 업데이트
        const myBest = parseInt(localStorage.getItem('myBestScore') || '0');
        if (score > myBest) {
            localStorage.setItem('myBestScore', score);
        }

    } catch (e) {
        console.error("Error saving score: ", e);
    }
}

// Firebase: 리더보드 불러오기
async function loadLeaderboard() {
    leaderboardList.innerHTML = '<div class="loading">불러오는 중...</div>';
    championSection.classList.add('hidden'); // 일단 숨김

    try {
        const scoresRef = ref(db, 'scores');
        const topScoresQuery = query(scoresRef, orderByChild('score'), limitToLast(50));

        const snapshot = await get(topScoresQuery);

        if (snapshot.exists()) {
            const scores = [];
            snapshot.forEach((childSnapshot) => {
                scores.push(childSnapshot.val());
            });

            // 점수 내림차순 정렬
            scores.sort((a, b) => b.score - a.score);

            // 1등 메시지 표시
            if (scores.length > 0) {
                const champion = scores[0];
                const msg = champion.message || "도전자를 기다립니다!";
                championMessageDisplay.textContent = `"${msg}"`;
                championNameDisplay.textContent = `- ${escapeHtml(champion.name)} -`;
                championSection.classList.remove('hidden');
            }

            renderLeaderboard(scores);
        } else {
            leaderboardList.innerHTML = '<div class="loading">기록이 없습니다.</div>';
        }
    } catch (e) {
        console.error("Error loading leaderboard: ", e);
        leaderboardList.innerHTML = `<div class="loading" style="color: #ff6b6b; font-size: 0.9rem;">
            오류가 발생했습니다.<br>
            <span style="font-size: 0.8rem; opacity: 0.8;">${e.code || ''} ${e.message}</span>
        </div>`;
    }
}

// 리더보드 렌더링
function renderLeaderboard(scores) {
    leaderboardList.innerHTML = '';

    scores.forEach((entry, index) => {
        const rank = index + 1;
        const div = document.createElement('div');
        div.className = `rank-item rank-${rank}`;

        // 내 기록 강조 (이름으로 단순 비교)
        if (entry.name === playerName && entry.score === score &&
            (Date.now() - entry.timestamp) < 5000) {
            div.classList.add('my-rank');
        }

        // 툴팁 속성 추가 (메시지가 있는 경우)
        if (entry.message) {
            div.setAttribute('data-tooltip', `"${entry.message}"`);
        }

        const msgIcon = entry.message ? '<span class="msg-icon">💬</span>' : '';

        div.innerHTML = `
            <span class="rank-pos">${rank}</span>
            <span class="rank-name">${escapeHtml(entry.name)}${msgIcon}</span>
            <span class="rank-score">${entry.score.toLocaleString()}</span>
        `;

        leaderboardList.appendChild(div);
    });
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
    if (!text) return text;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// 매치가 생기지 않는 랜덤 타일 생성
function getRandomTileWithoutMatch(row, col) {
    let availableTypes = [...TILE_TYPES];

    // 왼쪽 2개 체크
    if (col >= 2 && board[row][col - 1] === board[row][col - 2]) {
        availableTypes = availableTypes.filter(t => t !== board[row][col - 1]);
    }

    // 위쪽 2개 체크
    if (row >= 2 && board[row - 1][col] === board[row - 2][col]) {
        availableTypes = availableTypes.filter(t => t !== board[row - 1][col]);
    }

    return availableTypes[Math.floor(Math.random() * availableTypes.length)];
}

// 랜덤 타일 생성 (단순 반환)
function getRandomTile() {
    return TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];
}

// 특수 블록 오작동 방지를 위한 플레이스홀더
const SPECIAL_PLACEHOLDER = '💎';

// 보드 렌더링
function renderBoard() {
    gameBoard.innerHTML = '';

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const tile = document.createElement('div');
            tile.className = 'tile';

            // 기본 동물 이모지 (플레이스홀더가 아닐 때만 표시)
            if (board[row][col] !== SPECIAL_PLACEHOLDER) {
                tile.textContent = board[row][col];
            }

            tile.dataset.row = row;
            tile.dataset.col = col;

            // 특수 블록 스타일 및 아이콘 적용
            const specialType = specialBoard[row][col];
            if (specialType) {
                tile.classList.add(specialType);

                // 아이콘 표시 (우측 하단이나 중앙에 오버레이)
                const iconSpan = document.createElement('span');
                iconSpan.className = 'special-icon-overlay';

                if (specialType === SPECIAL_TYPES.H_LINE) iconSpan.textContent = SPECIAL_ICONS.H_LINE;
                else if (specialType === SPECIAL_TYPES.V_LINE) iconSpan.textContent = SPECIAL_ICONS.V_LINE;
                else if (specialType === SPECIAL_TYPES.BOMB) iconSpan.textContent = SPECIAL_ICONS.BOMB;
                else if (specialType === SPECIAL_TYPES.COLOR) iconSpan.textContent = SPECIAL_ICONS.COLOR;

                tile.appendChild(iconSpan);
            }

            // 클릭 이벤트 (데스크톱)
            tile.addEventListener('click', () => handleTileClick(row, col));


            // 터치 이벤트 (모바일 스와이프)
            tile.addEventListener('touchstart', (e) => handleTouchStart(e, row, col), { passive: true });
            tile.addEventListener('touchend', (e) => handleTouchEnd(e, row, col), { passive: true });

            gameBoard.appendChild(tile);
        }
    }
}

// 타일 클릭 처리
function handleTileClick(row, col) {
    if (isProcessing || !gameStarted) return;

    const tiles = document.querySelectorAll('.tile');
    const currentTile = tiles[row * BOARD_SIZE + col];

    // 특수 블록은 첫 클릭에 바로 발동
    if (specialBoard[row][col]) {
        activateSpecialBlock(row, col);
        return;
    }

    if (selectedTile === null) {
        // 첫 번째 타일 선택
        selectedTile = { row, col };
        currentTile.classList.add('selected');
    } else {
        const prevTile = tiles[selectedTile.row * BOARD_SIZE + selectedTile.col];

        // 같은 타일 클릭 시 선택 해제
        if (selectedTile.row === row && selectedTile.col === col) {
            prevTile.classList.remove('selected');
            selectedTile = null;
            return;
        }

        // 인접한 타일인지 확인
        if (isAdjacent(selectedTile.row, selectedTile.col, row, col)) {
            prevTile.classList.remove('selected');
            swapTiles(selectedTile.row, selectedTile.col, row, col);
            selectedTile = null;
        } else {
            // 인접하지 않으면 새 타일 선택
            prevTile.classList.remove('selected');
            selectedTile = { row, col };
            currentTile.classList.add('selected');
        }
    }
}

// 인접 여부 확인
function isAdjacent(row1, col1, row2, col2) {
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// 터치 시작 핸들러
function handleTouchStart(e, row, col) {
    if (isProcessing || !gameStarted) return;

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTile = { row, col };

    // 터치한 타일에 선택 효과 추가
    const tiles = document.querySelectorAll('.tile');
    const currentTile = tiles[row * BOARD_SIZE + col];
    currentTile.classList.add('selected');
}

// 터치 종료 핸들러 (스와이프 감지)
function handleTouchEnd(e, row, col) {
    if (isProcessing || !touchStartTile || !gameStarted) return;

    // 선택 효과 제거
    const tiles = document.querySelectorAll('.tile');
    const startTile = tiles[touchStartTile.row * BOARD_SIZE + touchStartTile.col];
    startTile.classList.remove('selected');

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    const minSwipeDistance = 30; // 최소 스와이프 거리

    // 스와이프가 너무 짧으면 탭으로 처리 (특수 블록 발동)
    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
        if (specialBoard[touchStartTile.row][touchStartTile.col]) {
            activateSpecialBlock(touchStartTile.row, touchStartTile.col);
        }
        touchStartTile = null;
        return;
    }

    // 스와이프 방향 결정
    let targetRow = touchStartTile.row;
    let targetCol = touchStartTile.col;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // 가로 스와이프
        if (Math.abs(deltaX) > minSwipeDistance) {
            targetCol += deltaX > 0 ? 1 : -1;
        }
    } else {
        // 세로 스와이프
        if (Math.abs(deltaY) > minSwipeDistance) {
            targetRow += deltaY > 0 ? 1 : -1;
        }
    }

    // 유효한 범위 내에서 스와이프
    if (targetRow >= 0 && targetRow < BOARD_SIZE &&
        targetCol >= 0 && targetCol < BOARD_SIZE &&
        (targetRow !== touchStartTile.row || targetCol !== touchStartTile.col)) {
        swapTiles(touchStartTile.row, touchStartTile.col, targetRow, targetCol);
    }

    // 터치 상태 초기화
    touchStartTile = null;
}

// 특수 블록 아이콘
const SPECIAL_ICONS = {
    H_LINE: '↔️', // 가로 4매치
    V_LINE: '↕️', // 세로 4매치
    COLOR: '⚡',  // 5매치 line
    BOMB: '💣'    // T/L 매치
};

const SPECIAL_TYPES = {
    H_LINE: 'special-h-line', // 가로 라인 삭제
    V_LINE: 'special-v-line', // 세로 라인 삭제
    COLOR: 'special-color',   // 5매치: 같은 색 전체 삭제
    BOMB: 'special-bomb'      // T/L 매치: 3x3 폭발
};


// 특수 블록 발동
async function activateSpecialBlock(row, col) {
    isProcessing = true;
    const specialType = specialBoard[row][col];
    const tilesToClear = [];

    if (specialType === SPECIAL_TYPES.H_LINE) {
        // 가로 라인 삭제
        for (let c = 0; c < BOARD_SIZE; c++) {
            tilesToClear.push({ row, col: c });
        }
    } else if (specialType === SPECIAL_TYPES.V_LINE) {
        // 세로 라인 삭제
        for (let r = 0; r < BOARD_SIZE; r++) {
            tilesToClear.push({ row: r, col });
        }
    } else if (specialType === SPECIAL_TYPES.BOMB) {
        // 3x3 폭발
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                    tilesToClear.push({ row: r, col: c });
                }
            }
        }
    } else if (specialType === SPECIAL_TYPES.COLOR) {
        // 랜덤한 동물 하나 선택하여 전체 삭제
        const targetType = TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];

        // 어떤 동물이 삭제되는지 팝업으로 알림
        showScorePopup(`${targetType} 삭제!`);
        await delay(300);

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === targetType) {
                    tilesToClear.push({ row: r, col: c });
                }
            }
        }
    }

    // 점수 계산 (특수 블록 자체도 점수에 포함)
    tilesToClear.push({ row, col });

    // 중복 제거
    const uniqueTiles = [];
    const visited = new Set();
    tilesToClear.forEach(t => {
        const key = `${t.row},${t.col}`;
        if (!visited.has(key)) {
            visited.add(key);
            uniqueTiles.push(t);
        }
    });

    const clearScore = uniqueTiles.length * 50; // 특수블록 점수 증가 (40 -> 50)
    score += clearScore;
    updateScore();
    showScorePopup(clearScore);

    // 애니메이션
    const tiles = document.querySelectorAll('.tile');
    uniqueTiles.forEach(({ row: r, col: c }) => {
        const tile = tiles[r * BOARD_SIZE + c];
        if (tile) tile.classList.add('line-clear');
    });

    await delay(500);

    // 타일 제거
    uniqueTiles.forEach(({ row: r, col: c }) => {
        board[r][c] = null;
        specialBoard[r][c] = null;
    });

    // 떨어뜨리고 채우기
    await dropTiles();
    await fillBoard();
    renderBoard();

    await delay(300);

    // 연쇄 매치 확인
    const matches = findMatches();
    if (matches.length > 0) {
        await processMatches(null, false); // 특수블록 발동은 사용자 매치가 아님
    }

    // 가능한 수가 있는지 확인
    if (!hasPossibleMoves()) {
        await shuffleBoard();
    }

    isProcessing = false;
}

// 타일 교환
// 타일 교환
async function swapTiles(row1, col1, row2, col2) {
    isProcessing = true;

    const sourceRow = row1;
    const sourceCol = col1;
    const targetRow = row2;
    const targetCol = col2;

    const sourceType = board[sourceRow][sourceCol];
    const targetType = board[targetRow][targetCol];
    const sourceSpecial = specialBoard[sourceRow][sourceCol];
    const targetSpecial = specialBoard[targetRow][targetCol];

    // 배열에서 교환
    board[sourceRow][sourceCol] = targetType;
    board[targetRow][targetCol] = sourceType;

    // 특수 블록도 교환
    specialBoard[sourceRow][sourceCol] = targetSpecial;
    specialBoard[targetRow][targetCol] = sourceSpecial;

    renderBoard();

    // 매치 확인
    const matches = findMatches();
    if (matches.length > 0) {
        // 유효한 스왑
        // 유효한 스왑 - 콤보 처리
        handleUserCombo();

        // 스왑으로 인한 매치이므로, 스왑된 두 타일 위치를 모두 전달
        const swappedTiles = {
            source: { row: sourceRow, col: sourceCol },
            target: { row: targetRow, col: targetCol }
        };

        // 특수 블록 발동 체크 (매치된 타일에 특수 블록이 섞여있으면 발동)
        let specialActivated = false;

        // 스왑한 두 타일 중 특수 블록이 있다면?
        if (specialBoard[targetRow][targetCol]) {
            await activateSpecialBlock(targetRow, targetCol);
            specialActivated = true;
        }
        if (specialBoard[sourceRow][sourceCol]) {
            await activateSpecialBlock(sourceRow, sourceCol);
            specialActivated = true;
        }

        // 특수 블록이 발동되지 않았다면 일반 매치 처리
        if (!specialActivated) {
            await processMatches(swappedTiles);
        }

    } else {
        // 매치 안됨 -> 원위치 (단, 특수 블록 스왑은 예외)
        if (specialBoard[sourceRow][sourceCol] || specialBoard[targetRow][targetCol]) {
            // 특수 블록 스왑 (매치 없어도 발동 = Swap to Activate)
            // 둘 다 특수 블록이면 둘 다 발동
            if (specialBoard[sourceRow][sourceCol]) await activateSpecialBlock(sourceRow, sourceCol);
            // 타일이 달라질 수 있으므로 다시 확인 (이미 터졌을 수도)
            // activateSpecialBlock 내부에서 처리되므로 순차 호출 시 주의.
            // 사실 하나 터지면 보드가 변하므로 두 번째는 위치가 안 맞을 수 있음.
            // 하지만 스왑 직후이므로 인접해있음. 
            // 로직 단순화: 타겟 위치의 특수 블록 발동 (내가 드래그해서 놓은 놈)
            // 소스 위치도 특수 블록이면? -> 보통 둘 중 하나만 움직임.
            // 둘 다 특수 블록끼리 스왑이면 -> 콤보 효과 (이미 activate 로직에 구현 가능하지만 여기선 단순 발동)

            if (specialBoard[targetRow][targetCol]) await activateSpecialBlock(targetRow, targetCol);

            // 특수 블록 스왑은 항상 콤보로 인정 (매치가 없더라도 발동되므로)
            handleUserCombo();

        } else {
            // 일반 타일끼리 매치 실패 -> 원위치
            await delay(200);

            // 다시 돌려놓기 애니메이션
            const tile1 = document.querySelector(`.tile[data-row="${sourceRow}"][data-col="${sourceCol}"]`);
            const tile2 = document.querySelector(`.tile[data-row="${targetRow}"][data-col="${targetCol}"]`);

            if (tile1) tile1.style.transform = `translate(${(targetCol - sourceCol) * 100}%, ${(targetRow - sourceRow) * 100}%)`;
            if (tile2) tile2.style.transform = `translate(${(sourceCol - targetCol) * 100}%, ${(sourceRow - targetRow) * 100}%)`;

            await delay(300);

            // 데이터 원복
            board[sourceRow][sourceCol] = sourceType;
            board[targetRow][targetCol] = targetType;
            specialBoard[sourceRow][sourceCol] = sourceSpecial;
            specialBoard[targetRow][targetCol] = targetSpecial;

            renderBoard();
        }
    }

    // 가능한 수가 있는지 확인
    if (!hasPossibleMoves()) {
        await shuffleBoard();
    }

    isProcessing = false;
}

// 가능한 수가 있는지 확인
function hasPossibleMoves() {
    // 각 타일에 대해 인접 타일과 교환 시 매치가 생기는지 확인
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            // 오른쪽과 교환 시도
            if (col < BOARD_SIZE - 1) {
                swapInBoard(row, col, row, col + 1);
                if (findMatches().length > 0) {
                    swapInBoard(row, col, row, col + 1);
                    return true;
                }
                swapInBoard(row, col, row, col + 1);
            }

            // 아래와 교환 시도
            if (row < BOARD_SIZE - 1) {
                swapInBoard(row, col, row + 1, col);
                if (findMatches().length > 0) {
                    swapInBoard(row, col, row + 1, col);
                    return true;
                }
                swapInBoard(row, col, row + 1, col);
            }
        }
    }

    return false;
}

// 보드 내에서 타일 교환 (렌더링 없이)
function swapInBoard(row1, col1, row2, col2) {
    const temp = board[row1][col1];
    board[row1][col1] = board[row2][col2];
    board[row2][col2] = temp;
}

// 보드 셔플
async function shuffleBoard() {
    // 타이머 일시정지
    const timerWasRunning = gameTimer !== null;
    if (timerWasRunning) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    // 셔플 애니메이션 표시 (카운트다운 오버레이 재사용)
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownDisplay = document.getElementById('countdownDisplay');

    countdownOverlay.classList.remove('hidden');
    countdownDisplay.textContent = '🔀 셔플!';
    countdownDisplay.className = 'countdown-display';
    void countdownDisplay.offsetWidth; // 리플로우 강제
    countdownDisplay.classList.add('countdown-animate');

    await delay(800);
    countdownOverlay.classList.add('hidden');

    // 특수 블록이 아닌 타일만 수집
    const normalTiles = [];
    const positions = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            // 특수 블록 아이콘은 셔플 대상에서 제외
            if (!specialBoard[row][col]) {
                normalTiles.push(board[row][col]);
                positions.push({ row, col });
            }
        }
    }

    // 셔플 (Fisher-Yates)
    for (let i = normalTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [normalTiles[i], normalTiles[j]] = [normalTiles[j], normalTiles[i]];
    }

    // 다시 배치
    positions.forEach((pos, idx) => {
        board[pos.row][pos.col] = normalTiles[idx];
    });

    renderBoard();

    // 셔플 후에도 가능한 수가 없으면 다시 셔플
    if (!hasPossibleMoves()) {
        await shuffleBoard();
        return; // 재귀 호출 후 타이머는 재귀에서 재개
    }

    // 셔플 후 매치가 있으면 처리
    const matches = findMatches();
    if (matches.length > 0) {
        await processMatches(null, false); // 셔플 후 매치는 사용자 매치가 아님
    }

    // 타이머 재개
    if (timerWasRunning && gameStarted) {
        startTimer();
    }
}

// 매치 찾기 (가로/세로 + 교차 병합)
function findMatches() {
    const horizontalMatches = [];
    const verticalMatches = [];

    // 1. 가로 매치 확인
    for (let row = 0; row < BOARD_SIZE; row++) {
        let col = 0;
        while (col < BOARD_SIZE - 2) {
            // 특수 블록 플레이스홀더는 매치 대상이 아님 (동물이 아니므로)
            if (board[row][col] &&
                board[row][col] !== SPECIAL_PLACEHOLDER &&
                board[row][col] === board[row][col + 1] &&
                board[row][col] === board[row][col + 2]) {

                const matchTiles = [{ row, col }];
                let k = col + 1;
                while (k < BOARD_SIZE && board[row][k] === board[row][col]) {
                    matchTiles.push({ row, col: k });
                    k++;
                }

                horizontalMatches.push({
                    id: `h-${row}-${col}`,
                    type: 'horizontal',
                    tiles: matchTiles,
                    length: matchTiles.length
                });
                col = k;
            } else {
                col++;
            }
        }
    }

    // 2. 세로 매치 확인
    for (let col = 0; col < BOARD_SIZE; col++) {
        let row = 0;
        while (row < BOARD_SIZE - 2) {
            if (board[row][col] &&
                board[row][col] !== SPECIAL_PLACEHOLDER &&
                board[row][col] === board[row + 1][col] &&
                board[row][col] === board[row + 2][col]) {

                const matchTiles = [{ row, col }];
                let k = row + 1;
                while (k < BOARD_SIZE && board[k][col] === board[row][col]) {
                    matchTiles.push({ row: k, col });
                    k++;
                }

                verticalMatches.push({
                    id: `v-${row}-${col}`,
                    type: 'vertical',
                    tiles: matchTiles,
                    length: matchTiles.length
                });
                row = k;
            } else {
                row++;
            }
        }
    }

    // 3. 교차 검사 및 병합 (Union-Find 또는 그래프 탐색)
    // 간단하게: 모든 매치 리스트를 놓고, 타일을 공유하는 매치들을 하나의 그룹으로 묶음
    const allMatches = [...horizontalMatches, ...verticalMatches];
    const matchGroups = []; // [{ tiles: Set, hasHorizontal: bool, hasVertical: bool, maxLength: int }]

    // 각 매치를 순회하며 그룹화
    const visitedMatchIds = new Set();

    allMatches.forEach(match => {
        if (visitedMatchIds.has(match.id)) return;

        // 새로운 그룹 시작 (BFS/DFS로 연결된 모든 매치 찾기)
        const group = {
            tiles: [],
            matchIds: [],
            types: new Set(),
            maxLength: 0
        };

        const queue = [match];
        visitedMatchIds.add(match.id);

        while (queue.length > 0) {
            const current = queue.shift();
            group.matchIds.push(current.id);
            group.types.add(current.type);
            group.maxLength = Math.max(group.maxLength, current.length);

            // 현재 매치의 타일들을 그룹 타일에 추가 (중복 방지를 위한 문자열 키 사용)
            current.tiles.forEach(t => {
                // 이 타일을 포함하는 다른 방문 안 한 매치 찾기
                allMatches.forEach(other => {
                    if (!visitedMatchIds.has(other.id)) {
                        // 다른 매치의 타일 중 현재 타일과 같은 위치가 있는지
                        const isConnected = other.tiles.some(ot => ot.row === t.row && ot.col === t.col);
                        if (isConnected) {
                            visitedMatchIds.add(other.id);
                            queue.push(other);
                        }
                    }
                });
            });
        }

        // 그룹 내 모든 유니크 타일 수집
        const uniqueTilesMap = new Map(); // "r,c" -> {row, col}
        group.matchIds.forEach(mid => {
            const m = allMatches.find(am => am.id === mid);
            m.tiles.forEach(t => {
                uniqueTilesMap.set(`${t.row},${t.col}`, t);
            });
        });

        group.tiles = Array.from(uniqueTilesMap.values());
        matchGroups.push(group);
    });

    return matchGroups;
}

// 매치 처리 및 특수 블록 생성
// 매치 처리 및 특수 블록 생성
async function processMatches(swappedTiles = null, isUserMatch = false) {
    // findMatches가 이미 그룹화된 결과를 반환함
    const groups = findMatches();
    if (groups.length === 0) return;

    // 사용자가 직접 한 매치일 때만 시간 체크 및 콤보 증가
    if (isUserMatch) {
        // 시간 기반 콤보 체크 (2초 이내 매치 시 콤보 유지)
        const currentTime = Date.now();
        if (lastMatchTime > 0 && (currentTime - lastMatchTime) > 2000) {
            // 2초 경과 -> 콤보 리셋
            combo = 0;
        }

        // 콤보 증가 (매치 성공 시)
        combo++;
        updateCombo();

        // 마지막 매치 시각 업데이트
        lastMatchTime = Date.now();
    }

    // 각 그룹별 점수 계산 및 특수 블록 생성 확인
    for (const group of groups) {
        const tileCount = group.tiles.length;

        // 매치 크기별 기본 점수
        let baseScore;
        if (tileCount === 3) {
            baseScore = 30;
        } else if (tileCount === 4) {
            baseScore = 100;
        } else {
            baseScore = 200; // 5개 이상
        }

        // 콤보 멀티플라이어 (수정된 범위)
        let comboMultiplier = 1.0;
        if (combo >= 11) {
            comboMultiplier = 3.0;
        } else if (combo >= 8) {
            comboMultiplier = 2.5;
        } else if (combo >= 5) {
            comboMultiplier = 2.0;
        } else if (combo >= 2) {
            comboMultiplier = 1.5;
        }

        const matchScore = Math.floor(baseScore * comboMultiplier);
        score += matchScore;
        showScorePopup(matchScore);

        // 특수 블록 생성 여부 판단
        let specialType = null;

        // 우선순위: Bomb > Color > Line
        // 1. Bomb (T/L) - 가로/세로 매치가 섞여있고 총 5개 이상
        // group.types는 Set {'horizontal', 'vertical'}
        if (group.types.has('horizontal') && group.types.has('vertical') && tileCount >= 5) {
            specialType = SPECIAL_TYPES.BOMB;
        }
        // 2. Color (5개 이상 직선)
        else if (tileCount >= 5) {
            specialType = SPECIAL_TYPES.COLOR;
        }
        // 3. Line (4개 직선)
        else if (tileCount === 4) {
            if (group.types.has('horizontal')) {
                specialType = SPECIAL_TYPES.H_LINE;
            } else {
                specialType = SPECIAL_TYPES.V_LINE;
            }
        }

        // 특수 블록 생성 시 보너스 점수
        if (specialType) {
            score += 50;
            showScorePopup('+50 특수!');
        }

        // 특수 블록 생성 위치 결정
        let targetRow = group.tiles[0].row;
        let targetCol = group.tiles[0].col;

        // 스왑한 타일 위치들 중 그룹 내에 있는 것 우선
        if (swappedTiles) {
            // source 위치가 그룹에 포함되어 있는지 확인
            const sourceInGroup = group.tiles.some(t =>
                t.row === swappedTiles.source.row && t.col === swappedTiles.source.col);
            // target 위치가 그룹에 포함되어 있는지 확인
            const targetInGroup = group.tiles.some(t =>
                t.row === swappedTiles.target.row && t.col === swappedTiles.target.col);

            // source가 그룹에 있으면 source 위치 사용
            if (sourceInGroup) {
                targetRow = swappedTiles.source.row;
                targetCol = swappedTiles.source.col;
            }
            // target이 그룹에 있으면 target 위치 사용 (source보다 우선)
            if (targetInGroup) {
                targetRow = swappedTiles.target.row;
                targetCol = swappedTiles.target.col;
            }
        } else {
            // 스왑 정보 없으면 중앙값
            targetRow = group.tiles[Math.floor(group.tiles.length / 2)].row;
            targetCol = group.tiles[Math.floor(group.tiles.length / 2)].col;
        }

        // 타일 제거 처리 및 특수 블록 발동
        const promises = group.tiles.map(async (t) => {
            // 특수 블록인지 확인
            if (specialBoard[t.row][t.col]) {
                // 매치에 포함된 특수 블록은 즉시 발동
                await activateSpecialBlock(t.row, t.col);
            } else {
                // 일반 타일 제거 효과
                const tileElement = document.querySelector(`.tile[data-row="${t.row}"][data-col="${t.col}"]`);
                if (tileElement) {
                    tileElement.classList.add('matched');
                }
                board[t.row][t.col] = null;
                specialBoard[t.row][t.col] = null;
            }
        });

        // 모든 타일 처리 대기 (특수 블록 발동 등)
        await Promise.all(promises);

        // 애니메이션 대기
        await delay(250);

        // 특수 블록 생성 (매치 결과로 생성되는 새로운 특수 블록)
        if (specialType) {
            // 해당 위치는 비워뒀었음.
            // 플레이스홀더를 할당하여 일반 매치에 포함되지 않도록 함
            board[targetRow][targetCol] = SPECIAL_PLACEHOLDER;
            specialBoard[targetRow][targetCol] = specialType;
        }
    }

    updateScore();

    // 타일 떨어뜨리고 채우기
    await dropTiles();
    await fillBoard();
    renderBoard();

    await delay(250);

    // 연쇄 매치 확인
    const nextMatches = findMatches();
    if (nextMatches.length > 0) {
        // 연쇄당 소폭 보너스 (+10점)
        score += 10;
        updateScore();
        showScorePopup('+10 연쇄');

        // 연쇄는 스왑 주체 없음
        await processMatches(null);
    }
}

// 타일 떨어뜨리기 (특수블록은 고정)
async function dropTiles() {
    for (let col = 0; col < BOARD_SIZE; col++) {
        // 특수블록 위치 기록
        const specialPositions = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            if (specialBoard[row][col]) {
                specialPositions.push({
                    row: row,
                    type: board[row][col],
                    special: specialBoard[row][col]
                });
            }
        }

        // 일반 타일만 수집 (null과 특수블록 제외)
        const normalTiles = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            if (board[row][col] !== null && !specialBoard[row][col]) {
                normalTiles.push(board[row][col]);
            }
        }

        // 일단 해당 열 전체 초기화
        for (let row = 0; row < BOARD_SIZE; row++) {
            board[row][col] = null;
            specialBoard[row][col] = null;
        }

        // 특수블록 먼저 원래 위치에 복원
        for (const sp of specialPositions) {
            board[sp.row][col] = sp.type;
            specialBoard[sp.row][col] = sp.special;
        }

        // 일반 타일을 아래에서부터 특수블록 피해서 채움
        let tileIndex = normalTiles.length - 1;
        for (let row = BOARD_SIZE - 1; row >= 0 && tileIndex >= 0; row--) {
            if (board[row][col] === null) {
                board[row][col] = normalTiles[tileIndex];
                tileIndex--;
            }
        }
    }
}

// 빈 칸 채우기 (특수블록 위쪽에서 채움)
async function fillBoard() {
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE; row++) {
            if (board[row][col] === null) {
                board[row][col] = getRandomTile();
                // specialBoard[row][col] = null; 이미 null임
            }
        }
    }
}

// 점수 업데이트
function updateScore() {
    scoreDisplay.textContent = score.toLocaleString();
}

// 콤보 업데이트
function updateCombo() {
    if (combo === 0) {
        comboDisplay.textContent = '-';
        comboDisplay.classList.remove('combo-burst');
    } else {
        comboDisplay.textContent = `x${combo}`;
        if (combo > 1) {
            comboDisplay.classList.add('combo-burst');
            setTimeout(() => comboDisplay.classList.remove('combo-burst'), 300);
        }
    }
}

// 사용자 액션에 의한 콤보 처리 (중앙 집중식)
function handleUserCombo() {
    const currentTime = Date.now();

    // 시간 기반 콤보 체크 (2초 이내 매치 시 콤보 유지)
    if (lastMatchTime > 0 && (currentTime - lastMatchTime) > 2000) {
        // 2초 경과 -> 콤보 리셋
        combo = 0;
    }

    // 콤보 증가
    combo++;
    updateCombo();

    // 마지막 매치 시각 업데이트
    lastMatchTime = currentTime;
}

// 점수 팝업 표시
function showScorePopup(text) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = typeof text === 'number' ? `+${text}` : text;
    popup.style.left = `${gameBoard.offsetLeft + gameBoard.offsetWidth / 2}px`;
    popup.style.top = `${gameBoard.offsetTop + gameBoard.offsetHeight / 2}px`;
    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 1000);
}

// 딜레이 함수
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 이벤트 리스너 중복 제거됨


// 엔터키 리스너
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startGame();
});

// 초기 보드 표시 (게임 시작 전)
initGame();
