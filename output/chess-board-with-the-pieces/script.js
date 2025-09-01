let draggedPiece = null;

// Create 8x8 board with all chess pieces
const board = document.getElementById('chessBoard');

// Clear any existing content
board.innerHTML = '';

// Chess piece setup
const pieces = [
    // Black pieces
    [
        { symbol: '♜', color: 'black', type: 'rook' },
        { symbol: '♞', color: 'black', type: 'knight' },
        { symbol: '♝', color: 'black', type: 'bishop' },
        { symbol: '♛', color: 'black', type: 'queen' },
        { symbol: '♚', color: 'black', type: 'king' },
        { symbol: '♝', color: 'black', type: 'bishop' },
        { symbol: '♞', color: 'black', type: 'knight' },
        { symbol: '♜', color: 'black', type: 'rook' }
    ],
    Array(8).fill({ symbol: '♟', color: 'black', type: 'pawn' }),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill({ symbol: '♙', color: 'white', type: 'pawn' }),
    [
        { symbol: '♖', color: 'white', type: 'rook' },
        { symbol: '♘', color: 'white', type: 'knight' },
        { symbol: '♗', color: 'white', type: 'bishop' },
        { symbol: '♕', color: 'white', type: 'queen' },
        { symbol: '♔', color: 'white', type: 'king' },
        { symbol: '♗', color: 'white', type: 'bishop' },
        { symbol: '♘', color: 'white', type: 'knight' },
        { symbol: '♖', color: 'white', type: 'rook' }
    ]
];

// Create board and pieces - EXACT same approach as debug-simple
for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
        const square = document.createElement('div');
        square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
        board.appendChild(square);
        
        // Add piece if one exists at this position
        const piece = pieces[row][col];
        if (piece) {
            const pieceElement = document.createElement('div');
            pieceElement.className = `piece ${piece.color}`;
            pieceElement.textContent = piece.symbol;
            pieceElement.draggable = true;
            square.appendChild(pieceElement);
        }
    }
}

// EXACT same drag handlers as debug-simple that work perfectly
document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('piece')) {
        draggedPiece = e.target;
        e.target.classList.add('dragging');
        console.log('Drag started');
    }
});

document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('piece')) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.square').forEach(s => s.classList.remove('drag-over'));
        draggedPiece = null;
        console.log('Drag ended');
    }
});

document.addEventListener('dragover', (e) => {
    if (e.target.classList.contains('square')) {
        e.preventDefault();
    }
});

document.addEventListener('dragenter', (e) => {
    if (e.target.classList.contains('square') && draggedPiece) {
        e.target.classList.add('drag-over');
    }
});

document.addEventListener('dragleave', (e) => {
    if (e.target.classList.contains('square')) {
        e.target.classList.remove('drag-over');
    }
});

document.addEventListener('drop', (e) => {
    if (e.target.classList.contains('square') && draggedPiece) {
        e.preventDefault();
        e.target.classList.remove('drag-over');
        
        const existingPiece = e.target.querySelector('.piece');
        if (existingPiece) {
            existingPiece.remove();
        }
        
        e.target.appendChild(draggedPiece);
        console.log('Piece moved');
    }
});