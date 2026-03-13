/* ===================================================================
   BLACKJACK ROYAL - Complete Game Engine
   =================================================================== */

$(document).ready(function () {

    // ---------------------------------------------------------------
    // CONFIG & STATE
    // ---------------------------------------------------------------
    const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    const FACE_ART = {
        J: '🃏', Q: '👑', K: '♚'
    };

    let config = {
        numDecks: 6,
        speed: 'normal',
        sound: true
    };

    const speedMap = { fast: 200, normal: 400, slow: 700 };

    let state = {
        shoe: [],
        balance: 1000,
        mainBet: 0,
        sideBet21Plus3: 0,
        sideBetPairs: 0,
        insuranceBet: 0,
        insuranceTaken: false,
        dealerCards: [],
        dealerHidden: true,
        playerHands: [[]],      // Array of hands (for split)
        playerBets: [],         // Bet per hand
        activeHandIndex: 0,
        gamePhase: 'betting',   // betting | playing | dealerTurn | roundEnd
        handsPlayed: 0,
        wins: 0,
        maxBalance: 1000,
        splitCount: 0,
        doubledHands: [],       // track which hands have been doubled
        handResults: [],
    };

    // ---------------------------------------------------------------
    // AUDIO (Web Audio API - simple beeps for feedback)
    // ---------------------------------------------------------------
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function playSound(type) {
        if (!config.sound) return;
        if (!audioCtx) audioCtx = new AudioCtx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.value = 0.08;

        switch (type) {
            case 'chip':
                osc.frequency.value = 800;
                gain.gain.value = 0.05;
                osc.type = 'sine';
                osc.start();
                osc.stop(audioCtx.currentTime + 0.05);
                break;
            case 'card':
                osc.frequency.value = 300;
                osc.type = 'triangle';
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.15);
                break;
            case 'win':
                osc.frequency.value = 523;
                osc.type = 'sine';
                osc.start();
                setTimeout(() => { osc.frequency.value = 659; }, 100);
                setTimeout(() => { osc.frequency.value = 784; }, 200);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
                osc.stop(audioCtx.currentTime + 0.5);
                break;
            case 'lose':
                osc.frequency.value = 200;
                osc.type = 'sawtooth';
                gain.gain.value = 0.04;
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.3);
                break;
            case 'blackjack':
                osc.frequency.value = 440;
                osc.type = 'sine';
                gain.gain.value = 0.1;
                osc.start();
                setTimeout(() => { osc.frequency.value = 554; }, 80);
                setTimeout(() => { osc.frequency.value = 659; }, 160);
                setTimeout(() => { osc.frequency.value = 880; }, 240);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
                osc.stop(audioCtx.currentTime + 0.6);
                break;
        }
    }

    // ---------------------------------------------------------------
    // PARTICLES
    // ---------------------------------------------------------------
    function initParticles() {
        const container = $('#particles');
        for (let i = 0; i < 25; i++) {
            const size = Math.random() * 3 + 1;
            const $p = $('<div class="particle"></div>').css({
                width: size, height: size,
                left: Math.random() * 100 + '%',
                animationDuration: (Math.random() * 15 + 10) + 's',
                animationDelay: (Math.random() * 10) + 's'
            });
            container.append($p);
        }
    }

    // ---------------------------------------------------------------
    // SHOE / DECK MANAGEMENT
    // ---------------------------------------------------------------
    function createShoe() {
        state.shoe = [];
        for (let d = 0; d < config.numDecks; d++) {
            for (const suit of SUITS) {
                for (const rank of RANKS) {
                    state.shoe.push({ suit, rank });
                }
            }
        }
        shuffleShoe();
    }

    function shuffleShoe() {
        for (let i = state.shoe.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.shoe[i], state.shoe[j]] = [state.shoe[j], state.shoe[i]];
        }
    }

    function drawCard() {
        if (state.shoe.length < 20) createShoe();
        return state.shoe.pop();
    }

    // ---------------------------------------------------------------
    // HAND VALUE CALCULATION
    // ---------------------------------------------------------------
    function cardValue(card) {
        if (['J', 'Q', 'K'].includes(card.rank)) return 10;
        if (card.rank === 'A') return 11;
        return parseInt(card.rank);
    }

    function handValue(cards) {
        let total = 0;
        let aces = 0;
        for (const c of cards) {
            total += cardValue(c);
            if (c.rank === 'A') aces++;
        }
        while (total > 21 && aces > 0) {
            total -= 10;
            aces--;
        }
        return total;
    }

    function isSoft(cards) {
        let total = 0;
        let aces = 0;
        for (const c of cards) {
            total += cardValue(c);
            if (c.rank === 'A') aces++;
        }
        while (total > 21 && aces > 1) {
            total -= 10;
            aces--;
        }
        return aces > 0 && total <= 21;
    }

    function isBlackjack(cards) {
        return cards.length === 2 && handValue(cards) === 21;
    }

    function isBust(cards) {
        return handValue(cards) > 21;
    }

    // ---------------------------------------------------------------
    // CARD HTML GENERATION (Pure CSS/SVG cards)
    // ---------------------------------------------------------------
    function createCardHTML(card, faceDown = false) {
        const sym = SUIT_SYMBOLS[card.suit];
        const isFace = ['J', 'Q', 'K'].includes(card.rank);

        let centerContent;
        if (isFace) {
            const faceSymbols = { J: '♞', Q: '♛', K: '♚' };
            centerContent = `
                <div class="card-face-art">
                    <span class="face-crown">${card.rank === 'K' ? '👑' : card.rank === 'Q' ? '♛' : ''}</span>
                    <span>${faceSymbols[card.rank]}</span>
                    <span style="font-size:10px">${sym}</span>
                </div>`;
        } else if (card.rank === 'A') {
            centerContent = `<span style="font-size:42px;opacity:0.8">${sym}</span>`;
        } else {
            centerContent = buildPips(card.rank, sym);
        }

        return `
        <div class="card-wrapper${faceDown ? '' : ''}" data-suit="${card.suit}" data-rank="${card.rank}">
            <div class="card ${faceDown ? '' : 'flipped'}">
                <div class="card-face card-back">
                    <div class="card-back-pattern"></div>
                </div>
                <div class="card-face card-front">
                    <div class="card-corner card-corner-top">
                        <span class="card-rank">${card.rank}</span>
                        <span class="card-suit-small">${sym}</span>
                    </div>
                    <div class="card-center">${centerContent}</div>
                    <div class="card-corner card-corner-bottom">
                        <span class="card-rank">${card.rank}</span>
                        <span class="card-suit-small">${sym}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    function buildPips(rank, sym) {
        const n = parseInt(rank);
        if (isNaN(n)) return `<span>${sym}</span>`;

        // Simple pip layout using CSS grid
        const positions = getPipPositions(n);
        let html = '<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(5,1fr);width:100%;height:100%;align-items:center;justify-items:center;font-size:14px;line-height:1;">';
        for (const pos of positions) {
            html += `<span style="grid-column:${pos[0]};grid-row:${pos[1]};font-size:${n > 6 ? '12px' : '14px'}">${sym}</span>`;
        }
        html += '</div>';
        return html;
    }

    function getPipPositions(n) {
        const layouts = {
            2: [[1,1],[2,5]],
            3: [[1,1],[1,3],[2,5]],
            4: [[1,1],[2,1],[1,5],[2,5]],
            5: [[1,1],[2,1],[1,5],[2,5],[1,3]],
            6: [[1,1],[2,1],[1,3],[2,3],[1,5],[2,5]],
            7: [[1,1],[2,1],[1,3],[2,3],[1,5],[2,5],[1,2]],
            8: [[1,1],[2,1],[1,3],[2,3],[1,5],[2,5],[1,2],[2,4]],
            9: [[1,1],[2,1],[1,2],[2,2],[1,3],[2,4],[1,5],[2,5],[2,3]],
            10: [[1,1],[2,1],[1,2],[2,2],[1,4],[2,4],[1,5],[2,5],[1,3],[2,3]]
        };
        return layouts[n] || [[1,3]];
    }

    // ---------------------------------------------------------------
    // RENDER
    // ---------------------------------------------------------------
    function renderDealerCards() {
        const $row = $('#dealer-cards');
        $row.empty();
        state.dealerCards.forEach((card, i) => {
            const faceDown = (i === 1 && state.dealerHidden);
            const html = createCardHTML(card, faceDown);
            $row.append(html);
        });
        updateDealerScore();
    }

    function renderPlayerCards(handIdx) {
        const $row = $(`#player-cards-${handIdx}`);
        if (!$row.length) return;
        $row.empty();
        state.playerHands[handIdx].forEach(card => {
            $row.append(createCardHTML(card));
        });
        updatePlayerScore(handIdx);
    }

    function updateDealerScore() {
        const $score = $('#dealer-score');
        if (state.dealerCards.length === 0) {
            $score.text('');
            return;
        }
        if (state.dealerHidden) {
            const visibleCard = state.dealerCards[0];
            $score.text(cardValue(visibleCard));
        } else {
            const val = handValue(state.dealerCards);
            if (isBlackjack(state.dealerCards)) {
                $score.text('BJ!');
            } else {
                $score.text(val);
            }
        }
    }

    function updatePlayerScore(handIdx) {
        const $score = $(`#player-score-${handIdx}`);
        if (!$score.length) return;
        const cards = state.playerHands[handIdx];
        if (!cards || cards.length === 0) {
            $score.text('');
            return;
        }
        const val = handValue(cards);
        if (isBlackjack(cards) && state.splitCount === 0) {
            $score.text('BJ!');
        } else if (val > 21) {
            $score.text(val + ' 💥');
        } else if (isSoft(cards)) {
            $score.text(val + ' (soft)');
        } else {
            $score.text(val);
        }
    }

    function updateBalance() {
        $('#balance').text(state.balance);
        if (state.balance > state.maxBalance) {
            state.maxBalance = state.balance;
            $('#max-balance').text(state.maxBalance);
        }
    }

    function updateBetDisplay() {
        $('#current-bet').text(state.mainBet);
        $('#bet-21-3-amount').text(state.sideBet21Plus3);
        $('#bet-pairs-amount').text(state.sideBetPairs);

        // Toggle active class on side bet boxes
        $('#bet-21-3').toggleClass('active', state.sideBet21Plus3 > 0);
        $('#bet-pairs').toggleClass('active', state.sideBetPairs > 0);

        // Enable/disable deal button
        $('#btn-deal').prop('disabled', state.mainBet === 0);
    }

    function updateStats() {
        $('#hands-played').text(state.handsPlayed);
        $('#wins-count').text(state.wins);
    }

    // ---------------------------------------------------------------
    // DEALER SPEECH
    // ---------------------------------------------------------------
    const dealerPhrases = {
        welcome: ['Bienvenue à la table !', 'Placez vos mises !', 'Bonne chance !'],
        deal: ['Les cartes sont distribuées.', 'Voyons ce que le destin réserve.', 'À vous de jouer.'],
        hit: ['Une carte de plus ?', 'Carte tirée !', 'Voyons voir...'],
        bust: ['Trop haut !', 'Dommage, c\'est plus de 21.', 'Bust !'],
        playerBJ: ['Blackjack ! Magnifique !', 'Blackjack ! 🎉', '21 naturel !'],
        dealerBJ: ['Blackjack du croupier !', 'Je suis désolé, blackjack.'],
        dealerBust: ['Le croupier saute !', 'Plus de 21 pour moi.', 'Vous gagnez !'],
        win: ['Bien joué !', 'Bravo !', 'La chance est avec vous.'],
        lose: ['La maison gagne.', 'Pas cette fois.', 'Retentez votre chance.'],
        push: ['Égalité.', 'Match nul.', 'Les mises sont rendues.'],
        insurance: ['Assurance offerte.', 'Un As visible, assurance ?'],
        split: ['Vous séparez !', 'Deux mains en jeu.']
    };

    function dealerSay(category) {
        const phrases = dealerPhrases[category];
        if (!phrases) return;
        const text = phrases[Math.floor(Math.random() * phrases.length)];
        const $speech = $('#dealer-speech');
        const $text = $('#dealer-text');
        $text.text(text);
        $speech.removeClass('hidden');

        // Animate mouth
        const mouth = document.getElementById('dealer-mouth');
        if (mouth) {
            mouth.setAttribute('d', 'M50,66 Q60,76 70,66');
            setTimeout(() => mouth.setAttribute('d', 'M50,68 Q60,74 70,68'), 500);
        }

        clearTimeout(state._speechTimeout);
        state._speechTimeout = setTimeout(() => $speech.addClass('hidden'), 3000);
    }

    // ---------------------------------------------------------------
    // ANIMATIONS HELPERS
    // ---------------------------------------------------------------
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms * (speedMap[config.speed] / 400)));
    }

    async function animateDealCard($container, card, faceDown = false) {
        const html = createCardHTML(card, faceDown);
        const $card = $(html).addClass('dealing');
        $container.append($card);
        playSound('card');
        await delay(350);
        $card.removeClass('dealing');
    }

    function flipCard($wrapper) {
        $wrapper.find('.card').addClass('flipped');
    }

    function showConfetti() {
        const colors = ['#c8a45c', '#e8cc7a', '#2ecc71', '#e74c3c', '#3498db', '#9b59b6', '#f1c40f'];
        for (let i = 0; i < 50; i++) {
            const $c = $('<div class="confetti"></div>').css({
                left: Math.random() * 100 + 'vw',
                top: -10,
                width: Math.random() * 8 + 4,
                height: Math.random() * 8 + 4,
                background: colors[Math.floor(Math.random() * colors.length)],
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                animationDuration: (Math.random() * 2 + 1.5) + 's',
                animationDelay: (Math.random() * 0.5) + 's'
            });
            $('body').append($c);
        }
        setTimeout(() => $('.confetti').remove(), 4000);
    }

    function showWinAmount(amount, isLoss = false) {
        const prefix = isLoss ? '-' : '+';
        const $popup = $(`<div class="win-amount-popup ${isLoss ? 'loss' : ''}">${prefix}${Math.abs(amount)}€</div>`);
        $('body').append($popup);
        setTimeout(() => $popup.remove(), 1500);
    }

    function showGameMessage(text, cssClass = '') {
        const $msg = $('#game-message');
        $msg.text(text).removeClass('hidden win lose push blackjack').addClass(cssClass);
        $msg.css('animation', 'none');
        $msg[0].offsetHeight; // reflow
        $msg.css('animation', '');
    }

    function hideGameMessage() {
        $('#game-message').addClass('hidden');
    }

    // ---------------------------------------------------------------
    // BETTING PHASE
    // ---------------------------------------------------------------
    function setupBettingPhase() {
        state.gamePhase = 'betting';
        state.mainBet = 0;
        state.sideBet21Plus3 = 0;
        state.sideBetPairs = 0;
        state.insuranceBet = 0;
        state.insuranceTaken = false;
        state.dealerCards = [];
        state.dealerHidden = true;
        state.playerHands = [[]];
        state.playerBets = [];
        state.activeHandIndex = 0;
        state.splitCount = 0;
        state.doubledHands = [];
        state.handResults = [];

        // Reset UI
        hideGameMessage();
        $('#dealer-cards').empty();
        $('#dealer-score').text('');
        resetPlayerHandsUI();
        updateBetDisplay();
        updateBalance();

        // Show betting, hide actions
        $('#betting-area').removeClass('hidden');
        $('#action-buttons').addClass('hidden');
        $('#new-round-area').addClass('hidden');
        $('#side-bets-display').addClass('hidden');
        $('#side-bets-section').removeClass('hidden');

        // Enable betting controls
        $('.chip, .side-bet-btn, #btn-clear-bet').prop('disabled', false);

        dealerSay('welcome');
    }

    function resetPlayerHandsUI() {
        const $container = $('#player-hands-container');
        $container.html(`
            <div class="player-hand" data-hand="0">
                <div id="player-info-0" class="player-info">
                    <span class="label">JOUEUR</span>
                    <span class="score" id="player-score-0"></span>
                </div>
                <div id="player-cards-0" class="card-row"></div>
            </div>
        `);
    }

    // Chip click
    $(document).on('click', '.chip', function () {
        if (state.gamePhase !== 'betting') return;
        const value = parseInt($(this).data('value'));
        if (state.balance >= value) {
            state.mainBet += value;
            state.balance -= value;
            playSound('chip');
            updateBetDisplay();
            updateBalance();

            // Highlight selected chip
            $('.chip').removeClass('selected');
            $(this).addClass('selected');
        }
    });

    // Clear bet
    $('#btn-clear-bet').on('click', function () {
        state.balance += state.mainBet + state.sideBet21Plus3 + state.sideBetPairs;
        state.mainBet = 0;
        state.sideBet21Plus3 = 0;
        state.sideBetPairs = 0;
        updateBetDisplay();
        updateBalance();
    });

    // Side bet controls
    $(document).on('click', '.side-bet-btn', function () {
        if (state.gamePhase !== 'betting') return;
        const betType = $(this).data('bet');
        const action = $(this).data('action');
        const increment = 5;

        if (betType === '21+3') {
            if (action === 'plus' && state.balance >= increment) {
                state.sideBet21Plus3 += increment;
                state.balance -= increment;
                playSound('chip');
            } else if (action === 'minus' && state.sideBet21Plus3 >= increment) {
                state.sideBet21Plus3 -= increment;
                state.balance += increment;
            }
        } else if (betType === 'pairs') {
            if (action === 'plus' && state.balance >= increment) {
                state.sideBetPairs += increment;
                state.balance -= increment;
                playSound('chip');
            } else if (action === 'minus' && state.sideBetPairs >= increment) {
                state.sideBetPairs -= increment;
                state.balance += increment;
            }
        }
        updateBetDisplay();
        updateBalance();
    });

    // ---------------------------------------------------------------
    // DEAL
    // ---------------------------------------------------------------
    $('#btn-deal').on('click', async function () {
        if (state.mainBet === 0 || state.gamePhase !== 'betting') return;
        await startRound();
    });

    async function startRound() {
        state.gamePhase = 'dealing';
        state.playerBets = [state.mainBet];

        // Disable betting controls
        $('.chip, .side-bet-btn, #btn-clear-bet, #btn-deal').prop('disabled', true);
        $('#side-bets-section').addClass('hidden');

        dealerSay('deal');

        // Create shoe if needed
        if (state.shoe.length < 20) createShoe();

        // Deal: player, dealer, player, dealer
        const p1 = drawCard();
        const d1 = drawCard();
        const p2 = drawCard();
        const d2 = drawCard();

        state.playerHands[0] = [p1];
        state.dealerCards = [d1];

        await animateDealCard($('#player-cards-0'), p1);
        updatePlayerScore(0);

        state.dealerCards = [d1];
        await animateDealCard($('#dealer-cards'), d1);
        updateDealerScore();

        state.playerHands[0].push(p2);
        await animateDealCard($('#player-cards-0'), p2);
        updatePlayerScore(0);

        state.dealerCards.push(d2);
        await animateDealCard($('#dealer-cards'), d2, true); // face down
        updateDealerScore();

        // Evaluate side bets immediately
        evaluateSideBets(p1, p2, d1);

        // Check for blackjack scenarios
        const playerBJ = isBlackjack(state.playerHands[0]);
        const dealerShowsAce = state.dealerCards[0].rank === 'A';
        const dealerBJ = isBlackjack(state.dealerCards);

        // Insurance offer if dealer shows Ace
        if (dealerShowsAce && !playerBJ) {
            await offerInsurance();
        }

        // Player has blackjack
        if (playerBJ) {
            playSound('blackjack');
            dealerSay('playerBJ');

            // Reveal dealer card
            state.dealerHidden = false;
            await delay(300);
            revealDealerHoleCard();

            if (dealerBJ) {
                // Push
                showGameMessage('PUSH - Blackjack partout !', 'push');
                dealerSay('push');
                state.balance += state.mainBet;
                showWinAmount(0);
            } else {
                // Player wins 3:2
                const winnings = Math.floor(state.mainBet * 2.5);
                state.balance += winnings;
                showGameMessage('BLACKJACK !', 'blackjack');
                showWinAmount(winnings - state.mainBet);
                showConfetti();
                state.wins++;
            }
            endRound();
            return;
        }

        // Dealer has blackjack (no player BJ)
        if (dealerBJ) {
            state.dealerHidden = false;
            await delay(300);
            revealDealerHoleCard();

            playSound('lose');
            dealerSay('dealerBJ');
            showGameMessage('Blackjack du croupier !', 'lose');
            showWinAmount(state.mainBet, true);

            // Insurance payout
            if (state.insuranceTaken) {
                const insuranceWin = state.insuranceBet * 3; // 2:1 + original
                state.balance += insuranceWin;
                showWinAmount(insuranceWin);
            }

            endRound();
            return;
        }

        // Insurance lost if taken and dealer doesn't have BJ
        if (state.insuranceTaken && !dealerBJ) {
            // Insurance bet already deducted, no return
        }

        // Normal play
        state.gamePhase = 'playing';
        showActionButtons();
    }

    function revealDealerHoleCard() {
        const $cards = $('#dealer-cards .card-wrapper');
        if ($cards.length >= 2) {
            const $holeCard = $cards.eq(1);
            $holeCard.find('.card').addClass('flipped');
            // Update suit/rank data attributes
            const card = state.dealerCards[1];
            $holeCard.attr('data-suit', card.suit).attr('data-rank', card.rank);

            // Rebuild the front face content
            const sym = SUIT_SYMBOLS[card.suit];
            const isFace = ['J', 'Q', 'K'].includes(card.rank);
            let centerContent;
            if (isFace) {
                const faceSymbols = { J: '♞', Q: '♛', K: '♚' };
                centerContent = `<div class="card-face-art"><span class="face-crown">${card.rank === 'K' ? '👑' : card.rank === 'Q' ? '♛' : ''}</span><span>${faceSymbols[card.rank]}</span><span style="font-size:10px">${sym}</span></div>`;
            } else if (card.rank === 'A') {
                centerContent = `<span style="font-size:42px;opacity:0.8">${sym}</span>`;
            } else {
                centerContent = buildPips(card.rank, sym);
            }

            const $front = $holeCard.find('.card-front');
            $front.html(`
                <div class="card-corner card-corner-top">
                    <span class="card-rank">${card.rank}</span>
                    <span class="card-suit-small">${sym}</span>
                </div>
                <div class="card-center">${centerContent}</div>
                <div class="card-corner card-corner-bottom">
                    <span class="card-rank">${card.rank}</span>
                    <span class="card-suit-small">${sym}</span>
                </div>
            `);

            // Apply color
            if (card.suit === 'hearts' || card.suit === 'diamonds') {
                $front.css('color', '#c0392b');
            } else {
                $front.css('color', '#1a1a2e');
            }
        }
        updateDealerScore();
    }

    // ---------------------------------------------------------------
    // INSURANCE
    // ---------------------------------------------------------------
    function offerInsurance() {
        return new Promise(resolve => {
            const cost = Math.floor(state.mainBet / 2);
            if (state.balance < cost) {
                resolve();
                return;
            }
            $('#insurance-cost-value').text(cost);
            $('#insurance-modal').removeClass('hidden');
            dealerSay('insurance');

            $('#btn-take-insurance').off('click').on('click', function () {
                state.insuranceTaken = true;
                state.insuranceBet = cost;
                state.balance -= cost;
                updateBalance();
                $('#insurance-modal').addClass('hidden');
                resolve();
            });

            $('#btn-decline-insurance').off('click').on('click', function () {
                state.insuranceTaken = false;
                $('#insurance-modal').addClass('hidden');
                resolve();
            });
        });
    }

    // ---------------------------------------------------------------
    // SIDE BETS EVALUATION
    // ---------------------------------------------------------------
    function evaluateSideBets(playerCard1, playerCard2, dealerUpCard) {
        if (state.sideBet21Plus3 === 0 && state.sideBetPairs === 0) return;

        const $display = $('#side-bets-display').removeClass('hidden');

        // --- PAIRS ---
        if (state.sideBetPairs > 0) {
            const $pairsResult = $('#pairs-result');
            if (playerCard1.rank === playerCard2.rank) {
                if (playerCard1.suit === playerCard2.suit) {
                    // Perfect pair (same rank & suit) - 25:1
                    const win = state.sideBetPairs * 26;
                    state.balance += win;
                    $pairsResult.text(`PAIRS: Paire Parfaite ! +${win}€ (25:1)`).removeClass('lose').addClass('win');
                    playSound('win');
                } else if (
                    (SUITS.indexOf(playerCard1.suit) < 2 && SUITS.indexOf(playerCard2.suit) < 2) ||
                    (SUITS.indexOf(playerCard1.suit) >= 2 && SUITS.indexOf(playerCard2.suit) >= 2)
                ) {
                    // Coloured pair (same color) - 12:1
                    const win = state.sideBetPairs * 13;
                    state.balance += win;
                    $pairsResult.text(`PAIRS: Paire Couleur ! +${win}€ (12:1)`).removeClass('lose').addClass('win');
                    playSound('win');
                } else {
                    // Mixed pair - 6:1
                    const win = state.sideBetPairs * 7;
                    state.balance += win;
                    $pairsResult.text(`PAIRS: Paire Mixte ! +${win}€ (6:1)`).removeClass('lose').addClass('win');
                    playSound('win');
                }
            } else {
                $pairsResult.text(`PAIRS: Pas de paire`).removeClass('win').addClass('lose');
            }
        }

        // --- 21+3 ---
        if (state.sideBet21Plus3 > 0) {
            const $result = $('#twentyone-plus-three-result');
            const threeCards = [playerCard1, playerCard2, dealerUpCard];
            const ranks = threeCards.map(c => c.rank);
            const suits = threeCards.map(c => c.suit);
            const values = threeCards.map(c => {
                if (c.rank === 'A') return 1;
                if (['J', 'Q', 'K'].includes(c.rank)) return [11, 12, 13][['J', 'Q', 'K'].indexOf(c.rank)];
                return parseInt(c.rank);
            }).sort((a, b) => a - b);

            const allSameSuit = suits[0] === suits[1] && suits[1] === suits[2];
            const allSameRank = ranks[0] === ranks[1] && ranks[1] === ranks[2];
            const isStraight = (values[2] - values[1] === 1 && values[1] - values[0] === 1) ||
                               (values[0] === 1 && values[1] === 12 && values[2] === 13); // A-Q-K

            if (allSameRank && allSameSuit) {
                // Suited trips - 100:1
                const win = state.sideBet21Plus3 * 101;
                state.balance += win;
                $result.text(`21+3: Brelan Assorti ! +${win}€ (100:1)`).removeClass('lose').addClass('win');
                showConfetti();
            } else if (isStraight && allSameSuit) {
                // Straight flush - 40:1
                const win = state.sideBet21Plus3 * 41;
                state.balance += win;
                $result.text(`21+3: Quinte Flush ! +${win}€ (40:1)`).removeClass('lose').addClass('win');
                showConfetti();
            } else if (allSameRank) {
                // Three of a kind - 30:1
                const win = state.sideBet21Plus3 * 31;
                state.balance += win;
                $result.text(`21+3: Brelan ! +${win}€ (30:1)`).removeClass('lose').addClass('win');
                playSound('win');
            } else if (isStraight) {
                // Straight - 10:1
                const win = state.sideBet21Plus3 * 11;
                state.balance += win;
                $result.text(`21+3: Suite ! +${win}€ (10:1)`).removeClass('lose').addClass('win');
                playSound('win');
            } else if (allSameSuit) {
                // Flush - 5:1
                const win = state.sideBet21Plus3 * 6;
                state.balance += win;
                $result.text(`21+3: Couleur ! +${win}€ (5:1)`).removeClass('lose').addClass('win');
                playSound('win');
            } else {
                $result.text(`21+3: Rien`).removeClass('win').addClass('lose');
            }
        }

        updateBalance();
    }

    // ---------------------------------------------------------------
    // PLAYER ACTIONS
    // ---------------------------------------------------------------
    function showActionButtons() {
        $('#betting-area').addClass('hidden');
        const $actions = $('#action-buttons').removeClass('hidden');
        $('#new-round-area').addClass('hidden');

        const hand = state.playerHands[state.activeHandIndex];
        const bet = state.playerBets[state.activeHandIndex] || state.mainBet;

        // Double: only if 2 cards and enough balance
        const canDouble = hand.length === 2 && state.balance >= bet;
        $('#btn-double').toggle(canDouble).prop('disabled', !canDouble);

        // Split: only if 2 cards of same value, max 3 splits, and enough balance
        const canSplit = hand.length === 2 &&
            cardValue(hand[0]) === cardValue(hand[1]) &&
            state.splitCount < 3 &&
            state.balance >= bet;
        $('#btn-split').toggleClass('hidden', !canSplit);

        // Insurance button is handled separately
        $('#btn-insurance').addClass('hidden');
    }

    // HIT
    $('#btn-hit').on('click', async function () {
        if (state.gamePhase !== 'playing') return;
        await playerHit();
    });

    async function playerHit() {
        const idx = state.activeHandIndex;
        const card = drawCard();
        state.playerHands[idx].push(card);

        await animateDealCard($(`#player-cards-${idx}`), card);
        updatePlayerScore(idx);
        playSound('card');
        dealerSay('hit');

        if (isBust(state.playerHands[idx])) {
            // Bust
            playSound('lose');
            dealerSay('bust');
            $(`#player-cards-${idx} .card-wrapper`).last().addClass('bust-shake');
            state.handResults[idx] = 'bust';
            await delay(500);
            await moveToNextHand();
        } else if (handValue(state.playerHands[idx]) === 21) {
            // Auto-stand on 21
            await playerStand();
        } else {
            showActionButtons();
        }
    }

    // STAND
    $('#btn-stand').on('click', async function () {
        if (state.gamePhase !== 'playing') return;
        await playerStand();
    });

    async function playerStand() {
        state.handResults[state.activeHandIndex] = 'stand';
        await moveToNextHand();
    }

    // DOUBLE DOWN
    $('#btn-double').on('click', async function () {
        if (state.gamePhase !== 'playing') return;
        await playerDouble();
    });

    async function playerDouble() {
        const idx = state.activeHandIndex;
        const bet = state.playerBets[idx];

        if (state.balance < bet) return;

        state.balance -= bet;
        state.playerBets[idx] = bet * 2;
        state.doubledHands.push(idx);
        updateBalance();

        // Draw exactly one card then stand
        const card = drawCard();
        state.playerHands[idx].push(card);
        await animateDealCard($(`#player-cards-${idx}`), card);
        updatePlayerScore(idx);

        if (isBust(state.playerHands[idx])) {
            playSound('lose');
            dealerSay('bust');
            $(`#player-cards-${idx} .card-wrapper`).last().addClass('bust-shake');
            state.handResults[idx] = 'bust';
        } else {
            state.handResults[idx] = 'stand';
        }

        await delay(400);
        await moveToNextHand();
    }

    // SPLIT
    $('#btn-split').on('click', async function () {
        if (state.gamePhase !== 'playing') return;
        await playerSplit();
    });

    async function playerSplit() {
        const idx = state.activeHandIndex;
        const hand = state.playerHands[idx];

        if (hand.length !== 2 || cardValue(hand[0]) !== cardValue(hand[1])) return;
        if (state.balance < state.playerBets[idx]) return;

        state.splitCount++;
        dealerSay('split');

        // Take second card from current hand
        const splitCard = hand.pop();
        const newHandIdx = state.playerHands.length;

        // Create new hand
        state.playerHands.push([splitCard]);
        state.playerBets.push(state.playerBets[idx]);
        state.balance -= state.playerBets[idx];
        state.handResults.push(null);
        updateBalance();

        // Create new hand UI
        const $container = $('#player-hands-container');
        $container.append(`
            <div class="player-hand" data-hand="${newHandIdx}">
                <div id="player-info-${newHandIdx}" class="player-info">
                    <span class="label">MAIN ${newHandIdx + 1}</span>
                    <span class="score" id="player-score-${newHandIdx}"></span>
                </div>
                <div id="player-cards-${newHandIdx}" class="card-row"></div>
            </div>
        `);

        // Update label for first hand
        $(`#player-info-${idx} .label`).text(`MAIN ${idx + 1}`);

        // Render current hands
        renderPlayerCards(idx);
        renderPlayerCards(newHandIdx);

        // Deal one card to each hand
        const card1 = drawCard();
        state.playerHands[idx].push(card1);
        await animateDealCard($(`#player-cards-${idx}`), card1);
        updatePlayerScore(idx);

        await delay(200);

        const card2 = drawCard();
        state.playerHands[newHandIdx].push(card2);
        await animateDealCard($(`#player-cards-${newHandIdx}`), card2);
        updatePlayerScore(newHandIdx);

        // Highlight active hand
        updateActiveHandHighlight();

        // If aces split, only one card each, then auto-stand
        if (hand[0].rank === 'A') {
            state.handResults[idx] = 'stand';
            state.handResults[newHandIdx] = 'stand';
            await moveToNextHand();
            return;
        }

        showActionButtons();
    }

    async function moveToNextHand() {
        // Find next unresolved hand
        let next = -1;
        for (let i = state.activeHandIndex + 1; i < state.playerHands.length; i++) {
            if (!state.handResults[i]) {
                next = i;
                break;
            }
        }

        if (next >= 0) {
            state.activeHandIndex = next;
            updateActiveHandHighlight();
            showActionButtons();
        } else {
            // All hands resolved
            await dealerTurn();
        }
    }

    function updateActiveHandHighlight() {
        $('.player-hand').removeClass('active-hand');
        $(`.player-hand[data-hand="${state.activeHandIndex}"]`).addClass('active-hand');
    }

    // ---------------------------------------------------------------
    // DEALER TURN
    // ---------------------------------------------------------------
    async function dealerTurn() {
        state.gamePhase = 'dealerTurn';
        $('#action-buttons').addClass('hidden');

        // Check if all player hands busted
        const allBusted = state.handResults.every(r => r === 'bust');
        if (allBusted) {
            state.dealerHidden = false;
            revealDealerHoleCard();
            resolveRound();
            return;
        }

        // Reveal hole card
        state.dealerHidden = false;
        await delay(400);
        revealDealerHoleCard();
        playSound('card');
        await delay(500);

        // Dealer draws (stand on soft 17 rule - dealer stands on all 17s)
        while (handValue(state.dealerCards) < 17) {
            const card = drawCard();
            state.dealerCards.push(card);
            await animateDealCard($('#dealer-cards'), card);
            updateDealerScore();
            await delay(400);
        }

        if (isBust(state.dealerCards)) {
            dealerSay('dealerBust');
        }

        resolveRound();
    }

    // ---------------------------------------------------------------
    // RESOLVE ROUND
    // ---------------------------------------------------------------
    function resolveRound() {
        const dealerVal = handValue(state.dealerCards);
        const dealerBusted = dealerVal > 21;
        let totalWinnings = 0;
        let totalLost = 0;
        let anyWin = false;
        let allPush = true;

        const messages = [];

        for (let i = 0; i < state.playerHands.length; i++) {
            const hand = state.playerHands[i];
            const playerVal = handValue(hand);
            const bet = state.playerBets[i];
            const busted = state.handResults[i] === 'bust';
            const isBJ = isBlackjack(hand) && state.splitCount === 0;

            let result;

            if (busted) {
                result = 'lose';
                totalLost += bet;
            } else if (dealerBusted) {
                result = 'win';
                const winnings = bet * 2;
                state.balance += winnings;
                totalWinnings += winnings - bet;
                anyWin = true;
            } else if (playerVal > dealerVal) {
                result = 'win';
                const winnings = bet * 2;
                state.balance += winnings;
                totalWinnings += winnings - bet;
                anyWin = true;
            } else if (playerVal === dealerVal) {
                result = 'push';
                state.balance += bet;
            } else {
                result = 'lose';
                totalLost += bet;
            }

            if (result !== 'push') allPush = false;

            const handLabel = state.playerHands.length > 1 ? `Main ${i + 1}: ` : '';
            if (result === 'win') messages.push(`${handLabel}Gagné !`);
            else if (result === 'push') messages.push(`${handLabel}Égalité`);
            else messages.push(`${handLabel}Perdu`);
        }

        updateBalance();

        // Determine overall message
        const netResult = totalWinnings - totalLost;
        let messageText;
        let messageClass;

        if (state.playerHands.length > 1) {
            messageText = messages.join(' | ');
            if (netResult > 0) {
                messageClass = 'win';
                playSound('win');
                dealerSay('win');
                state.wins++;
            } else if (netResult === 0 || allPush) {
                messageClass = 'push';
                dealerSay('push');
            } else {
                messageClass = 'lose';
                playSound('lose');
                dealerSay('lose');
            }
        } else {
            if (totalWinnings > 0) {
                messageText = 'VOUS GAGNEZ !';
                messageClass = 'win';
                playSound('win');
                dealerSay('win');
                state.wins++;
                showConfetti();
            } else if (allPush) {
                messageText = 'ÉGALITÉ';
                messageClass = 'push';
                dealerSay('push');
            } else {
                messageText = 'CROUPIER GAGNE';
                messageClass = 'lose';
                playSound('lose');
                dealerSay('lose');
            }
        }

        showGameMessage(messageText, messageClass);

        if (netResult > 0) {
            showWinAmount(netResult);
        } else if (netResult < 0) {
            showWinAmount(netResult, true);
        }

        endRound();
    }

    function endRound() {
        state.gamePhase = 'roundEnd';
        state.handsPlayed++;
        updateStats();

        // Show new round button
        $('#action-buttons').addClass('hidden');
        $('#new-round-area').removeClass('hidden');
        $('#betting-area').addClass('hidden');

        // Check if player is broke
        if (state.balance <= 0) {
            setTimeout(() => {
                showGameMessage('Vous êtes à sec ! Réinitialisation...', 'lose');
                setTimeout(() => {
                    state.balance = 1000;
                    updateBalance();
                    setupBettingPhase();
                }, 2000);
            }, 1500);
        }
    }

    // New round
    $('#btn-new-round').on('click', function () {
        setupBettingPhase();
    });

    // ---------------------------------------------------------------
    // SETTINGS
    // ---------------------------------------------------------------
    $('#settings-btn').on('click', () => $('#settings-modal').removeClass('hidden'));
    $('#btn-close-settings').on('click', () => $('#settings-modal').addClass('hidden'));

    $('#setting-decks').on('change', function () {
        config.numDecks = parseInt($(this).val());
        createShoe();
    });

    $('#setting-speed').on('change', function () {
        config.speed = $(this).val();
    });

    $('#setting-sound').on('change', function () {
        config.sound = $(this).is(':checked');
    });

    $('#btn-reset-balance').on('click', function () {
        state.balance = 1000;
        state.maxBalance = 1000;
        updateBalance();
        $('#max-balance').text(1000);
    });

    // Close modal on backdrop click
    $('.modal').on('click', function (e) {
        if ($(e.target).hasClass('modal') && !$(e.target).is('#insurance-modal')) {
            $(this).addClass('hidden');
        }
    });

    // ---------------------------------------------------------------
    // KEYBOARD SHORTCUTS
    // ---------------------------------------------------------------
    $(document).on('keydown', function (e) {
        if (state.gamePhase === 'playing') {
            switch (e.key.toLowerCase()) {
                case 'h': $('#btn-hit').click(); break;
                case 's': $('#btn-stand').click(); break;
                case 'd': if (!$('#btn-double').prop('disabled')) $('#btn-double').click(); break;
                case 'p': if (!$('#btn-split').hasClass('hidden')) $('#btn-split').click(); break;
            }
        } else if (state.gamePhase === 'betting') {
            if (e.key === 'Enter' && state.mainBet > 0) {
                $('#btn-deal').click();
            }
        } else if (state.gamePhase === 'roundEnd') {
            if (e.key === 'Enter' || e.key === ' ') {
                $('#btn-new-round').click();
            }
        }
    });

    // ---------------------------------------------------------------
    // DEALER ANIMATION (eyes follow cursor)
    // ---------------------------------------------------------------
    $(document).on('mousemove', function (e) {
        const svg = document.getElementById('dealer-svg');
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / window.innerWidth * 3;
        const dy = (e.clientY - cy) / window.innerHeight * 2;

        $('.dealer-eye').each(function () {
            const baseCx = parseFloat($(this).attr('cx'));
            $(this).css('transform', `translate(${dx}px, ${dy}px)`);
        });
    });

    // ---------------------------------------------------------------
    // INIT
    // ---------------------------------------------------------------
    createShoe();
    initParticles();
    setupBettingPhase();
    updateStats();

    // Dealer blink animation
    setInterval(() => {
        $('.dealer-eye').css('transform', 'scaleY(0.1)');
        setTimeout(() => $('.dealer-eye').css('transform', 'scaleY(1)'), 150);
    }, 4000);

});
