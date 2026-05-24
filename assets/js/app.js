/* ============================================================
   app.js — State, Router, Question Engine, localStorage
   מערכת האקלים של כדור הארץ
   ============================================================ */

/* ── State / localStorage ───────────────────────────────── */
const App = (function() {
  'use strict';

  const STORAGE_KEY = 'climate-learner-v1';

  const CHAPTERS = [
    { id: 'chapter-0', title: 'מהנדסים את האקלים',    file: 'chapters/chapter-0-intro.html',   icon: '🌍' },
    { id: 'chapter-1a', title: 'מבנה ותנועת כדור הארץ', file: 'chapters/chapter-1a.html',        icon: '🌐' },
    { id: 'chapter-1b', title: 'נטיית הכדור וזווית הקרינה', file: 'chapters/chapter-1b.html',    icon: '🔆' },
    { id: 'chapter-1c', title: 'אזורי אקלים ועונות שנה', file: 'chapters/chapter-1c.html',       icon: '🌡️' },
    { id: 'chapter-2', title: 'אתגר האלומה — תרגול',   file: 'chapters/chapter-2-practice.html', icon: '🎯' },
    { id: 'chapter-3', title: 'בוחן מסכם',             file: 'chapters/chapter-3-quiz.html',     icon: '📝' }
  ];

  let state = {
    progress:  {},   // { 'chapter-1a': 80, ... }  0-100
    scores:    {},   // { 'quiz': 6, ... }
    completed: [],   // ['chapter-0', 'chapter-1a', ...]
    answers:   {}    // { 'q1a_1': 1, ... }
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = Object.assign(state, JSON.parse(raw));
    } catch(e) { /* ignore */ }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
  }

  function resetState() {
    state = { progress: {}, scores: {}, completed: [], answers: {} };
    saveState();
  }

  function getProgress(chapterId) {
    return state.progress[chapterId] || 0;
  }

  function setProgress(chapterId, pct) {
    state.progress[chapterId] = Math.min(100, Math.max(0, pct));
    saveState();
    updateHeaderProgress();
  }

  function markComplete(chapterId) {
    state.progress[chapterId] = 100;
    if (!state.completed.includes(chapterId)) state.completed.push(chapterId);
    saveState();
    updateHeaderProgress();
  }

  function isCompleted(chapterId) {
    return state.completed.includes(chapterId);
  }

  function saveAnswer(questionId, answerIndex) {
    state.answers[questionId] = answerIndex;
    saveState();
  }

  function getSavedAnswer(questionId) {
    return state.answers.hasOwnProperty(questionId) ? state.answers[questionId] : null;
  }

  function saveScore(quizId, score) {
    state.scores[quizId] = score;
    saveState();
  }

  function getScore(quizId) {
    return state.scores[quizId] || 0;
  }

  function getTotalProgress() {
    const total = CHAPTERS.length * 100;
    const done  = CHAPTERS.reduce((sum, c) => sum + (state.progress[c.id] || 0), 0);
    return Math.round(done / CHAPTERS.length);
  }

  /* ── Header / Progress Bar ──────────────────────────── */
  function updateHeaderProgress() {
    const fill = document.querySelector('.global-progress-fill');
    if (fill) fill.style.width = getTotalProgress() + '%';
  }

  function setHeaderChapterName(name) {
    const el = document.querySelector('.header-chapter-name');
    if (el) el.textContent = name;
  }

  /* ── Navigation Drawer ──────────────────────────────── */
  function initSideNav() {
    const hamburger = document.querySelector('.hamburger');
    const sideNav   = document.querySelector('.side-nav');
    const overlay   = document.querySelector('.side-nav-overlay');
    if (!hamburger || !sideNav) return;

    hamburger.addEventListener('click', () => toggleNav());
    if (overlay) overlay.addEventListener('click', () => closeNav());

    function toggleNav() {
      const open = sideNav.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      if (overlay) overlay.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open);
    }
    function closeNav() {
      sideNav.classList.remove('open');
      hamburger.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  }

  /* ── Question Engine ─────────────────────────────────── */
  const QuestionEngine = {
    MAX_ATTEMPTS: 2,

    render(question, container, options) {
      options = Object.assign({ chapterId: '', onCorrect: null, onWrong: null }, options);
      const savedAnswer = getSavedAnswer(question.id);

      if (question.type === 'mc') {
        this._renderMC(question, container, options, savedAnswer);
      } else if (question.type === 'tf') {
        this._renderTF(question, container, options, savedAnswer);
      }
    },

    _renderMC(question, container, options, savedAnswer) {
      const block = document.createElement('div');
      block.className = 'question-block animate-fadeSlideUp';
      block.setAttribute('role', 'group');
      block.setAttribute('aria-labelledby', `q-text-${question.id}`);

      const attempts = [0];

      block.innerHTML = `
        <div class="question-number">שאלה</div>
        <div class="question-text" id="q-text-${question.id}">${question.text}</div>
        <ul class="options-list" role="radiogroup">
          ${question.options.map((opt, i) => `
            <li>
              <button class="option-btn" data-index="${i}" role="radio" aria-checked="false">
                <span class="option-letter" aria-hidden="true">${String.fromCharCode(0x05D0 + i)}</span>
                <span>${opt}</span>
              </button>
            </li>
          `).join('')}
        </ul>
        <div class="question-feedback hidden" aria-live="polite"></div>
        <div class="attempt-counter hidden"></div>
        <div class="question-actions"></div>
      `;

      container.appendChild(block);

      const optBtns   = block.querySelectorAll('.option-btn');
      const feedbackEl= block.querySelector('.question-feedback');
      const attemptsEl= block.querySelector('.attempt-counter');
      const actionsEl = block.querySelector('.question-actions');

      function showFeedback(idx, isCorrect) {
        const text = Array.isArray(question.feedback) ? question.feedback[idx] : question.feedback;
        feedbackEl.className = 'question-feedback ' + (isCorrect ? 'correct' : 'incorrect');
        feedbackEl.innerHTML = `<span class="question-feedback-icon">${isCorrect ? '✓' : '✗'}</span> ${text}`;
        feedbackEl.classList.remove('hidden');
      }

      function lockAll() {
        optBtns.forEach(b => { b.disabled = true; b.setAttribute('aria-checked', 'false'); });
      }

      function showRevealBtn() {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline btn-sm';
        btn.textContent = 'הצג תשובה נכונה';
        btn.onclick = () => {
          lockAll();
          optBtns[question.correct].classList.add('correct');
          showFeedback(question.correct, true);
          btn.remove();
        };
        actionsEl.appendChild(btn);
      }

      if (savedAnswer !== null) {
        const isCorrect = savedAnswer === question.correct;
        optBtns[savedAnswer].classList.add(isCorrect ? 'correct' : 'incorrect');
        optBtns[savedAnswer].setAttribute('aria-checked', 'true');
        if (isCorrect) optBtns[question.correct].classList.add('correct');
        showFeedback(savedAnswer, isCorrect);
        lockAll();
        return;
      }

      optBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          if (this.disabled) return;
          const idx = parseInt(this.dataset.index);
          const isCorrect = idx === question.correct;

          optBtns.forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-checked', 'false'); });
          this.classList.add('selected');
          this.setAttribute('aria-checked', 'true');

          attempts[0]++;

          if (isCorrect) {
            this.classList.replace('selected', 'correct');
            showFeedback(idx, true);
            lockAll();
            saveAnswer(question.id, idx);
            if (typeof Confetti !== 'undefined') {
              const rect = this.getBoundingClientRect();
              Confetti.burst(rect.left + rect.width / 2, rect.top);
            }
            if (options.onCorrect) options.onCorrect(question.id);
          } else {
            this.classList.replace('selected', 'incorrect');
            showFeedback(idx, false);

            if (attempts[0] >= QuestionEngine.MAX_ATTEMPTS) {
              lockAll();
              saveAnswer(question.id, idx);
              showRevealBtn();
              if (options.onWrong) options.onWrong(question.id);
            } else {
              attemptsEl.textContent = `נסיון ${attempts[0]} מתוך ${QuestionEngine.MAX_ATTEMPTS}`;
              attemptsEl.classList.remove('hidden');
              setTimeout(() => {
                this.classList.remove('incorrect');
                feedbackEl.classList.add('hidden');
              }, 1800);
            }
          }
        });
      });
    },

    _renderTF(question, container, options, savedAnswer) {
      const block = document.createElement('div');
      block.className = 'question-block animate-fadeSlideUp';

      block.innerHTML = `
        <div class="question-number">שאלה</div>
        <div class="question-text">${question.text}</div>
        <div class="tf-options">
          <button class="tf-btn" data-val="true">נכון ✓</button>
          <button class="tf-btn" data-val="false">לא נכון ✗</button>
        </div>
        <div class="question-feedback hidden" aria-live="polite"></div>
      `;

      container.appendChild(block);

      const tfBtns    = block.querySelectorAll('.tf-btn');
      const feedbackEl= block.querySelector('.question-feedback');

      function showFeedback(val, isCorrect) {
        const text = question.feedback[val ? 'true' : 'false'];
        feedbackEl.className = 'question-feedback ' + (isCorrect ? 'correct' : 'incorrect');
        feedbackEl.innerHTML = `<span class="question-feedback-icon">${isCorrect ? '✓' : '✗'}</span> ${text}`;
        feedbackEl.classList.remove('hidden');
      }

      if (savedAnswer !== null) {
        const val = savedAnswer === 1;
        const isCorrect = val === question.correct;
        tfBtns.forEach(b => {
          const bVal = b.dataset.val === 'true';
          if (bVal === val) b.classList.add(isCorrect ? 'correct' : 'incorrect');
          b.disabled = true;
        });
        showFeedback(val, isCorrect);
        return;
      }

      tfBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          if (this.disabled) return;
          const val = this.dataset.val === 'true';
          const isCorrect = val === question.correct;

          tfBtns.forEach(b => b.disabled = true);
          this.classList.add(isCorrect ? 'correct' : 'incorrect');
          showFeedback(val, isCorrect);
          saveAnswer(question.id, val ? 1 : 0);

          if (isCorrect && typeof Confetti !== 'undefined') {
            const rect = this.getBoundingClientRect();
            Confetti.burst(rect.left + rect.width / 2, rect.top);
          }
          if (isCorrect && options.onCorrect) options.onCorrect(question.id);
          if (!isCorrect && options.onWrong) options.onWrong(question.id);
        });
      });
    }
  };

  /* ── Quiz Engine (scored) ────────────────────────────── */
  const QuizEngine = {
    run(quizId, questions, container, onComplete) {
      let score = 0;
      let answered = 0;

      questions.forEach((q, i) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `animation-delay:${i * 0.08}s`;
        container.appendChild(wrapper);

        const numEl = wrapper.querySelector ? wrapper.querySelector('.question-number') : null;

        QuestionEngine.render(q, wrapper, {
          onCorrect() {
            score++;
            answered++;
            if (answered === questions.length && onComplete) {
              saveScore(quizId, score);
              setTimeout(() => onComplete(score, questions.length), 600);
            }
          },
          onWrong() {
            answered++;
            if (answered === questions.length && onComplete) {
              saveScore(quizId, score);
              setTimeout(() => onComplete(score, questions.length), 600);
            }
          }
        });

        const numDiv = wrapper.querySelector('.question-number');
        if (numDiv) numDiv.textContent = `שאלה ${i + 1} מתוך ${questions.length}`;
      });
    }
  };

  /* ── Chapter Progress Steps ──────────────────────────── */
  function initProgressSteps(chapterId, steps) {
    const bar = document.querySelector('.chapter-progress');
    if (!bar) return;
    bar.innerHTML = '';
    steps.forEach((label, i) => {
      const el = document.createElement('div');
      el.className = 'chapter-progress-step';
      el.title = label;
      bar.appendChild(el);
    });
  }

  function setProgressStep(stepIndex, state) {
    const steps = document.querySelectorAll('.chapter-progress-step');
    if (steps[stepIndex]) {
      steps[stepIndex].className = 'chapter-progress-step ' + (state || '');
    }
  }

  /* ── Staged Progressive Disclosure ──────────────────── */
  function initStagedSections(chapterId) {
    const sections = Array.from(document.querySelectorAll('main .section'));
    const footer   = document.querySelector('.chapter-nav-footer');
    if (sections.length <= 1) return;

    // Returning users who finished: show everything
    if (getProgress(chapterId) >= 100) return;

    // Hide all but the first section and the nav footer
    sections.slice(1).forEach(s => { s.style.display = 'none'; });
    if (footer) footer.style.display = 'none';

    // Mark first step active
    setProgressStep(0, 'active');

    // Append a continue button to every section except the last
    sections.forEach(function(section, idx) {
      if (idx === sections.length - 1) return;

      const wrap = document.createElement('div');
      wrap.className = 'staged-continue-wrap';
      wrap.style.cssText = 'text-align:center;margin-top:36px;padding-bottom:4px;';

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary staged-continue-btn';
      btn.style.cssText = 'font-size:1rem;padding:14px 40px;';
      btn.textContent = 'המשך ←';
      btn.setAttribute('aria-label', 'המשך לחלק הבא');
      wrap.appendChild(btn);
      section.appendChild(wrap);

      btn.addEventListener('click', function() {
        wrap.remove();

        const next = sections[idx + 1];
        next.style.display = '';
        next.classList.remove('animate-fadeSlideUp');
        void next.offsetWidth;              // force reflow for animation restart
        next.classList.add('animate-fadeSlideUp');
        setTimeout(function() {
          next.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);

        // Advance progress step indicators
        setProgressStep(idx, 'done');
        setProgressStep(idx + 1, 'active');

        // Save progress percentage
        var pct = Math.round(((idx + 2) / sections.length) * 100);
        setProgress(chapterId, Math.max(getProgress(chapterId), pct));

        // When the last section is revealed, also show the nav footer
        if (idx + 1 === sections.length - 1) {
          if (footer) {
            footer.style.display = '';
            void footer.offsetWidth;
            footer.classList.add('animate-fadeSlideUp');
          }
        }
      });
    });
  }

  /* ── Simulation Fullscreen ───────────────────────────── */
  function initSimulationFullscreen() {
    document.querySelectorAll('.simulation-fullscreen-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const wrapper = this.closest('.simulation-wrapper');
        const iframe  = wrapper ? wrapper.querySelector('iframe') : null;
        if (!iframe) return;
        if (iframe.requestFullscreen) iframe.requestFullscreen();
        else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
      });
    });
  }

  /* ── Init ────────────────────────────────────────────── */
  function init() {
    loadState();
    updateHeaderProgress();
    initSideNav();
    initSimulationFullscreen();
  }

  /* ── Public API ──────────────────────────────────────── */
  return {
    init,
    loadState,
    saveState,
    resetState,
    getProgress,
    setProgress,
    markComplete,
    isCompleted,
    saveAnswer,
    getSavedAnswer,
    saveScore,
    getScore,
    getTotalProgress,
    updateHeaderProgress,
    setHeaderChapterName,
    initProgressSteps,
    setProgressStep,
    CHAPTERS,
    QuestionEngine,
    QuizEngine,
    initStagedSections
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
