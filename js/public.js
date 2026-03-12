const ws = new WebSocket(`wss://${location.host}`);

const canalJoc = {
  postMessage: (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      ws.addEventListener("open", () => ws.send(JSON.stringify(data)), { once: true });
    }
  },
  onmessage: null,
};

ws.addEventListener("message", (event) => {
  if (canalJoc.onmessage) {
    canalJoc.onmessage({ data: JSON.parse(event.data) });
  }
});

function ascundeTot() {
  document.getElementById("game-board").innerHTML = "";
  document.getElementById("strike-container").innerHTML = "";
  document.getElementById("question-display").style.display = "none";
  document.getElementById("big-alert").style.display = "none";
  document.getElementById("bank-score").innerText = "0";
}

canalJoc.onmessage = (event) => {
  const data = event.data;

  if (data.actiune === "setup_board") {
    ascundeTot();
    const board = document.getElementById("game-board");
    if (data.numarRaspunsuri > 4) board.className = "board two-cols";
    else board.className = "board single-col";

    for (let i = 1; i <= data.numarRaspunsuri; i++) {
      board.innerHTML += `<div class="answer-box" id="ans-${i}"><span class="number-badge id-badge">${i}</span><span class="text hidden-text"></span><span class="points hidden-text"></span></div>`;
    }
  } else if (data.actiune === "arata_raspuns") {
    const box = document.getElementById("ans-" + data.id);
    if (box) {
      box.querySelector(".text").innerText = data.text;
      box.querySelector(".points").innerText = data.puncte;
      box.querySelector(".id-badge").style.display = "none";
      box
        .querySelectorAll(".hidden-text")
        .forEach((el) => el.classList.remove("hidden-text"));
    }
  } else if (data.actiune === "update_bank")
    document.getElementById("bank-score").innerText = data.bank;
  else if (data.actiune === "strike")
    document.getElementById("strike-container").innerHTML +=
      '<span class="x-mark">X</span>';
  else if (data.actiune === "update_scores") {
    document.getElementById("score1").innerText = data.s1;
    document.getElementById("score2").innerText = data.s2;
  } else if (data.actiune === "update_teams") {
    document.getElementById("team1-name").innerText = data.t1Name;
    document.getElementById("team2-name").innerText = data.t2Name;
  } else if (data.actiune === "show_question") {
    const qBox = document.getElementById("question-display");
    qBox.innerText = data.text;
    qBox.style.display = "block";
  } else if (data.actiune === "set_active_team") {
    document.getElementById("team1-display").classList.remove("active-team");
    document.getElementById("team2-display").classList.remove("active-team");
    if (data.team === 1)
      document.getElementById("team1-display").classList.add("active-team");
    if (data.team === 2)
      document.getElementById("team2-display").classList.add("active-team");
  } else if (data.actiune === "clear_screen") {
    ascundeTot();
  } else if (data.actiune === "big_x") {
    const xDiv = document.createElement("div");
    xDiv.id = "big-x-overlay";
    xDiv.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:999;animation:pop 0.3s ease-out;";
    xDiv.innerHTML = '<span style="font-size:300px;color:#ff3333;font-weight:bold;text-shadow:10px 10px 20px #000;">X</span>';
    document.body.appendChild(xDiv);
    setTimeout(() => xDiv.remove(), 1500);
  } else if (data.actiune === "clear_strikes") {
    document.getElementById("strike-container").innerHTML = "";
  } else if (data.actiune === "splash_runda_noua") {
    ascundeTot();
    document.getElementById("big-alert").style.display = "none";
  } else if (data.actiune === "show_winner") {
    ascundeTot();
    document.getElementById("alert-title").innerText =
      "CÂȘTIGĂTORII";
    const sub = document.getElementById("alert-subtitle");
    sub.style.display = "block";

    if (data.tie) {
      sub.innerText = "EGALITATE!";
      document.getElementById("alert-text").innerText =
        `Ambele echipe au terminat cu ${data.wScore} puncte!`;
    } else {
      sub.innerText = data.winner;
      document.getElementById("alert-text").innerText =
        `A câștigat cu ${data.wScore} puncte (o diferență de ${data.diff} puncte față de ${data.loser} care au ${data.lScore} puncte).`;
    }
    document.getElementById("big-alert").style.display = "block";
  }
};

window.onload = () => {
  canalJoc.postMessage({ actiune: "cere_sincronizare" });
};
