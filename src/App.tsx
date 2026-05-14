import { useEffect, useRef, useState } from 'react';
import { Trophy, Heart, Play, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Types ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 15;
const BALL_RADIUS = 8;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_PADDING = 10;
const BRICK_HEIGHT = 25;
const BRICK_TOP_OFFSET = 60;
const INITIAL_LIVES = 3;

type GameStatus = 'IDLE' | 'PLAYING' | 'GAMEOVER' | 'WON';

interface Brick {
  x: number;
  y: number;
  status: number; // 1 = active, 0 = destroyed
  color: string;
}

const COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#f59e0b', // Amber
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  // --- Game State Refs (to avoid high-frequency re-renders) ---
  const paddleRef = useRef({ x: (CANVAS_WIDTH - PADDLE_WIDTH) / 2 });
  const ballRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 40,
    dx: 4,
    dy: -4,
  });
  const bricksRef = useRef<Brick[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // --- React State for UI ---
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [status, setStatus] = useState<GameStatus>('IDLE');

  // Initialize Bricks
  const initBricks = () => {
    const bricks: Brick[] = [];
    const brickWidth = (CANVAS_WIDTH - (BRICK_COLS + 1) * BRICK_PADDING) / BRICK_COLS;
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: c * (brickWidth + BRICK_PADDING) + BRICK_PADDING,
          y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_TOP_OFFSET,
          status: 1,
          color: COLORS[r % COLORS.length],
        });
      }
    }
    bricksRef.current = bricks;
  };

  const resetBall = () => {
    ballRef.current = {
      x: paddleRef.current.x + PADDLE_WIDTH / 2,
      y: CANVAS_HEIGHT - PADDLE_HEIGHT - BALL_RADIUS - 10,
      dx: 4 * (Math.random() > 0.5 ? 1 : -1),
      dy: -4,
    };
  };

  const startGame = () => {
    initBricks();
    setScore(0);
    setLives(INITIAL_LIVES);
    setStatus('PLAYING');
    resetBall();
  };

  const restartGame = () => {
    startGame();
  };

  // --- Collision & Logic ---
  const update = () => {
    if (status !== 'PLAYING') return;

    const ball = ballRef.current;
    const paddle = paddleRef.current;
    const bricks = bricksRef.current;

    // Move Paddle
    if (keysRef.current['ArrowLeft'] || keysRef.current['a']) {
      paddle.x = Math.max(0, paddle.x - 7);
    }
    if (keysRef.current['ArrowRight'] || keysRef.current['d']) {
      paddle.x = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, paddle.x + 7);
    }

    // Move Ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall Collision (Left/Right)
    if (ball.x + ball.dx > CANVAS_WIDTH - BALL_RADIUS || ball.x + ball.dx < BALL_RADIUS) {
      ball.dx = -ball.dx;
    }

    // Wall Collision (Top)
    if (ball.y + ball.dy < BALL_RADIUS) {
      ball.dy = -ball.dy;
    } 
    // Bottom Collision / Paddle
    else if (ball.y + ball.dy > CANVAS_HEIGHT - BALL_RADIUS - PADDLE_HEIGHT - 5) {
      if (ball.x > paddle.x && ball.x < paddle.x + PADDLE_WIDTH) {
        // Dynamic bounce based on where it hits the paddle
        const hitPos = (ball.x - (paddle.x + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2);
        ball.dx = hitPos * 5;
        ball.dy = -Math.abs(ball.dy); // Ensure it goes up
      } else if (ball.y + ball.dy > CANVAS_HEIGHT - BALL_RADIUS) {
        // Lose life
        setLives((prev) => {
          if (prev <= 1) {
            setStatus('GAMEOVER');
            return 0;
          }
          resetBall();
          return prev - 1;
        });
      }
    }

    // Brick Collision
    let activeFound = false;
    for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (b.status === 1) {
          activeFound = true;
          const brickWidth = (CANVAS_WIDTH - (BRICK_COLS + 1) * BRICK_PADDING) / BRICK_COLS;
          if (
            ball.x > b.x &&
            ball.x < b.x + brickWidth &&
            ball.y > b.y &&
            ball.y < b.y + BRICK_HEIGHT
          ) {
            ball.dy = -ball.dy;
            b.status = 0;
            setScore((prev) => prev + 10);
            break; // Handle one collision per frame for stability
          }
        }
    }

    if (!activeFound && status === 'PLAYING') {
      setStatus('WON');
    }
  };

  // --- Drawing ---
  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background Gradient (Subtle)
    const grad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH
    );
    grad.addColorStop(0, '#09090b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Bricks
    const brickWidth = (CANVAS_WIDTH - (BRICK_COLS + 1) * BRICK_PADDING) / BRICK_COLS;
    bricksRef.current.forEach((b) => {
      if (b.status === 1) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color;
        ctx.beginPath();
        // Use standard fillRect if roundRect isn't supported, though modern browsers have it
        ctx.roundRect ? ctx.roundRect(b.x, b.y, brickWidth, BRICK_HEIGHT, 4) : ctx.rect(b.x, b.y, brickWidth, BRICK_HEIGHT);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.closePath();
        ctx.restore();
      }
    });

    // Draw Paddle
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#10b981';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(paddleRef.current.x, CANVAS_HEIGHT - PADDLE_HEIGHT - 5, PADDLE_WIDTH, PADDLE_HEIGHT, 8) : ctx.rect(paddleRef.current.x, CANVAS_HEIGHT - PADDLE_HEIGHT - 5, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    // Draw Ball
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#fff';
    ctx.beginPath();
    ctx.arc(ballRef.current.x, ballRef.current.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  };

  const gameLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    update();
    draw(ctx);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // --- Effects ---
  useEffect(() => {
    initBricks();
    requestRef.current = requestAnimationFrame(gameLoop);

    const handleKeyDown = (e: KeyboardEvent) => (keysRef.current[e.key] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keysRef.current[e.key] = false);
    const handleMouseMove = (e: MouseEvent) => {
      if (canvasRef.current && status === 'PLAYING') {
        const rect = canvasRef.current.getBoundingClientRect();
        const relativeX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
        if (relativeX > 0 && relativeX < CANVAS_WIDTH) {
          paddleRef.current.x = relativeX - PADDLE_WIDTH / 2;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [status]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-[800px]">
        {/* HUD */}
        <div className="flex items-center justify-between mb-4 bg-zinc-900/50 backdrop-blur-md p-4 rounded-xl border border-zinc-800 shadow-xl">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-display">Score</span>
              <span className="text-xl font-bold font-display tabular-nums leading-none tracking-tight">{score}</span>
            </div>
          </div>
          
          <div className="text-2xl font-bold font-display tracking-tighter text-emerald-400 italic">
            NEON BREAKOUT
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-display">Lives</span>
              <div className="flex gap-1.5 mt-1">
                {[...Array(INITIAL_LIVES)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-4 h-4 transition-colors duration-300 ${
                      i < lives ? 'text-rose-500 fill-rose-500' : 'text-zinc-800 fill-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Game Canvas */}
        <div className="relative group">
          <canvas
            id="game-canvas"
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 canvas-glow transition-all duration-500 cursor-none w-full"
          />

          {/* Overlays */}
          <AnimatePresence mode="wait">
            {status !== 'PLAYING' && (
              <motion.div
                key={status}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10"
              >
                {status === 'IDLE' && (
                  <>
                    <h1 className="text-6xl font-bold font-display mb-8 tracking-tighter text-emerald-400">
                      READY?
                    </h1>
                    <button
                      id="start-btn"
                      onClick={startGame}
                      className="group relative px-8 py-4 bg-emerald-500 text-black font-bold font-display rounded-full flex items-center gap-3 hover:bg-emerald-400 transition-all hover:scale-105 active:scale-95 overflow-hidden"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      START GAME
                    </button>
                    <p className="mt-6 text-zinc-500 text-sm font-sans tracking-wide">
                      Use Mouse or Arrow Keys to move
                    </p>
                  </>
                )}

                {(status === 'GAMEOVER' || status === 'WON') && (
                  <>
                    <h1 className={`text-6xl font-bold font-display mb-2 tracking-tighter ${status === 'WON' ? 'text-emerald-400' : 'text-rose-500'}`}>
                      {status === 'WON' ? 'YOU WIN!' : 'GAME OVER'}
                    </h1>
                    <div className="flex flex-col items-center gap-1 mb-8">
                      <span className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-display">Final Score</span>
                      <span className="text-4xl font-bold font-display text-white">{score}</span>
                    </div>
                    <button
                      id="restart-btn"
                      onClick={restartGame}
                      className="group relative px-8 py-4 bg-white text-black font-bold font-display rounded-full flex items-center gap-3 hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95"
                    >
                      <RefreshCw className="w-5 h-5" />
                      PLAY AGAIN
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg border border-zinc-900 bg-zinc-900/20 text-center">
            <span className="block text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Paddle Control</span>
            <span className="text-xs text-zinc-400 uppercase font-display font-medium">Mouse / Keys</span>
          </div>
          <div className="p-3 rounded-lg border border-zinc-900 bg-zinc-900/20 text-center">
            <span className="block text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Renderer</span>
            <span className="text-xs text-zinc-400 uppercase font-display font-medium">Canvas API</span>
          </div>
          <div className="p-3 rounded-lg border border-zinc-900 bg-zinc-900/20 text-center">
            <span className="block text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Frame Rate</span>
            <span className="text-xs text-zinc-400 uppercase font-display font-medium">60 FPS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
