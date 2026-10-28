/* =========================================================
   TabiGo AI — Frontend logic
   Backend contract: POST /api/travel  { message, thread_id }
                     -> { success, answer, thread_id, error? }
   ========================================================= */

const $ = (id) => document.getElementById(id);

let currentThreadId = localStorage.getItem("travel_thread_id") || null;
let latestAnswerMarkdown = "";
let pipelineTimer = null;
let days = 7;
let selectedStyles = new Set(["sightseeing"]);
const HISTORY_KEY = "tabigo_history";

/* ---------------------------------------------------------
   Utilities
--------------------------------------------------------- */
function toast(message, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    $("toastWrap").appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateX(30px)";
        el.style.transition = "0.3s";
        setTimeout(() => el.remove(), 300);
    }, 2600);
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setPrompt(text) {
    const input = $("userInput");
    input.value = text;
    updateCharCount();
    input.focus();
}

function updateCharCount() {
    $("charCount").textContent = `${$("userInput").value.length} / 600`;
}

/* ---------------------------------------------------------
   Loading / errors
--------------------------------------------------------- */
function setLoading(isLoading) {
    $("sendBtn").disabled = isLoading;
    $("btnText").classList.toggle("hidden", isLoading);
    $("btnLoader").classList.toggle("hidden", !isLoading);
}

function showError(message) {
    const box = $("errorBox");
    box.textContent = message;
    box.classList.remove("hidden");
}

function hideError() {
    const box = $("errorBox");
    box.classList.add("hidden");
    box.textContent = "";
}

/* ---------------------------------------------------------
   Live agent pipeline (visual simulation while the real
   backend request runs, so the UI feels alive)
--------------------------------------------------------- */
const PIPELINE_LOGS = [
    ["Flight Agent", "Querying AviationStack + Tavily for best routes..."],
    ["Hotel Agent", "Comparing hotels and ratings near key areas..."],
    ["Itinerary Agent", "Building day-wise plan with places & activities..."],
    ["Final Response Agent", "Groq · Llama 3 is composing your travel plan..."]
];

function termLog(text, cls = "") {
    const term = $("terminal");
    const line = document.createElement("div");
    line.className = `term-line ${cls}`;
    line.textContent = text;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

function resetPipeline() {
    document.querySelectorAll(".p-step").forEach((s) => s.classList.remove("running", "done"));
    document.querySelectorAll(".p-line").forEach((l) => l.classList.remove("done"));
    $("terminal").innerHTML = "";
}

function startPipeline() {
    clearInterval(pipelineTimer);
    resetPipeline();
    termLog("$ tabigo --plan", "muted");
    termLog(`✓ Thread: ${currentThreadId || "new"}`, "ok");

    const steps = document.querySelectorAll(".p-step");
    const lines = document.querySelectorAll(".p-line");
    let i = 0;

    const advance = () => {
        if (i > 0) {
            steps[i - 1].classList.remove("running");
            steps[i - 1].classList.add("done");
            if (lines[i - 1]) lines[i - 1].classList.add("done");
            termLog(`✓ ${PIPELINE_LOGS[i - 1][0]} finished`, "ok");
        }
        if (i < steps.length) {
            steps[i].classList.add("running");
            termLog(`▶ ${PIPELINE_LOGS[i][0]}: ${PIPELINE_LOGS[i][1]}`, "run");
            $("pipelineState").textContent = `Running — ${PIPELINE_LOGS[i][0]}`;
            i++;
        } else {
            clearInterval(pipelineTimer); // wait on the last step until the API answers
        }
    };

    advance();
    pipelineTimer = setInterval(advance, 2600);
}

function finishPipeline(success = true) {
    clearInterval(pipelineTimer);
    const steps = document.querySelectorAll(".p-step");
    const lines = document.querySelectorAll(".p-line");

    if (success) {
        steps.forEach((s) => { s.classList.remove("running"); s.classList.add("done"); });
        lines.forEach((l) => l.classList.add("done"));
        termLog("✓ Shared state merged · plan saved to PostgreSQL memory", "ok");
        $("pipelineState").textContent = "Completed — your plan is ready";
    } else {
        steps.forEach((s) => s.classList.remove("running"));
        termLog("✗ Pipeline failed. Check the backend logs.", "err");
        $("pipelineState").textContent = "Failed — see error below";
    }
}

/* ---------------------------------------------------------
   Rendering the result
--------------------------------------------------------- */
function renderMarkdown(md) {
    let html;
    if (typeof marked !== "undefined") {
        html = marked.parse(md);
        if (typeof DOMPurify !== "undefined") html = DOMPurify.sanitize(html);
    } else {
        html = `<pre>${escapeHtml(md)}</pre>`;
    }
    return html;
}

function buildToc() {
    const toc = $("toc");
    toc.innerHTML = "";
    const heads = $("resultBox").querySelectorAll("h1, h2");
    heads.forEach((h, idx) => {
        h.id = `sec-${idx}`;
        const a = document.createElement("a");
        a.href = `#sec-${idx}`;
        a.textContent = h.textContent.replace(/[#*]/g, "").trim().slice(0, 34);
        toc.appendChild(a);
    });
}

function showResult(answer, threadId) {
    latestAnswerMarkdown = answer;
    $("resultBox").innerHTML = renderMarkdown(answer);
    $("threadInfo").textContent = `Thread ID: ${threadId}`;
    buildToc();

    const section = $("resultSection");
    section.classList.remove("hidden");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------------
   Build a richer prompt from the quick builder
--------------------------------------------------------- */
function buildPromptFromBuilder() {
    const from = $("fromInput").value.trim();
    const to = $("toInput").value.trim();
    const budget = $("budgetInput").value.trim();
    const styles = [...selectedStyles].join(", ");

    if (!to) return "";

    let p = `Plan a complete ${days} days ${to} trip`;
    if (from) p += ` from ${from}`;
    p += " including flights, hotels and sightseeing";
    if (budget) p += ` under ${budget}`;
    if (styles) p += `. Travel style: ${styles}`;
    return p + ".";
}

/* ---------------------------------------------------------
   Send message (calls the FastAPI backend)
--------------------------------------------------------- */
async function sendMessage() {
    hideError();

    const input = $("userInput");
    let message = input.value.trim();

    if (!message) {
        message = buildPromptFromBuilder();
        if (message) {
            input.value = message;
            updateCharCount();
        }
    }

    if (!message) {
        showError("Please describe your trip or fill in a destination first.");
        input.focus();
        return;
    }

    setLoading(true);
    startPipeline();
    $("pipeline").scrollIntoView({ behavior: "smooth", block: "center" });

    try {
        const response = await fetch("/api/travel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, thread_id: currentThreadId })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Something went wrong.");
        }

        currentThreadId = data.thread_id;
        localStorage.setItem("travel_thread_id", currentThreadId);

        finishPipeline(true);
        showResult(data.answer, data.thread_id);
        saveHistory(message, data.answer, data.thread_id);
        celebrate();
        toast("Your travel plan is ready ✈️");
    } catch (error) {
        finishPipeline(false);
        showError(error.message);
        toast("Could not generate the plan", "error");
    } finally {
        setLoading(false);
    }
}

/* ---------------------------------------------------------
   Copy / PDF / Print
--------------------------------------------------------- */
function copyResult() {
    const text = $("resultBox").innerText;
    if (!text) return;

    navigator.clipboard.writeText(text)
        .then(() => toast("Plan copied to clipboard"))
        .catch(() => showError("Could not copy result."));
}

function downloadPDF() {
    const pdfContent = $("pdfContent");

    if (!latestAnswerMarkdown || !pdfContent) {
        showError("No travel plan available to download.");
        return;
    }

    const btn = $("downloadBtn");
    const oldText = btn.textContent;
    btn.textContent = "Preparing PDF...";
    btn.disabled = true;

    const options = {
        margin: 0.5,
        filename: "tabigo-travel-plan.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };

    html2pdf().set(options).from(pdfContent).save()
        .then(() => { toast("PDF downloaded"); })
        .catch(() => showError("Could not download PDF."))
        .finally(() => { btn.textContent = oldText; btn.disabled = false; });
}

/* ---------------------------------------------------------
   History (localStorage)
--------------------------------------------------------- */
function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}

function saveHistory(prompt, answer, threadId) {
    const list = getHistory();
    list.unshift({ prompt, answer, threadId, time: Date.now() });
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* quota */ }
    renderHistory();
}

function renderHistory() {
    const list = getHistory();
    const grid = $("historyGrid");
    grid.innerHTML = "";

    $("historyEmpty").classList.toggle("hidden", list.length > 0);
    $("clearHistory").classList.toggle("hidden", list.length === 0);

    list.forEach((item, idx) => {
        const card = document.createElement("button");
        card.className = "history-card";
        const h = document.createElement("h4");
        h.textContent = item.prompt;
        const s = document.createElement("small");
        s.textContent = new Date(item.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
        card.append(h, s);
        card.addEventListener("click", () => {
            showResult(item.answer, item.threadId);
            toast("Reopened saved plan");
        });
        grid.appendChild(card);
    });
}

/* ---------------------------------------------------------
   Builder controls
--------------------------------------------------------- */
function initBuilder() {
    $("daysPlus").addEventListener("click", () => { days = Math.min(30, days + 1); $("daysValue").textContent = days; });
    $("daysMinus").addEventListener("click", () => { days = Math.max(1, days - 1); $("daysValue").textContent = days; });

    document.querySelectorAll("#styleChips .chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const s = chip.dataset.style;
            if (selectedStyles.has(s)) { selectedStyles.delete(s); chip.classList.remove("active"); }
            else { selectedStyles.add(s); chip.classList.add("active"); }
        });
    });

    // Fill the textarea when the builder changes
    ["fromInput", "toInput", "budgetInput"].forEach((id) =>
        $(id).addEventListener("change", syncBuilderToTextarea));
    ["daysPlus", "daysMinus"].forEach((id) => $(id).addEventListener("click", syncBuilderToTextarea));
    document.querySelectorAll("#styleChips .chip").forEach((c) => c.addEventListener("click", syncBuilderToTextarea));

    document.querySelectorAll(".quick-prompts button").forEach((b) =>
        b.addEventListener("click", () => setPrompt(b.dataset.prompt)));

    $("newTripBtn").addEventListener("click", () => {
        currentThreadId = null;
        localStorage.removeItem("travel_thread_id");
        $("userInput").value = "";
        updateCharCount();
        $("resultSection").classList.add("hidden");
        resetPipeline();
        termLog("$ tabigo --ready", "muted");
        $("pipelineState").textContent = "Idle — waiting for a request";
        toast("Started a fresh conversation thread");
    });
}

function syncBuilderToTextarea() {
    const p = buildPromptFromBuilder();
    if (p) { $("userInput").value = p; updateCharCount(); }
}

/* ---------------------------------------------------------
   Architecture explorer
--------------------------------------------------------- */
const NODE_INFO = {
    flight: {
        title: "✈️ Flight Agent",
        text: "Searches flights and finds the best options for the requested route and budget.",
        points: ["Tools: AviationStack (free flight API) + Tavily Search", "Writes → flight_results in TravelState"]
    },
    hotel: {
        title: "🏨 Hotel Agent",
        text: "Searches hotels and compares options by price, rating and location.",
        points: ["Tools: Tavily Search + Google Places API (optional)", "Writes → hotel_results in TravelState"]
    },
    itinerary: {
        title: "🗺️ Itinerary Agent",
        text: "Creates a day-wise itinerary with places to visit and activities.",
        points: ["Tools: Tavily Search + Google Maps API (places, directions)", "Writes → itinerary in TravelState"]
    },
    final: {
        title: "💬 Final Response Agent",
        text: "Combines every agent's output and generates the final, readable travel plan.",
        points: ["Tools: Groq LLM (Llama 3) + Tavily Search", "Writes → final_response in TravelState"]
    },
    state: {
        title: "🧠 Shared State · TravelState",
        text: "A single LangGraph state object that every agent reads from and writes to, keeping the workflow consistent.",
        points: ["Keys: user_query, flight_results, hotel_results, itinerary, final_response, messages", "Passed between nodes along the graph edges"]
    },
    db: {
        title: "🐘 PostgreSQL · Long-term memory",
        text: "Persists conversations and state so a thread_id can resume a conversation later.",
        points: ["Stores conversation history, user preferences and agent outputs", "State updates are checkpointed after each node"]
    }
};

function initArchitecture() {
    document.querySelectorAll(".node").forEach((node) => {
        node.addEventListener("click", () => {
            document.querySelectorAll(".node").forEach((n) => n.classList.remove("active"));
            node.classList.add("active");

            const info = NODE_INFO[node.dataset.node];
            const detail = $("nodeDetail");
            detail.innerHTML = "";
            const b = document.createElement("b");
            b.textContent = info.title;
            const p = document.createElement("p");
            p.textContent = info.text;
            const ul = document.createElement("ul");
            info.points.forEach((pt) => { const li = document.createElement("li"); li.textContent = pt; ul.appendChild(li); });
            detail.append(b, p, ul);
        });
    });
}

/* ---------------------------------------------------------
   Visual flair: typing effect, counters, reveal, tilt,
   particles, cursor glow, theme, confetti
--------------------------------------------------------- */
function initTyping() {
    const words = ["multi-agent AI", "live flight data", "smart itineraries", "LangGraph agents"];
    const el = $("typedWord");
    let w = 0, c = 0, deleting = false;

    const tick = () => {
        const word = words[w];
        el.textContent = word.slice(0, c);
        if (!deleting && c < word.length) { c++; setTimeout(tick, 85); }
        else if (!deleting) { deleting = true; setTimeout(tick, 1500); }
        else if (c > 0) { c--; setTimeout(tick, 45); }
        else { deleting = false; w = (w + 1) % words.length; setTimeout(tick, 300); }
    };
    tick();
}

function initReveal() {
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                e.target.classList.add("in");
                e.target.querySelectorAll("[data-count]").forEach(countUp);
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

function countUp(el) {
    const target = +el.dataset.count;
    let n = 0;
    const step = () => {
        n += 1;
        el.textContent = n;
        if (n < target) setTimeout(step, 180);
    };
    el.textContent = "0";
    step();
}

function initTilt() {
    document.querySelectorAll(".tilt").forEach((card) => {
        card.addEventListener("mousemove", (e) => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-6px)`;
        });
        card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
}

function initScrollAndCursor() {
    const glow = $("cursorGlow");
    window.addEventListener("mousemove", (e) => {
        glow.style.left = e.clientX + "px";
        glow.style.top = e.clientY + "px";
    });

    window.addEventListener("scroll", () => {
        const h = document.documentElement;
        const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
        $("scrollProgress").style.width = pct + "%";
    }, { passive: true });
}

function initTheme() {
    const saved = localStorage.getItem("tabigo_theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    $("themeToggle").textContent = saved === "dark" ? "🌙" : "☀️";

    $("themeToggle").addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("tabigo_theme", next);
        $("themeToggle").textContent = next === "dark" ? "🌙" : "☀️";
    });
}

/* Floating particle network on canvas */
function initParticles() {
    const canvas = $("bgCanvas");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    let w, h, pts;

    const resize = () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        const count = Math.min(70, Math.floor((w * h) / 22000));
        pts = Array.from({ length: count }, () => ({
            x: Math.random() * w, y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
            r: Math.random() * 1.8 + 0.6
        }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
        ctx.clearRect(0, 0, w, h);
        const light = document.documentElement.getAttribute("data-theme") === "light";
        const rgb = light ? "99,102,241" : "148,163,255";

        pts.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb},0.6)`;
            ctx.fill();

            for (let j = i + 1; j < pts.length; j++) {
                const q = pts[j];
                const d = Math.hypot(p.x - q.x, p.y - q.y);
                if (d < 130) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(q.x, q.y);
                    ctx.strokeStyle = `rgba(${rgb},${0.16 * (1 - d / 130)})`;
                    ctx.stroke();
                }
            }
        });
        requestAnimationFrame(draw);
    };
    draw();
}

/* Small confetti burst when a plan is ready */
function celebrate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "300" });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#f472b6"];

    const bits = Array.from({ length: 90 }, () => ({
        x: canvas.width / 2, y: canvas.height * 0.35,
        vx: (Math.random() - 0.5) * 16, vy: Math.random() * -13 - 3,
        s: Math.random() * 7 + 3, c: colors[(Math.random() * colors.length) | 0],
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3
    }));

    let frames = 0;
    const loop = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bits.forEach((b) => {
            b.x += b.vx; b.y += b.vy; b.vy += 0.38; b.rot += b.vr;
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rot);
            ctx.fillStyle = b.c;
            ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * 0.6);
            ctx.restore();
        });
        if (++frames < 110) requestAnimationFrame(loop);
        else canvas.remove();
    };
    loop();
}

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initTyping();
    initReveal();
    initTilt();
    initScrollAndCursor();
    initParticles();
    initBuilder();
    initArchitecture();
    renderHistory();
    updateCharCount();

    $("sendBtn").addEventListener("click", sendMessage);
    $("copyBtn").addEventListener("click", copyResult);
    $("printBtn").addEventListener("click", () => window.print());
    $("downloadBtn").addEventListener("click", downloadPDF);
    $("userInput").addEventListener("input", updateCharCount);

    $("clearHistory").addEventListener("click", () => {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
        toast("History cleared");
    });
});

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") sendMessage();
});