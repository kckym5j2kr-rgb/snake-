// Culture Snake / Comecocos with quiz questions, topics and progress bar

// Canvas and UI
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const startBtn = document.getElementById("start-btn");

const topicSelect = document.getElementById("topic-select");
const topicWarning = document.getElementById("topic-warning");

// Progress bar
const levelFill = document.getElementById("level-fill");
const levelText = document.getElementById("level-text");

// Quiz DOM
const quizModal = document.getElementById("quiz-modal");
const quizQuestionEl = document.getElementById("quiz-question");
const quizOptionsEl = document.getElementById("quiz-options");
const quizFeedbackEl = document.getElementById("quiz-feedback");

// Grid configuration
const tileSize = 20; // 20px * 20 tiles = 400px
const tilesX = canvas.width / tileSize;
const tilesY = canvas.height / tileSize;

// Game state
let snake = [];
let direction = { x: 1, y: 0 };   // start moving right
let nextDirection = { x: 1, y: 0 };
let food = { x: 5, y: 5 };
let score = 0;
let highScore = 0;
let gameInterval = null;
let gameSpeedMs = 120;
let isGameOver = false;

// Progress (correct answers in this run)
let correctThisRun = 0;
const maxProgressQuestions = 20;

// Quiz state loaded from JSON
let questionsByCategory = {};
let currentCategoryKey = "";
let currentCategoryQuestions = [];
let currentQuestionIndex = -1;
let pendingQuestion = false;
let questionsLoaded = false;

// Load questions.json once when the page loads
fetch("questions.json")
  .then(res => res.json())
  .then(data => {
    questionsByCategory = data;
    questionsLoaded = true;
  })
  .catch(err => {
    console.error("Error loading questions:", err);
  });

// -------- Helpers --------
function randomInt(min, maxExclusive) {
  return Math.floor(Math.random() * (maxExclusive - min)) + min;
}

// Optional vibration helper (safe on unsupported devices)
function vibrate(pattern) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

// Progress bar helper
function setProgress(correctCount) {
  correctThisRun = correctCount;
  const capped = Math.min(correctThisRun, maxProgressQuestions);
  const percent = (capped / maxProgressQuestions) * 100;
  levelFill.style.height = percent + "%";
  levelText.textContent = capped + " / " + maxProgressQuestions;
}

function resetGame() {
  score = 0;
  scoreEl.textContent = score;

  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 }
  ];

  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  isGameOver = false;
  pendingQuestion = false;

  setProgress(0);

  placeFood();
  drawGame();
}

function placeFood() {
  let valid = false;
  while (!valid) {
    const x = randomInt(0, tilesX);
    const y = randomInt(0, tilesY);
    const onSnake = snake.some(segment => segment.x === x && segment.y === y);
    if (!onSnake) {
      food = { x, y };
      valid = true;
    }
  }
}

// -------- Main update & draw --------
function update() {
  if (isGameOver || pendingQuestion) return;

  // Apply buffered direction
  direction = { ...nextDirection };

  const head = snake[0];
  let newHeadX = head.x + direction.x;
  let newHeadY = head.y + direction.y;

  // Wrap-around tunnels (comecocos-style)
  if (newHeadX < 0) newHeadX = tilesX - 1;
  if (newHeadX >= tilesX) newHeadX = 0;
  if (newHeadY < 0) newHeadY = tilesY - 1;
  if (newHeadY >= tilesY) newHeadY = 0;

  const newHead = { x: newHeadX, y: newHeadY };

  // Self-collision
  if (snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
    handleGameOver();
    return;
  }

  snake.unshift(newHead);

  // Eat food?
  if (newHead.x === food.x && newHead.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
    }
    placeFood();

    // Show quiz question and pause game loop
    showNextQuestion();
    return; // stop this tick after eating
  } else {
    // Move forward
    snake.pop();
  }

  drawGame();
}

// -------- Drawing --------
function drawGame() {
  // Clear board
  ctx.fillStyle = "#020230";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Background pellet grid
  ctx.fillStyle = "#081050";
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      ctx.fillRect(
        x * tileSize + tileSize / 2 - 1,
        y * tileSize + tileSize / 2 - 1,
        2,
        2
      );
    }
  }

  // Food (bright dot)
  ctx.fillStyle = "#ffd71a";
  ctx.beginPath();
  ctx.arc(
    food.x * tileSize + tileSize / 2,
    food.y * tileSize + tileSize / 2,
    tileSize * 0.3,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Snake
  snake.forEach((segment, index) => {
    if (index === 0) {
      ctx.fillStyle = "#1affff"; // head
    } else {
      ctx.fillStyle = "#14c8c8"; // body
    }
    ctx.fillRect(
      segment.x * tileSize + 1,
      segment.y * tileSize + 1,
      tileSize - 2,
      tileSize - 2
    );
  });
}

// -------- Game over --------
function handleGameOver() {
  isGameOver = true;
  clearInterval(gameInterval);
  gameInterval = null;

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "14px system-ui";
  ctx.fillText("Press Start to play again", canvas.width / 2, canvas.height / 2 + 16);
}

function gameLoop() {
  update();
}

// -------- Quiz logic --------
function showNextQuestion() {
  if (!currentCategoryQuestions || currentCategoryQuestions.length === 0) {
    return;
  }

  pendingQuestion = true;

  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
  }

  currentQuestionIndex = (currentQuestionIndex + 1) % currentCategoryQuestions.length;
  const q = currentCategoryQuestions[currentQuestionIndex];

  quizQuestionEl.textContent = q.text;
  quizOptionsEl.innerHTML = "";
  quizFeedbackEl.textContent = "";

  q.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.className = "quiz-option";
    btn.addEventListener("click", () => handleAnswer(index));
    quizOptionsEl.appendChild(btn);
  });

  quizModal.style.display = "flex";
}

function handleAnswer(selectedIndex) {
  const q = currentCategoryQuestions[currentQuestionIndex];
  const isCorrect = selectedIndex === q.correctIndex;

  const buttons = quizOptionsEl.querySelectorAll(".quiz-option");
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.correctIndex) {
      btn.classList.add("correct");
    }
    if (idx === selectedIndex && !isCorrect) {
      btn.classList.add("incorrect");
    }
  });

  if (isCorrect) {
    score += 5;
    setProgress(correctThisRun + 1);
    quizFeedbackEl.textContent = "Correct! +5 points.";
    vibrate(120);
  } else {
    score = Math.max(0, score - 5);
    quizFeedbackEl.textContent = "Not quite. −5 points.";
    vibrate([80, 60, 80]);
  }
  scoreEl.textContent = score;

  setTimeout(() => {
    quizModal.style.display = "none";
    pendingQuestion = false;

    if (!isGameOver && !gameInterval) {
      gameInterval = setInterval(gameLoop, gameSpeedMs);
    }
  }, 900);
}

// -------- Controls & start button --------
window.addEventListener("keydown", e => {
  const key = e.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
    e.preventDefault();
  }

  if (key === "ArrowUp" && direction.y !== 1) {
    nextDirection = { x: 0, y: -1 };
  } else if (key === "ArrowDown" && direction.y !== -1) {
    nextDirection = { x: 0, y: 1 };
  } else if (key === "ArrowLeft" && direction.x !== 1) {
    nextDirection = { x: -1, y: 0 };
  } else if (key === "ArrowRight" && direction.x !== -1) {
    nextDirection = { x: 1, y: 0 };
  }
});

startBtn.addEventListener("click", () => {
  if (!questionsLoaded) {
    topicWarning.textContent = "Questions are still loading. Please wait a moment.";
    return;
  }

  const selected = topicSelect.value;
  if (!selected) {
    topicWarning.textContent = "Please choose a topic before starting.";
    return;
  }
  topicWarning.textContent = "";

  currentCategoryKey = selected;
  currentCategoryQuestions = questionsByCategory[currentCategoryKey] || [];
  currentQuestionIndex = -1;

  resetGame();
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, gameSpeedMs);
});

// Initial static draw
resetGame();

