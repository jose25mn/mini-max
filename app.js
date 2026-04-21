import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";

// Simbolos usados no tabuleiro.
const HUMAN = "X";
const AI = "O";

// Todas as combinacoes vencedoras do jogo da velha.
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

let globalNodeId = 0;

// Cria um tabuleiro vazio 3x3 representado por um vetor linear.
function createEmptyBoard() {
  return Array(9).fill(null);
}

// Copia defensiva para evitar mutacao acidental de estado e de nos da arvore.
function cloneBoard(board) {
  return [...board];
}

// Verifica se ha vencedor ou empate no estado atual do tabuleiro.
function getWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every(Boolean)) {
    return "draw";
  }

  return null;
}

// Converte um estado terminal em utilidade numerica para o Minimax.
function scoreTerminal(result) {
  if (result === AI) {
    return 1;
  }
  if (result === HUMAN) {
    return -1;
  }
  return 0;
}

// Retorna as casas livres que ainda podem receber jogada.
function availableMoves(board) {
  const moves = [];
  board.forEach((cell, index) => {
    if (!cell) {
      moves.push(index);
    }
  });
  return moves;
}

// Alterna entre IA e humano durante a exploracao da arvore.
function nextPlayer(player) {
  return player === AI ? HUMAN : AI;
}

// Gera uma assinatura textual do tabuleiro para facilitar depuracao e identificacao.
function boardSignature(board) {
  return board.map((cell) => cell || "-").join("");
}

// Heuristica simples de prioridade visual: centro > cantos > laterais.
// Isso ajuda a escolher quais ramos mostrar quando a arvore precisa ser resumida.
function movePriority(move) {
  if (move === 4) {
    return 3;
  }
  if ([0, 2, 6, 8].includes(move)) {
    return 2;
  }
  return 1;
}

// Implementacao do Minimax com poda alpha-beta.
// Esta funcao nao monta a arvore visual; ela apenas calcula o melhor score
// de forma eficiente para que a decisao da IA continue correta mesmo quando
// a visualizacao mostra apenas parte dos ramos.
function alphaBetaScore(board, playerToMove, alpha = -Infinity, beta = Infinity) {
  const terminal = getWinner(board);
  if (terminal) {
    return scoreTerminal(terminal);
  }

  // Turno da IA: tentamos maximizar a utilidade.
  if (playerToMove === AI) {
    let bestScore = -Infinity;
    for (const move of availableMoves(board)) {
      const nextBoard = cloneBoard(board);
      nextBoard[move] = AI;
      const score = alphaBetaScore(nextBoard, HUMAN, alpha, beta);
      if (score > bestScore) {
        bestScore = score;
      }

      // Atualiza alpha com o melhor valor MAX encontrado ate agora.
      alpha = Math.max(alpha, bestScore);

      // Se MIN ja possui alternativa melhor ou igual, este ramo nao precisa continuar.
      if (beta <= alpha) {
        break;
      }
    }
    return bestScore;
  }

  // Turno do humano: assumimos um adversario otimo que minimiza a utilidade da IA.
  let bestScore = Infinity;
  for (const move of availableMoves(board)) {
    const nextBoard = cloneBoard(board);
    nextBoard[move] = HUMAN;
    const score = alphaBetaScore(nextBoard, AI, alpha, beta);
    if (score < bestScore) {
      bestScore = score;
    }

    // Atualiza beta com o melhor valor MIN encontrado ate agora.
    beta = Math.min(beta, bestScore);

    // Se MAX ja possui alternativa melhor ou igual, este ramo pode ser podado.
    if (beta <= alpha) {
      break;
    }
  }
  return bestScore;
}

// Escolhe apenas um subconjunto dos movimentos para a arvore visual.
// A decisao final continua sendo calculada pelo alpha-beta completo; aqui
// o objetivo e apenas manter a visualizacao legivel e responsiva.
function chooseVisibleMoves(board, playerToMove, maxMoves) {
  const scoredMoves = availableMoves(board).map((move) => {
    const nextBoard = cloneBoard(board);
    nextBoard[move] = playerToMove;
    return {
      move,
      score: alphaBetaScore(nextBoard, nextPlayer(playerToMove)),
      priority: movePriority(move),
    };
  });

  scoredMoves.sort((a, b) => {
    if (playerToMove === AI) {
      return b.score - a.score || b.priority - a.priority || a.move - b.move;
    }
    return a.score - b.score || b.priority - a.priority || a.move - b.move;
  });

  return scoredMoves.slice(0, Math.min(maxMoves, scoredMoves.length));
}

// Monta a arvore que sera desenhada na interface.
// Quando a profundidade maxima visual e atingida, o ramo para de expandir,
// mas o score daquele ponto continua sendo calculado pelo alpha-beta completo.
function buildVisualizationTree(board, playerToMove, depth = 0, maxDepth = 2) {
  const terminal = getWinner(board);
  const node = {
    id: `node-${globalNodeId++}`,
    board: cloneBoard(board),
    boardKey: boardSignature(board),
    playerToMove,
    depth,
    role: playerToMove === AI ? "max" : "min",
    children: [],
    move: null,
    terminal: Boolean(terminal),
    result: terminal,
    score: terminal ? scoreTerminal(terminal) : null,
    bestChildId: null,
    bestMove: null,
    collapsed: false,
  };

  if (terminal) {
    return node;
  }

  // Raiz recebe mais movimentos para dar contexto; niveis seguintes recebem menos.
  const visibleMoves = chooseVisibleMoves(board, playerToMove, depth === 0 ? 5 : 4);
  const children = visibleMoves.map(({ move, score }) => {
    const nextBoard = cloneBoard(board);
    nextBoard[move] = playerToMove;
    const childTerminal = getWinner(nextBoard);

    if (depth + 1 >= maxDepth || childTerminal) {
      return {
        id: `node-${globalNodeId++}`,
        board: cloneBoard(nextBoard),
        boardKey: boardSignature(nextBoard),
        playerToMove: nextPlayer(playerToMove),
        depth: depth + 1,
        role: nextPlayer(playerToMove) === AI ? "max" : "min",
        children: [],
        move,
        terminal: Boolean(childTerminal),
        result: childTerminal,
        score: childTerminal ? scoreTerminal(childTerminal) : score,
        bestChildId: null,
        bestMove: null,
        // Indica visualmente que o algoritmo ainda teria continuacao abaixo deste ponto.
        collapsed: !childTerminal && availableMoves(nextBoard).length > 0,
      };
    }

    const child = buildVisualizationTree(nextBoard, nextPlayer(playerToMove), depth + 1, maxDepth);
    child.move = move;
    return child;
  });

  node.children = children;

  let chosenChild = null;

  // Em cada nivel, o no herda o melhor score de um de seus filhos,
  // respeitando a regra MAX para IA e MIN para humano.
  if (playerToMove === AI) {
    let bestScore = -Infinity;
    children.forEach((child) => {
      if (child.score > bestScore) {
        bestScore = child.score;
        chosenChild = child;
      }
    });
    node.score = bestScore;
  } else {
    let bestScore = Infinity;
    children.forEach((child) => {
      if (child.score < bestScore) {
        bestScore = child.score;
        chosenChild = child;
      }
    });
    node.score = bestScore;
  }

  node.bestChildId = chosenChild ? chosenChild.id : null;
  node.bestMove = chosenChild ? chosenChild.move : null;
  return node;
}

// Recupera o caminho escolhido pela IA seguindo os melhores filhos desde a raiz.
function buildWinnerPath(root) {
  const ids = [];
  let current = root;
  while (current) {
    ids.push(current.id);
    current = current.children.find((child) => child.id === current.bestChildId) || null;
  }
  return ids;
}

// Gera uma sequencia curta de eventos para animar a busca na interface.
// A animacao nao tenta imitar cada chamada recursiva real; ela destaca os
// candidatos principais e depois aprofunda no melhor ramo para fins didaticos.
function buildFocusTrace(root) {
  const trace = [];

  function visit(node) {
    trace.push({ type: "enter", nodeId: node.id });

    if (node.children.length === 0) {
      trace.push({ type: "resolve", nodeId: node.id, score: node.score });
      return;
    }

    node.children.forEach((child) => {
      trace.push({ type: "enter", nodeId: child.id });
      trace.push({ type: "resolve", nodeId: child.id, score: child.score });
    });

    const bestChild = node.children.find((child) => child.id === node.bestChildId) || null;
    if (bestChild && bestChild.children.length > 0) {
      visit(bestChild);
    }

    trace.push({
      type: "resolve",
      nodeId: node.id,
      score: node.score,
      bestChildId: node.bestChildId,
    });
  }

  visit(root);
  return trace;
}

// Calcula posicoes x/y para desenhar a arvore em SVG.
// Folhas sao distribuidas horizontalmente e os nos internos ficam centralizados
// sobre seus descendentes.
function layoutTree(root) {
  let leafIndex = 0;
  const depthLevels = [];
  const nodes = [];
  const edges = [];

  function visit(node, depth, parent = null) {
    depthLevels.push(depth);
    const children = node.children || [];
    let x;

    if (children.length === 0) {
      x = leafIndex * 140;
      leafIndex += 1;
    } else {
      const childPositions = children.map((child) => visit(child, depth + 1, node));
      x = childPositions.reduce((sum, position) => sum + position.x, 0) / childPositions.length;
    }

    const y = depth * 140;
    const positionedNode = { ...node, x, y };
    nodes.push(positionedNode);

    if (parent) {
      edges.push({
        id: `${parent.id}-${node.id}`,
        from: parent.id,
        to: node.id,
      });
    }

    return positionedNode;
  }

  visit(root, 0);

  const maxDepth = depthLevels.length ? Math.max(...depthLevels) : 0;
  const width = Math.max(900, leafIndex * 140 + 200);
  const height = Math.max(480, (maxDepth + 1) * 140 + 140);

  return { nodes, edges, width, height };
}

// Formata o score para exibicao visual nos nos da arvore.
function scoreLabel(score) {
  if (score === 1) {
    return "+1";
  }
  if (score === -1) {
    return "-1";
  }
  return "0";
}

// Converte o resultado interno do jogo em texto de status.
function statusFromResult(result) {
  if (result === HUMAN) {
    return "Humano venceu";
  }
  if (result === AI) {
    return "IA venceu";
  }
  if (result === "draw") {
    return "Empate";
  }
  return null;
}

// Pausa artificial usada para controlar a velocidade da animacao.
function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// Celula individual do tabuleiro.
function Cell({ value, index, onPlay, disabled }) {
  return React.createElement(
    "button",
    {
      className: `cell ${value ? `filled ${value.toLowerCase()}` : ""}`,
      onClick: () => onPlay(index),
      disabled,
      "aria-label": `Casa ${index + 1}`,
    },
    value || ""
  );
}

// Grid do jogo da velha.
function Board({ board, onPlay, disabled }) {
  return React.createElement(
    "div",
    { className: "board" },
    board.map((value, index) =>
      React.createElement(Cell, {
        key: index,
        value,
        index,
        onPlay,
        disabled: disabled || Boolean(value),
      })
    )
  );
}

// Legenda visual para a leitura rapida da arvore.
function TreeLegend() {
  const items = [
    { label: "Maximizacao (IA)", className: "max" },
    { label: "Minimizacao (Humano)", className: "min" },
    { label: "Vitoria da IA", className: "win" },
    { label: "Vitoria do Humano", className: "loss" },
    { label: "Empate", className: "draw" },
    { label: "Caminho escolhido", className: "path" },
  ];

  return React.createElement(
    "div",
    { className: "legend" },
    items.map((item) =>
      React.createElement(
        "div",
        { className: "legend-item", key: item.label },
        React.createElement("span", { className: `legend-dot ${item.className}` }),
        React.createElement("span", null, item.label)
      )
    )
  );
}

// Painel SVG da arvore com zoom local.
// O zoom atua apenas sobre o grupo principal da arvore, sem alterar layout ou scores.
function TreeView({ tree, activeNodeId, resolvedNodeIds, winnerPathIds }) {
  const [zoom, setZoom] = useState(1);

  // O layout e memoizado para nao ser recalculado em toda mudanca de destaque visual.
  const layout = useMemo(() => {
    if (!tree) {
      return null;
    }
    return layoutTree(tree);
  }, [tree]);

  const winnerPath = useMemo(() => new Set(winnerPathIds), [winnerPathIds]);
  const resolved = useMemo(() => new Set(resolvedNodeIds), [resolvedNodeIds]);

  // Controles simples de zoom para aproximar ou afastar a visualizacao da arvore.
  const zoomControls = React.createElement(
    "div",
    { className: "tree-zoom-bar" },
    React.createElement("span", { className: "zoom-label" }, "Zoom"),
    React.createElement(
      "button",
      {
        className: "zoom-btn",
        type: "button",
        onClick: () => setZoom((current) => Math.max(0.6, Number((current - 0.1).toFixed(2)))),
      },
      "-"
    ),
    React.createElement("span", { className: "zoom-value" }, `${Math.round(zoom * 100)}%`),
    React.createElement(
      "button",
      {
        className: "zoom-btn",
        type: "button",
        onClick: () => setZoom((current) => Math.min(2.2, Number((current + 0.1).toFixed(2)))),
      },
      "+"
    ),
    React.createElement(
      "button",
      {
        className: "zoom-reset",
        type: "button",
        onClick: () => setZoom(1),
      },
      "100%"
    )
  );

  if (!layout) {
    return React.createElement(
      "div",
      { className: "tree-empty-wrap" },
      zoomControls,
      React.createElement(
        "div",
        { className: "tree-empty" },
        React.createElement("h3", null, "Arvore de decisao"),
        React.createElement(
          "p",
          null,
          "A arvore minimax da jogada atual sera renderizada aqui assim que a IA comecar a avaliar o tabuleiro."
        )
      )
    );
  }

  const nodesMap = new Map(layout.nodes.map((node) => [node.id, node]));

  return React.createElement(
    "div",
    { className: "tree-panel" },
    zoomControls,
    React.createElement(
      "svg",
      {
        className: "tree-svg",
        viewBox: `-80 -40 ${layout.width} ${layout.height}`,
        role: "img",
        "aria-label": "Arvore de decisao do algoritmo minimax",
      },
      React.createElement(
        "defs",
        null,
        React.createElement(
          "filter",
          { id: "neon-glow" },
          React.createElement("feGaussianBlur", { stdDeviation: "4", result: "blur" }),
          React.createElement("feMerge", null, [
            React.createElement("feMergeNode", { key: "a", in: "blur" }),
            React.createElement("feMergeNode", { key: "b", in: "SourceGraphic" }),
          ])
        )
      ),
      React.createElement(
        "g",
        { transform: `scale(${zoom})` },
        // Primeiro desenhamos as arestas para que os nos fiquem por cima.
        layout.edges.map((edge) => {
          const from = nodesMap.get(edge.from);
          const to = nodesMap.get(edge.to);
          const isPath = winnerPath.has(edge.from) && winnerPath.has(edge.to);
          return React.createElement("path", {
            key: edge.id,
            d: `M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2}, ${to.x} ${(from.y + to.y) / 2}, ${to.x} ${to.y}`,
            className: `tree-edge ${isPath ? "winner-path" : ""}`,
          });
        }),
        // Depois desenhamos cada no com cor, score e metadados de jogada.
        layout.nodes.map((node) => {
          const isActive = node.id === activeNodeId;
          const onPath = winnerPath.has(node.id);
          const resolvedNode = resolved.has(node.id) || node.children.length === 0;
          const outcomeClass =
            node.score === 1 ? "win" : node.score === -1 ? "loss" : node.score === 0 ? "draw" : "";
          const roleClass = node.role === "max" ? "max" : "min";
          const classes = [
            "tree-node",
            roleClass,
            resolvedNode ? "resolved" : "",
            onPath ? "winner-path" : "",
            isActive ? "active" : "",
            outcomeClass,
          ]
            .filter(Boolean)
            .join(" ");

          return React.createElement(
            "g",
            { key: node.id, transform: `translate(${node.x}, ${node.y})` },
            React.createElement("circle", {
              r: node.children.length === 0 ? 26 : 22,
              className: classes,
              filter: "url(#neon-glow)",
            }),
            React.createElement(
              "text",
              { className: "node-role", textAnchor: "middle", y: -30 },
              node.role === "max" ? "MAX" : "MIN"
            ),
            React.createElement(
              "text",
              { className: "node-score", textAnchor: "middle", y: 6 },
              scoreLabel(node.score)
            ),
            node.move !== null &&
              React.createElement(
                "text",
                { className: "node-meta", textAnchor: "middle", y: 42 },
                `joga ${node.move + 1}`
              ),
            node.collapsed &&
              React.createElement(
                "text",
                { className: "node-meta", textAnchor: "middle", y: 58 },
                "ramo comprimido"
              )
          );
        })
      )
    )
  );
}

// Componente principal da aplicacao.
// Coordena estado do tabuleiro, animacao da busca, arvore visual e feedback da partida.
function App() {
  const [board, setBoard] = useState(createEmptyBoard);
  const [tree, setTree] = useState(null);
  const [winnerPathIds, setWinnerPathIds] = useState([]);
  const [resolvedNodeIds, setResolvedNodeIds] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [status, setStatus] = useState("Sua vez. Clique em uma casa para iniciar.");
  const [speed, setSpeed] = useState(220);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTokenRef = useRef(0);
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Executa a jogada da IA em tres etapas:
  // 1. monta a arvore visual resumida;
  // 2. anima a exploracao dos nos;
  // 3. aplica a melhor jogada no tabuleiro real.
  async function runAiTurn(nextBoard) {
    animationTokenRef.current += 1;
    const token = animationTokenRef.current;
    globalNodeId = 0;

    setIsAnimating(true);
    setStatus("IA calculando com Minimax...");

    const root = buildVisualizationTree(nextBoard, AI, 0, 2);
    const trace = buildFocusTrace(root);
    setTree(root);
    setWinnerPathIds([]);
    setResolvedNodeIds([]);
    setActiveNodeId(root.id);

    // Reproduz cada evento da trilha visual respeitando a velocidade escolhida pelo usuario.
    for (const event of trace) {
      if (animationTokenRef.current !== token) {
        return;
      }

      if (event.type === "enter") {
        setActiveNodeId(event.nodeId);
      } else {
        setResolvedNodeIds((current) =>
          current.includes(event.nodeId) ? current : [...current, event.nodeId]
        );
        setActiveNodeId(event.nodeId);
      }

      await sleep(speedRef.current);
    }

    if (animationTokenRef.current !== token) {
      return;
    }

    const path = buildWinnerPath(root);
    setWinnerPathIds(path);
    await sleep(Math.max(150, speedRef.current));

    // A jogada efetiva da IA sai do melhor movimento encontrado na raiz.
    const aiMove = root.bestMove;
    const boardAfterAi = cloneBoard(nextBoard);
    boardAfterAi[aiMove] = AI;
    const result = getWinner(boardAfterAi);

    setBoard(boardAfterAi);
    setActiveNodeId(path[path.length - 1] || root.id);
    setIsAnimating(false);

    if (result) {
      setStatus(`Resultado final: ${statusFromResult(result)}.`);
    } else {
      setStatus(`IA jogou na casa ${aiMove + 1}. Sua vez.`);
    }
  }

  // Trata a jogada humana, valida fim de jogo e dispara a resposta da IA.
  function handlePlay(index) {
    if (board[index] || isAnimating || getWinner(board)) {
      return;
    }

    const nextBoard = cloneBoard(board);
    nextBoard[index] = HUMAN;
    setBoard(nextBoard);

    const result = getWinner(nextBoard);
    if (result) {
      setTree(null);
      setWinnerPathIds([]);
      setResolvedNodeIds([]);
      setActiveNodeId(null);
      setStatus(`Resultado final: ${statusFromResult(result)}.`);
      return;
    }

    runAiTurn(nextBoard);
  }

  // Reinicia completamente a simulacao, inclusive animacao em andamento.
  function handleReset() {
    animationTokenRef.current += 1;
    globalNodeId = 0;
    setBoard(createEmptyBoard());
    setTree(null);
    setWinnerPathIds([]);
    setResolvedNodeIds([]);
    setActiveNodeId(null);
    setStatus("Sua vez. Clique em uma casa para iniciar.");
    setIsAnimating(false);
  }

  const result = getWinner(board);

  return React.createElement(
    "main",
    { className: "app-shell" },
    React.createElement("div", { className: "grid-glow" }),
    React.createElement(
      "section",
      { className: "hero-card" },
      React.createElement(
        "div",
        { className: "hero-copy" },
        React.createElement("p", { className: "eyebrow" }, "Teoria dos Jogos + React + Minimax"),
        React.createElement("h1", null, "Minimax"),
        React.createElement(
          "p",
          { className: "hero-text" },
          "Jogue contra a IA e acompanhe, em tempo real, a arvore de decisao do algoritmo Minimax com nos MAX e MIN, utilidades terminais e o caminho escolhido pela maquina."
        )
      ),
      React.createElement(
        "div",
        { className: "control-card" },
        React.createElement("span", { className: "control-label" }, "Velocidade da busca"),
        React.createElement("input", {
          type: "range",
          min: "60",
          max: "700",
          step: "20",
          value: speed,
          onChange: (event) => setSpeed(Number(event.target.value)),
        }),
        React.createElement(
          "div",
          { className: "speed-row" },
          React.createElement("span", null, "Rapida"),
          React.createElement("strong", null, `${speed} ms`),
          React.createElement("span", null, "Lenta")
        )
      )
    ),
    React.createElement(
      "section",
      { className: "content-layout" },
      React.createElement(
        "div",
        { className: "game-card" },
        React.createElement("div", { className: "panel-tag" }, "Arena"),
        React.createElement("h2", null, "Jogo da Velha"),
        React.createElement("p", { className: `status ${result ? "final" : ""}` }, status),
        React.createElement(Board, {
          board,
          onPlay: handlePlay,
          disabled: isAnimating || Boolean(result),
        }),
        React.createElement(
          "div",
          { className: "board-actions" },
          React.createElement(
            "button",
            { className: "secondary-btn", onClick: handleReset },
            "Reiniciar simulacao"
          )
        )
      ),
      React.createElement(
        "div",
        { className: "tree-card" },
        React.createElement("div", { className: "panel-tag" }, "Visualizacao"),
        React.createElement("h2", null, "Arvore Minimax"),
        React.createElement(
          "p",
          { className: "tree-description" },
          "Nos MAX representam a IA, nos MIN representam o humano. As folhas carregam utilidade terminal: +1 para vitoria da IA, -1 para derrota e 0 para empate. Em jogadas iniciais, ramos profundos sao comprimidos para manter a leitura da arvore."
        ),
        React.createElement(TreeLegend),
        React.createElement(TreeView, {
          tree,
          activeNodeId,
          resolvedNodeIds,
          winnerPathIds,
        })
      )
    )
  );
}

createRoot(document.getElementById("root")).render(React.createElement(App));
