// 게임 상수
const BOARD_SIZE = 7;
const TILE_TYPES = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨'];

// 게임 상태
let board = [];
let selectedTile = null;
let score = 0;
let combo = 1;
let isProcessing = false;

// 터치/스와이프 상태
let touchStartX = 0;
let touchStartY = 0;
let touchStartTile = null;

// DOM 요소
const gameBoard = document.getElementById('gameBoard');
const scoreDisplay = document.getElementById('score');
const comboDisplay = document.getElementById('combo');
const restartBtn = document.getElementById('restartBtn');

// 게임 초기화
function initGame() {
    board = [];
    selectedTile = null;
    score = 0;
    combo = 1;
    isProcessing = false;

    updateScore();
    updateCombo();

    // 보드 생성 (매치 없이)
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            board[row][col] = getRandomTileWithoutMatch(row, col);
        }
    }

    renderBoard();
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
    if (isProcessing) return;

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
    if (isProcessing) return;

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTile = { row, col };
}

// 터치 종료 핸들러 (스와이프 감지)
function handleTouchEnd(e, row, col) {
    if (isProcessing || !touchStartTile) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    const minSwipeDistance = 30; // 최소 스와이프 거리

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

// 타일 교환
async function swapTiles(row1, col1, row2, col2) {
    isProcessing = true;

    // 배열에서 교환
    const temp = board[row1][col1];
    board[row1][col1] = board[row2][col2];
    board[row2][col2] = temp;

    renderBoard();

    // 매치 확인
    const matches = findMatches();

    if (matches.length > 0) {
        combo = 1;
        await processMatches();
    } else {
        // 매치가 없으면 다시 교환
        await delay(200);
        board[row2][col2] = board[row1][col1];
        board[row1][col1] = temp;
        renderBoard();
    }

    isProcessing = false;
}

// 매치 찾기
function findMatches() {
    const matches = new Set();

    // 가로 매치 확인
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE - 2; col++) {
            if (board[row][col] &&
                board[row][col] === board[row][col + 1] &&
                board[row][col] === board[row][col + 2]) {
                matches.add(`${row},${col}`);
                matches.add(`${row},${col + 1}`);
                matches.add(`${row},${col + 2}`);

                // 3개 이상 연속 확인
                let k = col + 3;
                while (k < BOARD_SIZE && board[row][k] === board[row][col]) {
                    matches.add(`${row},${k}`);
                    k++;
                }
            }
        }
    }

    // 세로 매치 확인
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let row = 0; row < BOARD_SIZE - 2; row++) {
            if (board[row][col] &&
                board[row][col] === board[row + 1][col] &&
                board[row][col] === board[row + 2][col]) {
                matches.add(`${row},${col}`);
                matches.add(`${row + 1},${col}`);
                matches.add(`${row + 2},${col}`);

                // 3개 이상 연속 확인
                let k = row + 3;
                while (k < BOARD_SIZE && board[k][col] === board[row][col]) {
                    matches.add(`${k},${col}`);
                    k++;
                }
            }
        }
    }

    // 대각선 매치 확인 (↘ 방향)
    for (let row = 0; row < BOARD_SIZE - 2; row++) {
        for (let col = 0; col < BOARD_SIZE - 2; col++) {
            if (board[row][col] &&
                board[row][col] === board[row + 1][col + 1] &&
                board[row][col] === board[row + 2][col + 2]) {
                matches.add(`${row},${col}`);
                matches.add(`${row + 1},${col + 1}`);
                matches.add(`${row + 2},${col + 2}`);

                let k = 3;
                while (row + k < BOARD_SIZE && col + k < BOARD_SIZE &&
                    board[row + k][col + k] === board[row][col]) {
                    matches.add(`${row + k},${col + k}`);
                    k++;
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
                matches.add(`${row},${col}`);
                matches.add(`${row + 1},${col - 1}`);
                matches.add(`${row + 2},${col - 2}`);

                let k = 3;
                while (row + k < BOARD_SIZE && col - k >= 0 &&
                    board[row + k][col - k] === board[row][col]) {
                    matches.add(`${row + k},${col - k}`);
                    k++;
                }
            }
        }
    }

    return Array.from(matches).map(pos => {
        const [row, col] = pos.split(',').map(Number);
        return { row, col };
    });
}

// 매치 처리
async function processMatches() {
    let matches = findMatches();

    while (matches.length > 0) {
        // 매치된 타일 애니메이션
        const tiles = document.querySelectorAll('.tile');
        matches.forEach(({ row, col }) => {
            const tile = tiles[row * BOARD_SIZE + col];
            if (tile) tile.classList.add('matched');
        });

        // 점수 계산 및 표시
        const matchScore = matches.length * 10 * combo;
        score += matchScore;
        updateScore();
        showScorePopup(matchScore);

        await delay(400);

        // 매치된 타일 제거
        matches.forEach(({ row, col }) => {
            board[row][col] = null;
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
                    board[row][col] = null;
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
restartBtn.addEventListener('click', initGame);

// 게임 시작
initGame();
