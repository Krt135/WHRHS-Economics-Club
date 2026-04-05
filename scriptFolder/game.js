// ── WEEKLY QUESTION BANK ──
// Questions rotate by ISO week number so a new set appears every Monday.
const allWeeks = [
  // Week A
  [
    {
      q: "If the Federal Reserve raises interest rates, what typically happens to consumer borrowing?",
      options: ["It increases", "It decreases", "No change", "It becomes illegal"],
      correct: 1,
      explanation: "Higher interest rates make borrowing more expensive, which typically reduces consumer borrowing."
    },
    {
      q: "What does GDP stand for?",
      options: ["Gross Domestic Product", "General Demand Price", "Government Deficit Percentage", "Global Distribution Protocol"],
      correct: 0,
      explanation: "GDP — Gross Domestic Product — measures the total monetary value of all goods and services produced within a country in a given time period."
    },
    {
      q: "When inflation rises faster than wages, what happens to workers' purchasing power?",
      options: ["It increases", "It stays the same", "It decreases", "It doubles"],
      correct: 2,
      explanation: "If prices rise faster than wages, each dollar earns buys less. Real purchasing power — what wages can actually buy — falls."
    },
    {
      q: "Which of the following best describes a 'recession'?",
      options: ["Two consecutive quarters of economic growth", "A sustained rise in the general price level", "Two consecutive quarters of negative GDP growth", "A government budget surplus"],
      correct: 2,
      explanation: "A recession is commonly defined as two consecutive quarters (six months) of negative GDP growth, signaling a contraction in economic activity."
    },
    {
      q: "What is the opportunity cost of a decision?",
      options: ["The monetary price paid", "The value of the next best alternative foregone", "The total cost of all options", "The sunk cost of a previous choice"],
      correct: 1,
      explanation: "Opportunity cost is the value of the best alternative you give up when making a choice. It's a core concept in economics — every decision has a hidden cost."
    }
  ],
  // Week B
  [
    {
      q: "What happens to the price of a good when demand increases but supply stays constant?",
      options: ["Price falls", "Price stays the same", "Price rises", "Quantity demanded falls"],
      correct: 2,
      explanation: "With supply held constant, an increase in demand shifts the demand curve rightward, resulting in a higher equilibrium price and greater quantity sold."
    },
    {
      q: "Which institution is primarily responsible for monetary policy in the United States?",
      options: ["The U.S. Treasury", "The Federal Reserve", "The World Bank", "The Securities and Exchange Commission"],
      correct: 1,
      explanation: "The Federal Reserve ('the Fed') is the central bank of the U.S. It controls monetary policy through tools like setting interest rates and open market operations."
    },
    {
      q: "What is a 'trade deficit'?",
      options: ["When a country exports more than it imports", "When a country imports more than it exports", "When a country has balanced trade", "When tariffs exceed export revenue"],
      correct: 1,
      explanation: "A trade deficit occurs when a country's imports exceed its exports. The U.S. has run a trade deficit for decades, importing more goods and services than it sells abroad."
    },
    {
      q: "In economics, what does 'elasticity' measure?",
      options: ["The flexibility of a production line", "How responsive quantity is to a change in price", "The speed of economic growth", "The physical properties of manufactured goods"],
      correct: 1,
      explanation: "Price elasticity of demand measures how much the quantity demanded changes in response to a price change. Elastic goods are very sensitive to price; inelastic goods are not."
    },
    {
      q: "What is 'quantitative easing' (QE)?",
      options: ["Raising taxes to reduce inflation", "A central bank buying assets to inject money into the economy", "Cutting government spending to balance the budget", "Imposing tariffs on foreign goods"],
      correct: 1,
      explanation: "QE is when a central bank purchases financial assets (like government bonds) to increase the money supply and stimulate lending and investment during economic downturns."
    }
  ],
  // Week C
  [
    {
      q: "What does the Consumer Price Index (CPI) measure?",
      options: ["The average wages of consumers", "Changes in the price level of a basket of consumer goods", "Corporate profit margins", "Government spending per capita"],
      correct: 1,
      explanation: "The CPI tracks changes in the prices of a representative 'basket' of goods and services purchased by households. It's the most common measure of inflation."
    },
    {
      q: "A 'monopoly' exists when:",
      options: ["Two firms control an entire market", "A single firm is the sole producer in a market", "The government controls all production", "Consumers have no preference between products"],
      correct: 1,
      explanation: "A monopoly is a market structure where a single firm is the only supplier of a product with no close substitutes, giving it significant pricing power."
    },
    {
      q: "Fiscal policy refers to government decisions about:",
      options: ["Interest rates and money supply", "Taxation and government spending", "International trade agreements", "Central bank reserve requirements"],
      correct: 1,
      explanation: "Fiscal policy involves government decisions on taxation and public spending. Expansionary fiscal policy (tax cuts or spending increases) stimulates the economy; contractionary policy does the opposite."
    },
    {
      q: "What is the 'invisible hand' concept in economics?",
      options: ["Secret government price controls", "The idea that self-interested actions lead to beneficial societal outcomes", "Hidden taxes on consumer goods", "Covert central bank interventions"],
      correct: 1,
      explanation: "Adam Smith's 'invisible hand' describes how individuals pursuing their own self-interest in free markets inadvertently promote the economic well-being of society as a whole."
    },
    {
      q: "Which of the following is an example of a 'negative externality'?",
      options: ["A factory that trains workers who improve the local economy", "A beekeeper whose bees pollinate nearby farms", "A factory that pollutes a river used by local residents", "A company that builds a park for its employees"],
      correct: 2,
      explanation: "A negative externality is a cost imposed on third parties not involved in a transaction. Pollution is the classic example — the factory and its customers don't bear the cost; nearby residents do."
    }
  ],
  // Week D
  [
    {
      q: "What is 'comparative advantage'?",
      options: ["Producing more of a good than any other country", "Being better at producing every good than trading partners", "Producing a good at a lower opportunity cost than others", "Having superior technology in manufacturing"],
      correct: 2,
      explanation: "Comparative advantage means producing a good at a lower opportunity cost than others. It's the foundation of trade theory — even if one country is better at everything, both benefit from specializing and trading."
    },
    {
      q: "In a supply-and-demand model, a 'price floor' set above equilibrium will cause:",
      options: ["A shortage", "A surplus", "No change in the market", "A decrease in demand"],
      correct: 1,
      explanation: "A price floor set above equilibrium forces prices higher than the market would naturally set. At higher prices, quantity supplied exceeds quantity demanded, creating a surplus."
    },
    {
      q: "What does it mean when a bond's yield rises?",
      options: ["The bond's price has risen", "The bond's price has fallen", "The issuer has defaulted", "Interest rates have been cut"],
      correct: 1,
      explanation: "Bond prices and yields move inversely. When a bond's price falls (e.g., due to rising interest rates or perceived risk), the fixed coupon payment represents a higher yield relative to the lower price."
    },
    {
      q: "What is 'stagflation'?",
      options: ["High growth with low inflation", "Slow economic growth combined with high inflation", "Rapid deflation with rising unemployment", "A period of zero GDP growth"],
      correct: 1,
      explanation: "Stagflation combines stagnant economic growth (or recession) with high inflation — a challenging scenario for policymakers because the usual remedies for one problem worsen the other."
    },
    {
      q: "Which of the following is NOT a function of money?",
      options: ["Medium of exchange", "Store of value", "Unit of account", "Guarantee of employment"],
      correct: 3,
      explanation: "The three classic functions of money are: medium of exchange (facilitates trade), store of value (holds purchasing power over time), and unit of account (common measure of value). Guaranteeing employment is not a function of money."
    }
  ]
];

// ── STATE ──
let questions = [];
let current = 0;
let score = 0;
let answered = false;

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function initQuiz() {
  const weekIndex = getWeekNumber(new Date()) % allWeeks.length;
  questions = allWeeks[weekIndex];
  current = 0;
  score = 0;
  answered = false;
  document.getElementById('quizCard').style.display = '';
  document.getElementById('resultsCard').classList.remove('visible');
  renderQuestion();
}

function renderQuestion() {
  const q = questions[current];
  const total = questions.length;

  document.getElementById('questionMeta').textContent = `QUESTION ${current + 1} OF ${total}`;
  document.getElementById('scoreDisplay').textContent = `${score} correct`;
  document.getElementById('progressFill').style.width = `${((current + 1) / total) * 100}%`;
  document.getElementById('questionText').textContent = q.q;

  const container = document.getElementById('optionsContainer');
  container.innerHTML = '';
  const letters = ['A','B','C','D'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `
      <span class="option-letter">${letters[i]}</span>
      <span>${opt}</span>
      <span class="option-icon"></span>
    `;
    btn.onclick = () => selectAnswer(i, btn);
    container.appendChild(btn);
  });

  document.getElementById('explanationBox').className = 'explanation-box';
  document.getElementById('explanationBox').innerHTML = '';
  document.getElementById('nextBtn').className = 'btn-next';
  answered = false;
}

function selectAnswer(selectedIndex, clickedBtn) {
  if (answered) return;
  answered = true;

  const q = questions[current];
  const buttons = document.querySelectorAll('.option-btn');
  const isCorrect = selectedIndex === q.correct;

  if (isCorrect) score++;

  buttons.forEach((btn, i) => {
    btn.disabled = true;
    const iconSpan = btn.querySelector('.option-icon');
    if (i === q.correct) {
      btn.classList.add('correct');
      iconSpan.innerHTML = `<svg width="18" height="18" fill="none" stroke="#16a34a" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (i === selectedIndex && !isCorrect) {
      btn.classList.add('wrong');
      iconSpan.innerHTML = `<svg width="18" height="18" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      btn.classList.add('dimmed');
    }
  });

  const explanationBox = document.getElementById('explanationBox');
  explanationBox.innerHTML = `<strong>Explanation:</strong> ${q.explanation}`;
  explanationBox.classList.add('visible');

  document.getElementById('scoreDisplay').textContent = `${score} correct`;

  const nextBtn = document.getElementById('nextBtn');
  if (current < questions.length - 1) {
    nextBtn.textContent = '';
    nextBtn.innerHTML = 'Next Question &nbsp;→';
    nextBtn.classList.add('visible');
  } else {
    nextBtn.textContent = '';
    nextBtn.innerHTML = 'See Results &nbsp;→';
    nextBtn.classList.add('visible');
  }
}

function nextQuestion() {
  current++;
  if (current < questions.length) {
    renderQuestion();
  } else {
    showResults();
  }
}

function showResults() {
  document.getElementById('quizCard').style.display = 'none';
  const card = document.getElementById('resultsCard');
  card.classList.add('visible');

  const total = questions.length;
  const pct = Math.round((score / total) * 100);

  let icon, title, message;
  if (pct === 100) {
    icon = '🏆'; title = 'Perfect Score!';
    message = 'Outstanding! You got every question right. You clearly have a strong grasp of economics — keep it up!';
  } else if (pct >= 80) {
    icon = '🎯'; title = 'Excellent Work!';
    message = 'Great performance! You have a solid understanding of economics. Review the questions you missed and come back stronger next week.';
  } else if (pct >= 60) {
    icon = '📈'; title = 'Good Effort!';
    message = 'Solid attempt! Keep engaging with The Floor, Weekly Features, and The Academy to sharpen your economic knowledge.';
  } else {
    icon = '📚'; title = 'Keep Learning!';
    message = 'Economics takes time to master. Check out The Academy for foundational resources, and try again — practice makes perfect!';
  }

  document.getElementById('resultsIcon').textContent = icon;
  document.getElementById('resultsTitle').textContent = title;
  document.getElementById('resultsScore').textContent = `${score} / ${total} correct — ${pct}%`;
  document.getElementById('resultsMessage').textContent = message;
  document.getElementById('correctPill').textContent = `✓  ${score} correct`;
  document.getElementById('wrongPill').textContent = `✗  ${total - score} incorrect`;
}

function restartQuiz() {
  document.getElementById('resultsCard').classList.remove('visible');
  document.getElementById('quizCard').style.display = '';
  current = 0; score = 0; answered = false;
  renderQuestion();
}

// Boot
initQuiz();