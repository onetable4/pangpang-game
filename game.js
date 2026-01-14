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
let combo = 1;
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
    combo = 1;
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
});

// 게임 시작
function startGame() {
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

    gameStarted = true;
    startOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
    leaderboardOverlay.classList.add('hidden');
    helpOverlay.classList.add('hidden'); // 혹시 열려있다면 닫기

    initGame();
    startTimer();
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

// 보드 렌더링
function renderBoard() {
    gameBoard.innerHTML = '';

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.textContent = board[row][col];
            tile.dataset.row = row;
            tile.dataset.col = col;

            // 특수 블록 스타일 적용
            if (specialBoard[row][col]) {
                tile.classList.add(specialBoard[row][col]);
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

    if (selectedTile === null) {
        // 첫 번째 타일 선택
        selectedTile = { row, col };
        currentTile.classList.add('selected');

        // 특수 블록이면 햅틱/시각 효과 추가? (일단 선택됨 표시만)
    } else {
        const prevTile = tiles[selectedTile.row * BOARD_SIZE + selectedTile.col];

        // 같은 타일 클릭 시
        if (selectedTile.row === row && selectedTile.col === col) {
            // 특수 블록을 두 번 클릭하면 발동 (선택 해제 대신)
            if (specialBoard[row][col]) {
                prevTile.classList.remove('selected');
                selectedTile = null;
                activateSpecialBlock(row, col);
                return;
            }

            // 일반 타일은 선택 해제
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

    const clearScore = uniqueTiles.length * 40 * combo; // 점수 상향
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

    combo++;
    updateCombo();

    // 떨어뜨리고 채우기
    await dropTiles();
    await fillBoard();
    renderBoard();

    await delay(300);

    // 연쇄 매치 확인
    const matches = findMatches();
    if (matches.length > 0) {
        await processMatches();
    }

    combo = 1;
    updateCombo();

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
        combo = 1;
        updateCombo();

        // 스왑으로 인한 매치이므로, 스왑된 타일 위치를 기준점으로 전달
        // 사용자가 드래그하여 놓은 위치(targetRow, targetCol)를 기준으로 함
        // source와 target 중 매치에 포함된 녀석이 기준이 되어야 함.
        // 하지만 직관적으로 "내가 놓은 곳"에 생기는 게 좋음.
        const lastSwapped = { row: targetRow, col: targetCol };

        // 특수 블록 발동 체크 (매치된 타일에 특수 블록이 섞여있으면 발동)
        let specialActivated = false;

        // 매치된 타일들 수집
        const allMatchedTiles = new Set();
        matches.forEach(m => m.tiles.forEach(t => allMatchedTiles.add(`${t.row},${t.col}`)));

        // 특수 블록이 매치에 포함되어 있다면 발동
        /* 
           기존 로직: 매치 처리 후 특수 블록 발동? 
           개선 로직: 매치 처리 과정에서 특수 블록이 터지면 그 효과도 같이 처리.
           processMatches 내부에서 처리하므로 여기서는 호출만 함.
        */

        // 스왑한 두 타일 중 특수 블록이 있다면? 
        // 콤보 규칙: "스왑 + 매치 + 특수 블록" -> 특수 블록 효과 발동
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
            await processMatches(lastSwapped);
        } else {
            // 특수 블록 발동 후 빈자리 채우고 다시 매치 확인 로직은 activateSpecialBlock 내부에 있음
            // 하지만 여기서도 보장해야 함.
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
    // 셔플 메시지 표시
    showScorePopup('🔀 셔플!');

    await delay(500);

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
    }

    // 셔플 후 매치가 있으면 처리
    const matches = findMatches();
    if (matches.length > 0) {
        await processMatches();
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
            if (board[row][col] &&
                board[row][col] === board[row][col + 1] &&
                board[row][col] === board[row][col + 2]) {

                const matchTiles = [{ row, col }];
                let k = col + 1;
                while (k < BOARD_SIZE && board[row][k] === board[row][col]) {
                    matchTiles.push({ row, col: k });
                    k++;
                }

                // 특수 블록 제외 (이미 특수 블록이면 매치에 포함 안 됨 - 로직상)
                // 하지만 현재 로직은 특수블록도 글자(🐶 등)가 아니라 아이콘(💎)이므로
                // 아이콘끼리는 매치 안 됨 (서로 다르니까).
                // 혹시 같은 아이콘 3개가 모이면? -> TILE_TYPES에 없으므로 상관없지만 안전장치 필요?
                // 현재 코드는 board 값이 같으면 매치됨. 아이콘끼리 3개 모이면 터짐. (의도된 것일 수도 아닐 수도)
                // 일단 아이콘 생성 시 board에 아이콘이 들어가므로, 
                // 아이콘 매치를 막으려면 체크 필요.
                // 일단 둡니다 (아이콘 매치도 재밌는 요소일 수 있음, 또는 희박함)

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
async function processMatches(lastSwappedTile = null) {
    // findMatches가 이미 그룹화된 결과를 반환함
    const groups = findMatches();
    if (groups.length === 0) return;

    // 각 그룹별 점수 계산 및 특수 블록 생성 확인
    for (const group of groups) {
        const tileCount = group.tiles.length;

        // 점수
        const matchScore = tileCount * 10 * combo; // 기본 점수
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

        // 특수 블록 생성 위치 결정
        let targetRow = group.tiles[0].row;
        let targetCol = group.tiles[0].col;

        // 1. 마지막 스왑한 타일이 그룹 내에 있으면 그 위치 우선
        if (lastSwappedTile) {
            const inGroup = group.tiles.some(t => t.row === lastSwappedTile.row && t.col === lastSwappedTile.col);
            if (inGroup) {
                targetRow = lastSwappedTile.row;
                targetCol = lastSwappedTile.col;
            } else {
                // 스왑 위치가 없으면 중앙값
                targetRow = group.tiles[Math.floor(group.tiles.length / 2)].row;
                targetCol = group.tiles[Math.floor(group.tiles.length / 2)].col;
            }
        } else {
            // 스왑 정보 없으면 중앙값
            targetRow = group.tiles[Math.floor(group.tiles.length / 2)].row;
            targetCol = group.tiles[Math.floor(group.tiles.length / 2)].col;
        }

        // 타일 제거 처리
        group.tiles.forEach(t => {
            // 특수 블록 생성 위치는 데이터만 지우고 나중에 채움 (시각적으로는 유지되어야 자연스러움)

            const tileElement = document.querySelector(`.tile[data-row="${t.row}"][data-col="${t.col}"]`);
            if (tileElement) {
                tileElement.classList.add('matched');
            }

            // 보드 데이터 업데이트
            board[t.row][t.col] = null;
            specialBoard[t.row][t.col] = null;
        });

        // 애니메이션 대기
        await delay(100);

        // 특수 블록 생성
        if (specialType) {
            // 해당 위치는 비워뒀었음.
            // 기존 타일 색상 중 하나로 복구하고 특수 블록 할당
            board[targetRow][targetCol] = TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];
            specialBoard[targetRow][targetCol] = specialType;
        }
    }

    updateScore();
    // 점수 업데이트 딜레이 제거 (즉시 반응)

    // 타일 떨어뜨리고 채우기
    await dropTiles();
    await fillBoard();
    renderBoard();

    await delay(150);

    // 연쇄 매치 확인 (재귀 아님, 루프 혹은 호출)
    // processMatches는 async이므로, 현재 작업 끝난 후 다시 확인
    // 근데 findMatches가 0이면 종료하므로 재귀 호출해도 됨.
    // 하지만 무한 루프 방지 위해... 여기서 호출?
    // swapTiles에서 processMatches 호출 후 다시 확인 구조가 있음.
    // 여기서는 "연쇄"를 위해 자체적으로 다시 호출하는 게 맞음.
    // 단, lastSwappedTile 정보는 연쇄에서는 유효하지 않음 (랜덤 위치 or 중앙).

    // 연쇄 처리를 위해 다시 호출
    const nextMatches = findMatches();
    if (nextMatches.length > 0) {
        combo++;
        updateCombo();
        await processMatches(null); // 연쇄는 스왑 주체 없음
    }
}

// 타일 떨어뜨리기
async function dropTiles() {
    for (let col = 0; col < BOARD_SIZE; col++) {
        let emptyRow = BOARD_SIZE - 1;

        for (let row = BOARD_SIZE - 1; row >= 0; row--) {
            if (board[row][col] !== null) {
                if (row !== emptyRow) {
                    board[emptyRow][col] = board[row][col];
                    specialBoard[emptyRow][col] = specialBoard[row][col];
                    board[row][col] = null;
                    specialBoard[row][col] = null;
                }
                emptyRow--;
            }
        }
    }
}

// 빈 칸 채우기
async function fillBoard() {
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE; row++) {
            if (board[row][col] === null) {
                board[row][col] = TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];
                specialBoard[row][col] = null;
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
    comboDisplay.textContent = `x${combo}`;
    if (combo > 1) {
        comboDisplay.classList.add('combo-burst');
        setTimeout(() => comboDisplay.classList.remove('combo-burst'), 300);
    }
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

// 이벤트 리스너
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// 리더보드 이벤트 리스너
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
});

// 엔터키 리스너
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startGame();
});

// 초기 보드 표시 (게임 시작 전)
initGame();
