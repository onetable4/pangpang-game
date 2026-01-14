// 게임 상수
const BOARD_SIZE = 7;
const TILE_TYPES = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨'];
const GAME_DURATION = 60; // 60초

// 특수 블록 타입
const SPECIAL_TYPES = {
    HORIZONTAL: 'special-h',  // 가로줄 삭제
    VERTICAL: 'special-v',    // 세로줄 삭제
    DIAGONAL1: 'special-d1',  // 대각선 ↘ 삭제
    DIAGONAL2: 'special-d2',  // 대각선 ↙ 삭제
    COLOR: 'special-color'    // 같은 색 전체 삭제
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
    gameStarted = true;
    startOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
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
function endGame() {
    gameStarted = false;
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }

    finalScore.textContent = score.toLocaleString();
    endOverlay.classList.remove('hidden');
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

// 특수 블록 발동
async function activateSpecialBlock(row, col) {
    isProcessing = true;
    const specialType = specialBoard[row][col];
    const tileType = board[row][col];
    const tilesToClear = [];

    if (specialType === SPECIAL_TYPES.HORIZONTAL) {
        // 가로줄 전체 삭제
        for (let c = 0; c < BOARD_SIZE; c++) {
            tilesToClear.push({ row, col: c });
        }
    } else if (specialType === SPECIAL_TYPES.VERTICAL) {
        // 세로줄 전체 삭제
        for (let r = 0; r < BOARD_SIZE; r++) {
            tilesToClear.push({ row: r, col });
        }
    } else if (specialType === SPECIAL_TYPES.DIAGONAL1) {
        // 대각선 ↘ 삭제
        for (let i = -BOARD_SIZE; i < BOARD_SIZE; i++) {
            const r = row + i;
            const c = col + i;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                tilesToClear.push({ row: r, col: c });
            }
        }
    } else if (specialType === SPECIAL_TYPES.DIAGONAL2) {
        // 대각선 ↙ 삭제
        for (let i = -BOARD_SIZE; i < BOARD_SIZE; i++) {
            const r = row + i;
            const c = col - i;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                tilesToClear.push({ row: r, col: c });
            }
        }
    } else if (specialType === SPECIAL_TYPES.COLOR) {
        // 같은 동물 전체 삭제
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === tileType) {
                    tilesToClear.push({ row: r, col: c });
                }
            }
        }
    }

    // 점수 계산
    const clearScore = tilesToClear.length * 15 * combo;
    score += clearScore;
    updateScore();
    showScorePopup(clearScore);

    // 애니메이션
    const tiles = document.querySelectorAll('.tile');
    tilesToClear.forEach(({ row: r, col: c }) => {
        const tile = tiles[r * BOARD_SIZE + c];
        if (tile) tile.classList.add('line-clear');
    });

    await delay(500);

    // 타일 제거
    tilesToClear.forEach(({ row: r, col: c }) => {
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

    isProcessing = false;
}

// 매치 찾기 (방향과 길이 정보 포함)
function findMatches() {
    const matches = [];
    const visited = new Set();

    // 가로 매치 확인
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE - 2; col++) {
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
                col = k - 1;
            }
        }
    }

    // 세로 매치 확인
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE - 2; row++) {
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
                row = k - 1;
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
            // 특수 블록 생성 위치 결정 (첫 번째 타일 위치)
            const firstTile = match.tiles[0];

            if (match.length >= 5) {
                // 5개 이상: 색상 폭탄
                specialBlocksToCreate.push({
                    row: firstTile.row,
                    col: firstTile.col,
                    type: SPECIAL_TYPES.COLOR,
                    tileType: board[firstTile.row][firstTile.col]
                });
            } else if (match.length === 4) {
                // 4개: 방향별 라인 클리어
                let specialType;
                if (match.type === 'horizontal') {
                    specialType = SPECIAL_TYPES.HORIZONTAL;
                } else if (match.type === 'vertical') {
                    specialType = SPECIAL_TYPES.VERTICAL;
                } else if (match.type === 'diagonal1') {
                    specialType = SPECIAL_TYPES.DIAGONAL1;
                } else {
                    specialType = SPECIAL_TYPES.DIAGONAL2;
                }
                specialBlocksToCreate.push({
                    row: firstTile.row,
                    col: firstTile.col,
                    type: specialType,
                    tileType: board[firstTile.row][firstTile.col]
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

        // 매치된 타일 제거 (특수 블록 생성할 위치 제외)
        const specialPositions = new Set(
            specialBlocksToCreate.map(s => `${s.row},${s.col}`)
        );

        allTiles.forEach(pos => {
            const [row, col] = pos.split(',').map(Number);
            if (!specialPositions.has(pos)) {
                board[row][col] = null;
                specialBoard[row][col] = null;
            }
        });

        // 특수 블록 생성
        specialBlocksToCreate.forEach(special => {
            specialBoard[special.row][special.col] = special.type;
            // 타일 유지 (이미 있음)
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
function showScorePopup(points) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${points}`;
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

// 초기 보드 표시 (게임 시작 전)
initGame();
