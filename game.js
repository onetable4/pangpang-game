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

// 특수 블록 타입 (통합)
const SPECIAL_TYPES = {
    LINE: 'special-line',     // 4매치: 랜덤 방향 라인 삭제
    COLOR: 'special-color'    // 5매치: 같은 색 전체 삭제
};

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

// 게임 시작
function startGame() {
    playerName = playerNameInput.value.trim() || '이름없음';
    localStorage.setItem('lastPlayerName', playerName);

    gameStarted = true;
    startOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
    leaderboardOverlay.classList.add('hidden');

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

// 게임 종료
async function endGame() {
    gameStarted = false;
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    finalScore.textContent = score.toLocaleString();
    endOverlay.classList.remove('hidden');

    // 점수 저장
    await saveScore(playerName, score);
}

// Firebase: 점수 저장
async function saveScore(name, score) {
    if (score === 0) return; // 0점은 저장하지 않음

    try {
        const scoresRef = ref(db, 'scores');
        await push(scoresRef, {
            name: name,
            score: score,
            timestamp: Date.now()
        });

        // 간단한 신기록 이펙트 (실제 비교는 하지 않음)
        if (score > 1000) {
            newRecordMessage.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Error saving score: ", e);
    }
}

// Firebase: 리더보드 불러오기
async function loadLeaderboard() {
    leaderboardList.innerHTML = '<div class="loading">불러오는 중...</div>';

    try {
        const scoresRef = ref(db, 'scores');
        const topScoresQuery = query(scoresRef, orderByChild('score'), limitToLast(50)); // 상위 50개

        const snapshot = await get(topScoresQuery);

        if (snapshot.exists()) {
            const scores = [];
            snapshot.forEach((childSnapshot) => {
                scores.push(childSnapshot.val());
            });

            // 점수 내림차순 정렬
            scores.sort((a, b) => b.score - a.score);

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
            (Date.now() - entry.timestamp) < 5000) { // 방금 등록한 기록
            div.classList.add('my-rank');
        }

        div.innerHTML = `
            <span class="rank-pos">${rank}</span>
            <span class="rank-name">${escapeHtml(entry.name)}</span>
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

    // 특수 블록 클릭 시 발동
    if (specialBoard[row][col]) {
        activateSpecialBlock(row, col);
        return;
    }

    const tiles = document.querySelectorAll('.tile');
    const currentTile = tiles[row * BOARD_SIZE + col];

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
    LINE: '💎',   // 4매치
    COLOR: '⚡'   // 5매치
};

// 특수 블록 발동
async function activateSpecialBlock(row, col) {
    isProcessing = true;
    const specialType = specialBoard[row][col];
    // tileType은 더 이상 보드에서 가져오지 않음 (아이콘이 바뀌었으므로)
    const tilesToClear = [];

    if (specialType === SPECIAL_TYPES.LINE) {
        // 랜덤하게 가로/세로/대각선 중 하나 선택
        const directions = ['horizontal', 'vertical', 'diagonal1', 'diagonal2'];
        const randomDir = directions[Math.floor(Math.random() * directions.length)];

        if (randomDir === 'horizontal') {
            for (let c = 0; c < BOARD_SIZE; c++) {
                tilesToClear.push({ row, col: c });
            }
        } else if (randomDir === 'vertical') {
            for (let r = 0; r < BOARD_SIZE; r++) {
                tilesToClear.push({ row: r, col });
            }
        } else if (randomDir === 'diagonal1') {
            // 대각선 ↘
            for (let i = -BOARD_SIZE; i < BOARD_SIZE; i++) {
                const r = row + i;
                const c = col + i;
                if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                    tilesToClear.push({ row: r, col: c });
                }
            }
        } else {
            // 대각선 ↙
            for (let i = -BOARD_SIZE; i < BOARD_SIZE; i++) {
                const r = row + i;
                const c = col - i;
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

    const clearScore = uniqueTiles.length * 20 * combo; // 점수 상향
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
async function swapTiles(row1, col1, row2, col2) {
    isProcessing = true;

    // 배열에서 교환
    let temp = board[row1][col1];
    board[row1][col1] = board[row2][col2];
    board[row2][col2] = temp;

    // 특수 블록도 교환
    temp = specialBoard[row1][col1];
    specialBoard[row1][col1] = specialBoard[row2][col2];
    specialBoard[row2][col2] = temp;

    renderBoard();

    // 매치 확인
    const matches = findMatches();

    if (matches.length > 0) {
        combo = 1;
        await processMatches();
    } else {
        // 매치가 없으면 다시 교환
        await delay(200);
        temp = board[row2][col2];
        board[row2][col2] = board[row1][col1];
        board[row1][col1] = temp;

        temp = specialBoard[row2][col2];
        specialBoard[row2][col2] = specialBoard[row1][col1];
        specialBoard[row1][col1] = temp;

        renderBoard();
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

// 매치 찾기 (방향과 길이 정보 포함)
function findMatches() {
    const matches = [];
    const visited = new Set();

    // 가로 매치 확인
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

                const key = `h-${row}-${col}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    matches.push({
                        type: 'horizontal',
                        tiles: matchTiles,
                        length: matchTiles.length
                    });
                }
                col = k;
            } else {
                col++;
            }
        }
    }

    // 세로 매치 확인
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

                const key = `v-${row}-${col}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    matches.push({
                        type: 'vertical',
                        tiles: matchTiles,
                        length: matchTiles.length
                    });
                }
                row = k;
            } else {
                row++;
            }
        }
    }

    // 대각선 매치 확인 (↘ 방향)
    for (let row = 0; row < BOARD_SIZE - 2; row++) {
        for (let col = 0; col < BOARD_SIZE - 2; col++) {
            if (board[row][col] &&
                board[row][col] === board[row + 1][col + 1] &&
                board[row][col] === board[row + 2][col + 2]) {

                const matchTiles = [{ row, col }];
                let k = 1;
                while (row + k < BOARD_SIZE && col + k < BOARD_SIZE &&
                    board[row + k][col + k] === board[row][col]) {
                    matchTiles.push({ row: row + k, col: col + k });
                    k++;
                }

                const key = `d1-${row}-${col}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    matches.push({
                        type: 'diagonal1',
                        tiles: matchTiles,
                        length: matchTiles.length
                    });
                }
            }
        }
    }

    // 대각선 매치 확인 (↙ 방향)
    for (let row = 0; row < BOARD_SIZE - 2; row++) {
        for (let col = 2; col < BOARD_SIZE; col++) {
            if (board[row][col] &&
                board[row][col] === board[row + 1][col - 1] &&
                board[row][col] === board[row + 2][col - 2]) {

                const matchTiles = [{ row, col }];
                let k = 1;
                while (row + k < BOARD_SIZE && col - k >= 0 &&
                    board[row + k][col - k] === board[row][col]) {
                    matchTiles.push({ row: row + k, col: col - k });
                    k++;
                }

                const key = `d2-${row}-${col}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    matches.push({
                        type: 'diagonal2',
                        tiles: matchTiles,
                        length: matchTiles.length
                    });
                }
            }
        }
    }

    return matches;
}

// 매치 처리
async function processMatches() {
    let matches = findMatches();

    while (matches.length > 0) {
        const allTiles = new Set();
        const specialBlocksToCreate = [];

        matches.forEach(match => {
            // 특수 블록 생성 위치 결정 (중앙 타일)
            const centerIdx = Math.floor(match.tiles.length / 2);
            const centerTile = match.tiles[centerIdx];

            if (match.length >= 5) {
                // 5개 이상: 색상 폭탄
                specialBlocksToCreate.push({
                    row: centerTile.row,
                    col: centerTile.col,
                    type: SPECIAL_TYPES.COLOR
                });
            } else if (match.length === 4) {
                // 4개: 통합 라인 클리어 블록
                specialBlocksToCreate.push({
                    row: centerTile.row,
                    col: centerTile.col,
                    type: SPECIAL_TYPES.LINE
                });
            }

            match.tiles.forEach(tile => {
                allTiles.add(`${tile.row},${tile.col}`);
            });
        });

        // 매치된 타일 애니메이션
        const tiles = document.querySelectorAll('.tile');
        allTiles.forEach(pos => {
            const [row, col] = pos.split(',').map(Number);
            const tile = tiles[row * BOARD_SIZE + col];
            if (tile) tile.classList.add('matched');
        });

        // 점수 계산 및 표시
        const matchScore = allTiles.size * 10 * combo;
        score += matchScore;
        updateScore();
        showScorePopup(matchScore);

        await delay(400);

        // 특수 블록 위치 Set
        const specialPositions = new Set(
            specialBlocksToCreate.map(s => `${s.row},${s.col}`)
        );

        // 매치된 타일 제거 (특수 블록 생성할 위치 제외)
        allTiles.forEach(pos => {
            const [row, col] = pos.split(',').map(Number);
            if (!specialPositions.has(pos)) {
                board[row][col] = null;
                specialBoard[row][col] = null;
            }
        });

        // 특수 블록 생성 (아이콘 변경)
        specialBlocksToCreate.forEach(special => {
            specialBoard[special.row][special.col] = special.type;
            if (special.type === SPECIAL_TYPES.LINE) {
                board[special.row][special.col] = SPECIAL_ICONS.LINE;
            } else if (special.type === SPECIAL_TYPES.COLOR) {
                board[special.row][special.col] = SPECIAL_ICONS.COLOR;
            }
        });

        // 타일 떨어뜨리기
        await dropTiles();

        // 새 타일 채우기
        await fillBoard();

        renderBoard();

        // 콤보 증가
        combo++;
        updateCombo();

        await delay(300);

        // 새로운 매치 확인
        matches = findMatches();
    }

    // 콤보 리셋
    combo = 1;
    updateCombo();
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
